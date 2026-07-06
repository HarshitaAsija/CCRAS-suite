# hypothesis.py
# T13 — Generate PICO hypothesis seeds for high-scoring gaps
# Reads from gap_candidates where novelty + feasibility are both good,
# calls Ollama to generate structured PICO JSON, writes back to DB.

import json
import os
import time
import uuid
import requests
import psycopg2

from config import (
    DB_CONFIG,
    OLLAMA_GENERATE_URL,
    OLLAMA_EMBED_URL,
    OLLAMA_MODEL,
    OLLAMA_EMBED_MODEL,
    OLLAMA_GENERATE_TIMEOUT,
    OLLAMA_EMBED_TIMEOUT,
)

# ─────────────────────────────────────────────
# 1. CONNECT TO DB
# ─────────────────────────────────────────────
def get_conn():
    return psycopg2.connect(**DB_CONFIG)


# Only generate hypotheses for gaps above these thresholds
# Adjust if too few or too many gaps qualify
NOVELTY_MIN     = 4.0
FEASIBILITY_MIN = 3.0


# ─────────────────────────────────────────────
# DB HELPERS
# ─────────────────────────────────────────────
def get_conn():
    return psycopg2.connect(**DB_CONFIG)


# def ensure_hypothesis_table(conn):
#     """
#     Creates the hypothesis_seeds table if it doesn't exist.
#     Each row is one PICO hypothesis linked to a gap_candidate.
#     """
#     cur = conn.cursor()
#     cur.execute("""
#         CREATE TABLE IF NOT EXISTS hypothesis_seeds (
#             id               UUID PRIMARY KEY,
#             gap_id           UUID REFERENCES gap_candidates(id),
#             gap_title        TEXT,
#             population       TEXT,
#             intervention     TEXT,
#             comparator       TEXT,
#             outcome          TEXT,
#             hypothesis_text  TEXT,
#             confidence       TEXT,
#             status           TEXT DEFAULT 'seeded',
#             created_at       TIMESTAMP DEFAULT now()
#         );
#     """)
#     conn.commit()
#     cur.close()
#     print("hypothesis_seeds table ready.")


def fetch_qualified_gaps(conn):
    """
    Fetch gaps that are:
    - scored (not NULL)
    - above novelty and feasibility thresholds
    - not already seeded
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT
            g.id,
            g.title,
            g.description,
            g.domain,
            g.subdomain,
            g.novelty_score,
            g.feasibility_score,
            g.study_count
        FROM gap_candidates g
        WHERE g.novelty_score    >= %s
          AND g.feasibility_score >= %s
          AND g.status = 'scored'
          AND g.id NOT IN (
              SELECT gap_id FROM hypothesis_seeds
              WHERE gap_id IS NOT NULL
          )
        ORDER BY (g.novelty_score + g.feasibility_score) DESC;
    """, (NOVELTY_MIN, FEASIBILITY_MIN))

    rows = cur.fetchall()
    cur.close()

    gaps = []
    for row in rows:
        gaps.append({
            "id":                str(row[0]),
            "title":             row[1] or "",
            "description":       row[2] or "",
            "domain":            row[3] or "",
            "subdomain":         row[4] or "",
            "novelty_score":     float(row[5]),
            "feasibility_score": float(row[6]),
            "study_count":       row[7] or 0,
        })

    return gaps


