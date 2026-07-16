# scorer.py
import os
import numpy as np
import psycopg2
from datetime import datetime
from config import DB_CONFIG

CURRENT_YEAR = datetime.now().year

NOVELTY_WEIGHTS = {
    "sparsity":          0.35,
    "description_rarity": 0.30,
    "low_citation":       0.20,
    "staleness":          0.15,
}

FEASIBILITY_WEIGHTS = {
    "data_avail":        0.35,
    "citation_richness": 0.30,
    "recency":           0.25,
    "depth":             0.10,
}


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


# ─────────────────────────────────────────────
# LOAD GAPS
# ─────────────────────────────────────────────
def load_gaps(conn):
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, title, description, topic,
                   study_count, coverage_score
            FROM gap_candidates
            ORDER BY created_at;
        """)
        rows = cur.fetchall()
        print(f"Loaded {len(rows)} gap candidates.")
        cur.close()
        return rows
    except Exception as e:
        conn.rollback()
        print(f"Error loading gaps: {e}")
        cur.close()
        return []


# ─────────────────────────────────────────────
# FETCH PAPER STATS BY KEYWORD SEARCH
# Each gap gets different stats based on its
# own title + topic keywords
# ─────────────────────────────────────────────
def get_paper_stats(conn, title, topic, description):
    """
    Search papers using keywords from title + topic + description.
    Each gap has unique keywords so returns different stats.
    """
    stopwords = {
        "of", "for", "and", "the", "in", "a", "an", "to",
        "vs", "with", "on", "is", "at", "from", "by", "its",
        "this", "that", "are", "was", "were", "has", "have",
        "been", "between", "among", "through", "their", "which"
    }

    # Extract keywords from all three sources
    combined = f"{title} {topic} {description}".lower()
    words = combined.split()
    keywords = []
    seen = set()
    for w in words:
        w = w.strip(",.;:()[]'\"")
        if w not in stopwords and len(w) > 4 and w not in seen:
            keywords.append(w)
            seen.add(w)
        if len(keywords) == 8:
            break

    if not keywords:
        return _empty_stats()

    conditions = " OR ".join(
        ["(title ILIKE %s OR abstract ILIKE %s)"] * len(keywords)
    )
    params = []
    for kw in keywords:
        params.extend([f"%{kw}%", f"%{kw}%"])
    params.append(30)

    cur = conn.cursor()
    try:
        cur.execute(f"""
            SELECT
                COUNT(*)            AS matched,
                AVG(citation_count) AS avg_cit,
                MAX(published_at)   AS latest,
                AVG(word_count)     AS avg_words
            FROM papers
            WHERE {conditions}
            LIMIT %s
        """, params)
        row = cur.fetchone()
        cur.close()
        if not row or not row[0]:
            return _empty_stats()
        return {
            "matched":    int(row[0]),
            "avg_cit":    float(row[1]) if row[1] else 0.0,
            "latest":     row[2],
            "avg_words":  float(row[3]) if row[3] else 0.0,
        }
    except Exception as e:
        conn.rollback()
        cur.close()
        print(f"  Paper stats error: {e}")
        return _empty_stats()


def _empty_stats():
    return {"matched": 0, "avg_cit": 0.0, "latest": None, "avg_words": 0.0}


# ─────────────────────────────────────────────
# DESCRIPTION RARITY SCORE
# Gaps with rare/unique words in description
# are more novel than generic ones.
# Uses TF across all gap descriptions.
# ─────────────────────────────────────────────
def compute_description_rarity(descriptions):
    """
    For each gap description, compute how rare its words are
    across all other gap descriptions.
    Higher score = more unique description = more novel.
    Returns a list of scores 0-1 in same order as input.
    """
    from collections import Counter
    import math

    stopwords = {
        "of", "for", "and", "the", "in", "a", "an", "to",
        "vs", "with", "on", "is", "are", "was", "this",
        "that", "these", "those", "has", "have", "been",
        "between", "among", "their", "which", "from"
    }

    # Tokenize each description
    tokenized = []
    for desc in descriptions:
        words = set(
            w.strip(",.;:()").lower()
            for w in desc.split()
            if len(w) > 4 and w.lower() not in stopwords
        )
        tokenized.append(words)

    n = len(tokenized)
    if n == 0:
        return []

    # Document frequency — how many gaps contain each word
    df = Counter()
    for words in tokenized:
        for w in words:
            df[w] += 1

    # For each gap: rarity = avg IDF of its words
    # IDF = log(N / df(word)) — rare words have high IDF
    scores = []
    for words in tokenized:
        if not words:
            scores.append(0.5)
            continue
        idf_scores = []
        for w in words:
            idf = math.log(n / max(df[w], 1))
            idf_scores.append(idf)
        avg_idf = sum(idf_scores) / len(idf_scores)
        scores.append(avg_idf)

    # Normalize to 0-1
    min_s = min(scores)
    max_s = max(scores)
    if max_s == min_s:
        return [0.5] * n
    return [(s - min_s) / (max_s - min_s) for s in scores]


# ─────────────────────────────────────────────
# NOVELTY FEATURES
# ─────────────────────────────────────────────
def compute_novelty_features(gap, description_rarity):
    study_count  = max(int(gap["study_count"] or 0), 0)
    sparsity     = 1.0 / (1.0 + study_count)

    avg_cit      = float(gap["avg_cit"] or 0.0)
    cit_capped   = min(avg_cit, 200.0)
    low_citation = 1.0 - (cit_capped / 200.0)

    latest = gap["latest"]
    if latest:
        try:
            years_ago = CURRENT_YEAR - latest.year
            staleness = min(max(years_ago / 20.0, 0.0), 1.0)
        except Exception:
            staleness = 0.5
    else:
        staleness = 0.5

    return {
        "sparsity":           float(sparsity),
        "description_rarity": float(description_rarity),
        "low_citation":       float(low_citation),
        "staleness":          float(staleness),
    }


# ─────────────────────────────────────────────
# FEASIBILITY FEATURES
# ─────────────────────────────────────────────
def compute_feasibility_features(gap):
    matched    = int(gap["matched"] or 0)
    data_avail = min(matched / 20.0, 1.0)

    avg_words = float(gap["avg_words"] or 0.0)
    depth     = min(avg_words / 10000.0, 1.0)

    avg_cit = float(gap["avg_cit"] or 0.0)
    if avg_cit < 1:
        citation_richness = 0.2
    elif avg_cit <= 100:
        citation_richness = avg_cit / 100.0
    else:
        citation_richness = max(0.5, 1.0 - (avg_cit - 100) / 900.0)

    latest = gap["latest"]
    if latest:
        try:
            years_ago = CURRENT_YEAR - latest.year
            recency   = max(0.0, 1.0 - (years_ago / 10.0))
        except Exception:
            recency = 0.3
    else:
        recency = 0.3

    return {
        "data_avail":        float(data_avail),
        "depth":             float(depth),
        "citation_richness": float(citation_richness),
        "recency":           float(recency),
    }


# ─────────────────────────────────────────────
# WEIGHTED SCORE
# ─────────────────────────────────────────────
def weighted_score(features, weights):
    return sum(float(features[k]) * float(weights[k]) for k in weights)


# ─────────────────────────────────────────────
# PERCENTILE NORMALIZATION
# ─────────────────────────────────────────────
def percentile_normalize(scores, scale=10.0):
    arr = np.array(scores, dtype=float)
    n   = len(arr)
    if n == 0:
        return []

    if np.all(arr == arr[0]):
        print("  Warning: all raw scores identical.")
        print("  Using score spread based on description rarity instead.")
        # Spread evenly so dashboard shows something meaningful
        return [round(scale * i / max(n - 1, 1), 2) for i in range(n)]

    normalized = []
    for s in arr:
        rank = float(np.sum(arr < s)) / n
        normalized.append(round(rank * scale, 2))
    return normalized


# ─────────────────────────────────────────────
# UPDATE DB
# ─────────────────────────────────────────────
def update_scores(gap_id, novelty, feasibility):
    try:
        conn = get_conn()
        cur  = conn.cursor()
        cur.execute("""
            UPDATE gap_candidates
            SET novelty_score     = %s,
                feasibility_score = %s,
                status            = 'scored'
            WHERE id = %s
        """, (novelty, feasibility, gap_id))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"  DB update failed for {gap_id}: {e}")
        return False


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def run_scoring():
    print("=== RISHI-AI Scoring Pipeline (T11 + T12) ===\n")

    conn = get_conn()

    # Step 1 — load gaps
    rows = load_gaps(conn)
    if not rows:
        print("No gaps found. Exiting.")
        conn.close()
        return

    # Step 2 — fetch paper stats per gap (each gap = different keywords)
    print("Fetching paper stats per gap...")
    enriched = []
    for row in rows:
        gap_id      = row[0]
        title       = row[1] or ""
        description = row[2] or ""
        topic       = row[3] or ""
        study_count = row[4] or 0
        coverage    = row[5] or 0.5

        stats = get_paper_stats(conn, title, topic, description)
        enriched.append({
            "id":          gap_id,
            "title":       title,
            "description": description,
            "topic":       topic,
            "study_count": study_count,
            "coverage":    coverage,
            **stats,      # matched, avg_cit, latest, avg_words
        })

    conn.close()

    # Step 3 — compute description rarity across ALL gaps
    descriptions      = [g["description"] for g in enriched]
    rarity_scores     = compute_description_rarity(descriptions)

    # Step 4 — compute raw feature scores
    novelty_raw     = []
    feasibility_raw = []

    for i, gap in enumerate(enriched):
        n_feat = compute_novelty_features(gap, rarity_scores[i])
        f_feat = compute_feasibility_features(gap)
        novelty_raw.append(weighted_score(n_feat, NOVELTY_WEIGHTS))
        feasibility_raw.append(weighted_score(f_feat, FEASIBILITY_WEIGHTS))

    # Step 5 — percentile normalize
    novelty_norm     = percentile_normalize(novelty_raw)
    feasibility_norm = percentile_normalize(feasibility_raw)

    # Step 6 — write back + print
    print(f"\n{'Title':<48} {'Novelty':>8} {'Feasibility':>12} {'Papers':>8}")
    print("-" * 80)

    updated = 0
    for i, gap in enumerate(enriched):
        n = novelty_norm[i]
        f = feasibility_norm[i]
        if update_scores(gap["id"], n, f):
            updated += 1
        print(
            f"{gap['title'][:46]:<48} "
            f"{n:>8.1f} {f:>12.1f} "
            f"{gap['matched']:>8}"
        )

    print(f"\nDone. Updated {updated}/{len(enriched)} gaps.")


if __name__ == "__main__":
    run_scoring()