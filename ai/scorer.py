import psycopg2
import numpy as np
from datetime import datetime
from config import DB_CONFIG

# ─────────────────────────────────────────────
# 1. CONNECT TO DB
# ─────────────────────────────────────────────
def get_conn():
    conn = psycopg2.connect(**DB_CONFIG)

    cur = conn.cursor()
    cur.execute("SELECT current_user, current_database();")
    print("Connected as:", cur.fetchone())

    return conn


# ─────────────────────────────────────────────
# 2. LOAD ALL GAP CANDIDATES + THEIR PAPERS
#
# We join gap_candidates → papers using
# source_paper_ids (which is a TEXT[] array).
# For each gap we pull:
#   - its own study_count and coverage_score
#   - avg citation_count of its source papers
#   - most recent published_at of its source papers
# ─────────────────────────────────────────────
def load_gaps_with_features(conn):
    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT
                id,
                title,
                description,
                study_count,
                coverage_score,
                source_paper_ids
            FROM gap_candidates
            ORDER BY created_at;
        """)
        rows = cur.fetchall()
        print(f"Loaded {len(rows)} gap candidates from DB.")

        gaps = []
        for row in rows:
            gap_id         = row[0]
            title          = row[1] or ""
            description    = row[2] or ""
            study_count    = row[3] or 0
            coverage_score = row[4] or 0.0
            paper_ids      = row[5] or []

            paper_stats = get_paper_stats_by_ids(cur, paper_ids)

            if paper_stats["matched_paper_count"] == 0:
                keywords = extract_keywords(title)
                paper_stats = get_paper_stats_by_text(cur, keywords)

            gaps.append({
                "id":                  gap_id,
                "title":               title,
                "description":         description,
                "study_count":         study_count,
                "coverage_score":      float(coverage_score),
                "matched_paper_count": paper_stats["matched_paper_count"],
                "avg_citation_count":  paper_stats["avg_citation_count"],
                "latest_published_at": paper_stats["latest_published_at"],
                "avg_word_count":      paper_stats["avg_word_count"],
            })

        cur.close()
        return gaps

    except Exception as e:
        conn.rollback()          # ← clears broken transaction state
        print(f"Error loading gaps: {e}")
        return []


def extract_keywords(title):
    """Pull meaningful words from gap title for text search fallback."""
    # Remove short/common words, keep meaningful ones
    stopwords = {"of", "for", "and", "the", "in", "a", "an",
                 "to", "vs", "versus", "with", "on", "is", "at"}
    words = title.lower().split()
    keywords = [w.strip(",.;:") for w in words
                if w not in stopwords and len(w) > 3]
    return keywords[:4]   # use top 4 keywords max


def get_paper_stats_by_ids(cur, paper_ids):
    """Join papers by UUID array. Returns zero stats if array is empty."""
    empty = {
        "matched_paper_count": 0,
        "avg_citation_count":  0.0,
        "latest_published_at": None,
        "avg_word_count":      0.0,
    }

    if not paper_ids:
        return empty

    try:
        cur.execute("""
            SELECT
                COUNT(*)              AS matched,
                AVG(citation_count)   AS avg_cit,
                MAX(published_at)     AS latest,
                AVG(word_count)       AS avg_words
            FROM papers
            WHERE id = ANY(%s::uuid[])
        """, (paper_ids,))
        row = cur.fetchone()
        return {
            "matched_paper_count": int(row[0]) if row[0] else 0,
            "avg_citation_count":  float(row[1]) if row[1] else 0.0,
            "latest_published_at": row[2],
            "avg_word_count":      float(row[3]) if row[3] else 0.0,
        }
    except Exception:
        return empty


def get_paper_stats_by_text(cur, keywords):
    """Fallback: search papers by keyword match in title/abstract."""
    empty = {
        "matched_paper_count": 0,
        "avg_citation_count":  0.0,
        "latest_published_at": None,
        "avg_word_count":      0.0,
    }

    if not keywords:
        return empty

    # Build ILIKE conditions for each keyword
    conditions = " OR ".join(
        ["title ILIKE %s OR abstract ILIKE %s"] * len(keywords)
    )
    # Each keyword needs two params (title + abstract)
    params = []
    for kw in keywords:
        params.extend([f"%{kw}%", f"%{kw}%"])

    try:
        cur.execute(f"""
            SELECT
                COUNT(*)              AS matched,
                AVG(citation_count)   AS avg_cit,
                MAX(published_at)     AS latest,
                AVG(word_count)       AS avg_words
            FROM papers
            WHERE {conditions}
            LIMIT 20
        """, params)
        row = cur.fetchone()
        return {
            "matched_paper_count": int(row[0]) if row[0] else 0,
            "avg_citation_count":  float(row[1]) if row[1] else 0.0,
            "latest_published_at": row[2],
            "avg_word_count":      float(row[3]) if row[3] else 0.0,
        }
    except Exception as e:
        print(f"  Text search fallback failed: {e}")
        return empty

# ─────────────────────────────────────────────
# 3. FEATURE ENGINEERING
#
# We turn raw DB values into normalized 0-1
# signals. Each signal has a clear direction:
# higher value = more novel OR more feasible.
# ─────────────────────────────────────────────
CURRENT_YEAR = datetime.now().year

def compute_novelty_features(gap):
    """
    Novelty = how unexplored is this gap?
    
    Signal 1 - sparsity:
        Fewer papers on this topic = more novel.
        study_count of 0 or 1 → most novel.
        We invert: 1 / (1 + study_count)
    
    Signal 2 - low coverage:
        coverage_score was computed by Member 3.
        Lower coverage = the existing papers don't
        cover this topic well = more novel.
        We invert: 1 - coverage_score
        (assuming coverage_score is already 0-1)
    
    Signal 3 - low citations on source papers:
        If the papers that mention this gap are
        not highly cited, it's an underexplored area.
        We invert citation density.
    
    Signal 4 - staleness:
        If the most recent paper is old, the gap
        has been sitting unstudied for a long time
        = reinforces novelty.
    """

    # Signal 1: sparsity (0-1, higher = more novel)
    study_count = max(gap["study_count"], 0)
    sparsity = 1.0 / (1.0 + study_count)

    # Signal 2: low coverage (0-1, higher = less covered = more novel)
    coverage = gap["coverage_score"] or 0.0
    coverage = max(0.0, min(1.0, coverage))   # clamp to 0-1
    low_coverage = 1.0 - coverage

    # Signal 3: low citation density (0-1, higher = less cited = more novel)
    avg_cit = gap["avg_citation_count"]
    # Most gaps will have avg citations between 0-500
    # We cap at 200 to avoid extreme outliers dominating
    cit_capped = min(avg_cit, 200.0)
    low_citation = 1.0 - (cit_capped / 200.0)

    # Signal 4: staleness (0-1, higher = older last paper = more novel)
    latest = gap["latest_published_at"]
    if latest:
        years_ago = CURRENT_YEAR - latest.year
        # Cap at 20 years (older than that = max staleness)
        staleness = min(years_ago / 20.0, 1.0)
    else:
        # No paper date found → treat as moderately stale
        staleness = 0.5

    return {
        "sparsity":     sparsity,
        "low_coverage": low_coverage,
        "low_citation": low_citation,
        "staleness":    staleness,
    }


def compute_feasibility_features(gap):
    """
    Feasibility = can a researcher realistically study this?
    
    Signal 1 - data availability:
        More matched papers = there IS existing work
        to build on = more feasible.
        (Opposite direction from novelty sparsity.)
    
    Signal 2 - paper depth:
        Higher avg word count on source papers suggests
        the field has detailed, usable methodology
        sections. More words = richer context = easier
        to design a new study from.
    
    Signal 3 - citation richness:
        Moderately cited papers (not too obscure, not
        a completely dead field) = better feasibility.
        We use a "goldilocks" curve - extreme ends bad.
    
    Signal 4 - recency:
        Recent papers mean active field with current
        methods and available collaborators/tools.
        Opposite of staleness for novelty.
    """

    # Signal 1: data availability (0-1)
    matched = gap["matched_paper_count"]
    # Cap at 20 papers — beyond that, data is very available
    data_avail = min(matched / 20.0, 1.0)

    # Signal 2: paper depth via word count (0-1)
    avg_words = gap["avg_word_count"]
    # Average research paper is ~5000-8000 words
    # Cap at 10000 to normalize
    depth = min(avg_words / 10000.0, 1.0)

    # Signal 3: citation richness - goldilocks (0-1)
    avg_cit = gap["avg_citation_count"]
    # Sweet spot: 10-100 citations = active, not obscure
    if avg_cit < 1:
        citation_richness = 0.2     # totally uncited = risky
    elif avg_cit <= 100:
        citation_richness = avg_cit / 100.0   # linear up to 100
    else:
        # Over 100 citations = very established, maybe over-studied
        citation_richness = max(0.5, 1.0 - (avg_cit - 100) / 900.0)

    # Signal 4: recency (0-1, higher = more recent = more feasible)
    latest = gap["latest_published_at"]
    if latest:
        years_ago = CURRENT_YEAR - latest.year
        # Papers in last 5 years = max recency
        recency = max(0.0, 1.0 - (years_ago / 10.0))
    else:
        recency = 0.3

    return {
        "data_avail":        data_avail,
        "depth":             depth,
        "citation_richness": citation_richness,
        "recency":           recency,
    }


# ─────────────────────────────────────────────
# 4. WEIGHTED SCORING
#
# Combine the signals using weights.
# Weights represent how important each signal
# is. They sum to 1.0 for each score.
# You can tune these later once you see results.
# ─────────────────────────────────────────────

# Novelty weights
NOVELTY_WEIGHTS = {
    "sparsity":     0.40,   # most important — few papers = novel
    "low_coverage": 0.30,   # second — coverage_score from Member 3
    "low_citation": 0.15,   # supporting signal
    "staleness":    0.15,   # supporting signal
}

# Feasibility weights
FEASIBILITY_WEIGHTS = {
    "data_avail":        0.40,   # most important — can you find data?
    "depth":             0.20,   # methodology richness
    "citation_richness": 0.20,   # field activity
    "recency":           0.20,   # current vs dead field
}

def weighted_score(features, weights):
    """Dot product of features and weights → raw score 0-1."""
    return sum(features[k] * weights[k] for k in weights)


# ─────────────────────────────────────────────
# 5. PERCENTILE NORMALIZATION
#
# This is the "ML" part without labels.
# Instead of using raw scores (which depend on
# our arbitrary weights), we rank every gap
# against every other gap.
#
# A gap with novelty_score = 0.7 doesn't tell
# you much. But "this gap is in the 85th
# percentile for novelty" tells you a lot.
#
# We convert to 0-10 scale for the dashboard.
# ─────────────────────────────────────────────
def percentile_normalize(scores, scale=10.0):
    """
    Percentile rank each score against all others.
    If all scores are identical, spread them evenly
    instead of giving everyone 0.
    """
    scores = np.array(scores, dtype=float)
    n = len(scores)
    if n == 0:
        return scores.tolist()

    # If all values are the same, return evenly spread scores
    if np.all(scores == scores[0]):
        print("  Warning: all raw scores identical — returning evenly spread scores.")
        return [round(scale * i / max(n - 1, 1), 2) for i in range(n)]

    normalized = np.zeros(n)
    for i, s in enumerate(scores):
        rank = np.sum(scores < s) / n
        normalized[i] = round(rank * scale, 2)

    return normalized.tolist()

# ─────────────────────────────────────────────
# 6. WRITE SCORES BACK TO DB
# ─────────────────────────────────────────────
def update_scores_in_db(conn, gap_id, novelty, feasibility):
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE gap_candidates
            SET novelty_score     = %s,
                feasibility_score = %s,
                status            = 'scored'
            WHERE id = %s
        """, (novelty, feasibility, gap_id))
        conn.commit()
        cur.close()
    except Exception as e:
        conn.rollback()   # ← clears the broken transaction so next update can run
        print(f"  Could not update gap {gap_id}: {e}")