def fetch_supporting_papers(conn, gap_title, limit=5):
    """
    Pull the most relevant papers for a gap by text matching.
    Used to give the LLM real context instead of making things up.
    """
    cur = conn.cursor()

    # Use key words from gap title to find relevant papers
    stopwords = {"of", "for", "and", "the", "in", "a", "an",
                 "to", "vs", "versus", "with", "on", "is", "at",
                 "from", "by", "into", "its"}
    words = [w.strip(",.;:()") for w in gap_title.lower().split()
             if w not in stopwords and len(w) > 3]
    keywords = words[:4]

    if not keywords:
        cur.close()
        return []

    conditions = " OR ".join(
        ["(title ILIKE %s OR abstract ILIKE %s)"] * len(keywords)
    )
    params = []
    for kw in keywords:
        params.extend([f"%{kw}%", f"%{kw}%"])
    params.append(limit)

    cur.execute(f"""
        SELECT title, abstract
        FROM papers
        WHERE {conditions}
        LIMIT %s
    """, params)

    rows = cur.fetchall()
    cur.close()

    return [
        f"Title: {r[0] or ''}\nAbstract: {(r[1] or '')[:300]}"
        for r in rows
    ]


def save_hypothesis(conn, gap, pico):
    """Write one PICO hypothesis to the hypothesis_seeds table."""
    cur = conn.cursor()

    # Build a readable one-sentence hypothesis from PICO
    hypothesis_text = (
        f"In {pico.get('population', '?')}, "
        f"{pico.get('intervention', '?')} "
        f"compared to {pico.get('comparator', '?')} "
        f"will improve {pico.get('outcome', '?')}."
    )

    cur.execute("""
        INSERT INTO hypothesis_seeds (
            id, gap_id, gap_title,
            population, intervention, comparator, outcome,
            hypothesis_text, confidence, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        str(uuid.uuid4()),
        gap["id"],
        gap["title"],
        pico.get("population", ""),
        pico.get("intervention", ""),
        pico.get("comparator", ""),
        pico.get("outcome", ""),
        hypothesis_text,
        pico.get("confidence", "medium"),
        "seeded",
    ))

    conn.commit()
    cur.close()
    return hypothesis_text


def mark_gap_seeded(conn, gap_id):
    """Update gap status from 'scored' to 'seeded'."""
    cur = conn.cursor()
    cur.execute("""
        UPDATE gap_candidates
        SET status = 'seeded'
        WHERE id = %s
    """, (gap_id,))
    conn.commit()
    cur.close()


# ─────────────────────────────────────────────
# PROMPT BUILDER
# ─────────────────────────────────────────────
def build_pico_prompt(gap, supporting_papers):
    papers_text = "\n\n".join(supporting_papers) if supporting_papers \
                  else "No supporting papers available."

    return f"""You are a senior Ayurveda and biomedical research scientist.

Your task is to generate a PICO research hypothesis for the following research gap.

RESEARCH GAP:
Title: {gap["title"]}
Description: {gap["description"]}
Domain: {gap["domain"]} / {gap["subdomain"]}
Novelty score: {gap["novelty_score"]}/10
Feasibility score: {gap["feasibility_score"]}/10
Existing studies on this topic: {gap["study_count"]}

SUPPORTING EVIDENCE FROM LITERATURE:
{papers_text}

Generate a structured PICO hypothesis for this gap.
Respond with ONLY valid JSON. No markdown, no code fences, no extra text.
Use EXACTLY this structure:

{{
  "population": "who or what is being studied (be specific — e.g. 'adult patients with type 2 diabetes aged 40-65')",
  "intervention": "what treatment or exposure is being tested (be specific — e.g. 'Ashwagandha root extract 600mg/day for 12 weeks')",
  "comparator": "what it is compared against (e.g. 'placebo', 'standard care', 'metformin 500mg')",
  "outcome": "what is being measured (e.g. 'HbA1c levels, fasting blood glucose, and quality of life scores at 12 weeks')",
  "confidence": "low/medium/high — based on how much supporting evidence exists",
  "reasoning": "1-2 sentences explaining why this hypothesis is worth testing"
}}
"""


# ─────────────────────────────────────────────
# OLLAMA CALL
# ─────────────────────────────────────────────
def call_ollama(prompt):
    response = requests.post(
        OLLAMA_GENERATE_URL,
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.3,   # slightly more creative than scorer
                "num_predict": 600,
                "num_ctx": 4096,
            },
        },
        timeout=OLLAMA_GENERATE_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def safe_parse_json(raw):
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    start = raw.find("{")
    end   = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start: end + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def is_valid_pico(pico):
    if not isinstance(pico, dict):
        return False
    required = ["population", "intervention", "comparator", "outcome"]
    return all(k in pico and pico[k] for k in required)


def generate_pico(gap, supporting_papers):
    prompt = build_pico_prompt(gap, supporting_papers)

    for attempt in range(1, 4):
        print(f"    Calling Ollama (attempt {attempt}/3)...")
        try:
            data = call_ollama(prompt)
        except requests.Timeout:
            print(f"    Timeout on attempt {attempt}, retrying...")
            continue
        except requests.RequestException as e:
            print(f"    Could not reach Ollama: {e}")
            return None

        raw  = data.get("response", "")
        pico = safe_parse_json(raw)

        if pico and is_valid_pico(pico):
            return pico

        print(f"    Attempt {attempt}: invalid PICO structure, retrying...")
        time.sleep(1)

    print("    Failed to generate valid PICO after 3 attempts.")
    return None


# ─────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────
def run_hypothesis_seeding():
    print("=== RISHI-AI Hypothesis Seeding Pipeline (T13) ===\n")
    print(f"Thresholds: novelty >= {NOVELTY_MIN}, "
          f"feasibility >= {FEASIBILITY_MIN}\n")

    conn = get_conn()
    # ensure_hypothesis_table(conn)

    # Step 1: fetch qualified gaps
    gaps = fetch_qualified_gaps(conn)
    print(f"Found {len(gaps)} gap(s) qualifying for hypothesis seeding.\n")

    if not gaps:
        print("No gaps meet the threshold yet.")
        print(f"Run more topics through research_gap.py and scorer.py,")
        print(f"or lower NOVELTY_MIN/FEASIBILITY_MIN in this file.")
        conn.close()
        return

    # Step 2: generate PICO for each gap
    seeded  = 0
    failed  = 0
    results = []

    for i, gap in enumerate(gaps, start=1):
        print(f"[{i}/{len(gaps)}] {gap['title'][:60]}")
        print(f"  Novelty: {gap['novelty_score']} | "
              f"Feasibility: {gap['feasibility_score']}")

        # Get supporting papers for context
        papers = fetch_supporting_papers(conn, gap["title"])
        print(f"  Supporting papers found: {len(papers)}")

        # Generate PICO
        pico = generate_pico(gap, papers)

        if pico:
            hypothesis_text = save_hypothesis(conn, gap, pico)
            mark_gap_seeded(conn, gap["id"])
            seeded += 1

            results.append({
                "gap_title":        gap["title"],
                "novelty_score":    gap["novelty_score"],
                "feasibility_score": gap["feasibility_score"],
                "pico":             pico,
                "hypothesis":       hypothesis_text,
            })

            print(f"  ✓ P: {pico.get('population', '')[:60]}")
            print(f"  ✓ I: {pico.get('intervention', '')[:60]}")
            print(f"  ✓ C: {pico.get('comparator', '')[:60]}")
            print(f"  ✓ O: {pico.get('outcome', '')[:60]}")
            print(f"  ✓ Confidence: {pico.get('confidence', '')}")
        else:
            failed += 1
            print(f"  ✗ Could not generate PICO for this gap.")

        print()

    conn.close()

    # Step 3: save all results to JSON
    output_path = os.path.join(os.getcwd(), "hypothesis_seeds_output.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    print("=" * 52)
    print(f"Done. Seeded: {seeded}, Failed: {failed}")
    print(f"Results saved to: {output_path}")
    print("\nNext step: Member 5 can now read hypothesis_seeds table")
    print("for the Hypothesis Seeds section of the dashboard.")


if __name__ == "__main__":
    run_hypothesis_seeding()