# ─────────────────────────────────────────────
# 7. MAIN PIPELINE — runs T11 + T12 together
# ─────────────────────────────────────────────
def run_scoring():
    print("=== RISHI-AI Scoring Pipeline (T11 + T12) ===\n")

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT current_user, current_database();")
    print("Connected as:", cur.fetchone())
    cur.close()

    # Step A: load data
    gaps = load_gaps_with_features(conn)
    conn.close()   # close read connection after loading

    if not gaps:
        print("No gaps found in gap_candidates table. Exiting.")
        return

    # Step B: compute raw features for every gap
    novelty_raw = []
    feasibility_raw = []

    for gap in gaps:
        n_features = compute_novelty_features(gap)
        f_features = compute_feasibility_features(gap)

        novelty_raw.append(weighted_score(n_features, NOVELTY_WEIGHTS))
        feasibility_raw.append(weighted_score(f_features, FEASIBILITY_WEIGHTS))

    # Step C: percentile-normalize across the whole dataset
    novelty_normalized     = percentile_normalize(novelty_raw, scale=10.0)
    feasibility_normalized = percentile_normalize(feasibility_raw, scale=10.0)

    # Step D: write back to DB + print summary
    print(f"{'Title':<50} {'Novelty':>8} {'Feasibility':>12}")
    print("-" * 72)

    updated = 0
    failed  = 0

    for i, gap in enumerate(gaps):
        n_score = novelty_normalized[i]
        f_score = feasibility_normalized[i]

        title_short = (gap["title"] or "")[:48]

        # Fresh connection per update — one failure won't block the rest
        try:
            write_conn = get_conn()
            update_scores_in_db(write_conn, gap["id"], n_score, f_score)
            write_conn.close()
            updated += 1
            print(f"{title_short:<50} {n_score:>8.1f} {f_score:>12.1f}")

        except Exception as e:
            failed += 1
            print(f"{title_short:<50}  FAILED: {e}")
            continue

    print(f"\nDone. Updated: {updated}, Failed: {failed}")

    if failed > 0:
        print("\nFailed updates are likely a DB permissions issue.")
        print("Ask your DB maintainer to run:")
        print("  GRANT UPDATE ON gap_candidates TO readonly;")


if __name__ == "__main__":
    run_scoring()