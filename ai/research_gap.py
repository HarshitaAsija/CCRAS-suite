import json
import math
import os
import time
import uuid
from datetime import datetime, timezone

import requests
import psycopg2
from psycopg2 import sql

# -------------------------
# Config
# -------------------------
DB_CONFIG = {
    "host": os.environ.get("CCRAS_DB_HOST", "100.101.210.91"),
    "port": int(os.environ.get("CCRAS_DB_PORT", 5432)),
    "database": os.environ.get("CCRAS_DB_NAME", "ccras_db"),
    "user": os.environ.get("CCRAS_DB_USER", "postgres"),
    "password": os.environ.get("CCRAS_DB_PASSWORD", "Pg1234"),
}

OLLAMA_GENERATE_URL = "http://localhost:11434/api/generate"
OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings"
OLLAMA_MODEL = "mistral"
# Requires: ollama pull nomic-embed-text=
OLLAMA_EMBED_MODEL = "nomic-embed-text"

# CPU inference (no dedicated GPU) can genuinely take several minutes for a
# prompt covering many papers. 180s was too aggressive and was killing
# otherwise-working runs. Override with OLLAMA_TIMEOUT env var if needed.
OLLAMA_GENERATE_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", 600))
OLLAMA_EMBED_TIMEOUT = int(os.environ.get("OLLAMA_EMBED_TIMEOUT", 120))

# Absolute path so the output file is never "lost" in whatever directory
# you happened to run the script from.
OUTPUT_JSON_PATH = os.path.join(os.getcwd(), "research_gaps_output.json")

# Candidate column names to auto-detect in your `papers` table.
YEAR_COLUMN_CANDIDATES = ["year", "published_year", "publication_year", "pub_year"]
PMID_COLUMN_CANDIDATES = ["pmid", "pubmed_id", "pm_id"]


# -------------------------
# DB
# -------------------------
def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def detect_paper_columns(conn):
    """Look at information_schema to find year/PMID columns, if they exist,
    so we don't hardcode a column name that may not match your schema."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = %s",
        ("papers",),
    )
    cols = {r[0].lower() for r in cursor.fetchall()}
    cursor.close()

    year_col = next((c for c in YEAR_COLUMN_CANDIDATES if c in cols), None)
    pmid_col = next((c for c in PMID_COLUMN_CANDIDATES if c in cols), None)
    return year_col, pmid_col


def fetch_papers(topic, limit=8):
    conn = get_conn()
    try:
        year_col, pmid_col = detect_paper_columns(conn)

        query = sql.SQL(
            """
            SELECT id, title, abstract, {year_col}, {pmid_col}
            FROM papers
            WHERE title ILIKE %s
               OR abstract ILIKE %s
            LIMIT %s;
            """
        ).format(
            year_col=sql.Identifier(year_col) if year_col else sql.SQL("NULL"),
            pmid_col=sql.Identifier(pmid_col) if pmid_col else sql.SQL("NULL"),
        )

        cursor = conn.cursor()
        cursor.execute(query, (f"%{topic}%", f"%{topic}%", limit))
        rows = cursor.fetchall()  # (id, title, abstract, year, pmid)
        cursor.close()

        return rows
    finally:
        conn.close()


# -------------------------
# Gap candidates table — the handoff surface for the ML team
# -------------------------
# NOTE: source_paper_ids is TEXT[] rather than UUID[]. Your `papers.id`
# column may be an integer/serial rather than a UUID (your original script
# treated it with str(row[0])), and inserting ints into a UUID[] column
# raises a type error. Storing as text works regardless of the underlying
# id type and is still perfectly queryable/joinable by the ML team.
GAP_CANDIDATES_DDL = """
CREATE TABLE IF NOT EXISTS gap_candidates (
    id UUID PRIMARY KEY,
    gap_id TEXT,
    topic TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    related_entities JSONB,
    source_paper_ids TEXT[],
    study_count INT,
    last_published_year INT,
    cluster_distance FLOAT,      -- gap-strength signal (higher = more novel/less covered)
    novelty_score FLOAT,         -- NULL, filled in later by ML team
    feasibility_score FLOAT,     -- NULL, filled in later by ML team
    status TEXT DEFAULT 'new',   -- new | scored | seeded | discarded
    created_at TIMESTAMP DEFAULT now()
);
"""


def ensure_gap_candidates_table():
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(GAP_CANDIDATES_DDL)
        conn.commit()
        cur.close()
    finally:
        conn.close()


def save_gap_cards_to_db(output, paper_ids):
    """Writes each gap_card from `output` into gap_candidates so the ML team
    can read from Postgres directly instead of needing the JSON file."""
    if "error" in output:
        return 0

    paper_ids_text = [str(pid) for pid in paper_ids]

    conn = get_conn()
    written = 0
    try:
        cur = conn.cursor()
        for card in output["gap_cards"]:
            cur.execute(
                """
                INSERT INTO gap_candidates
                    (id, gap_id, topic, title, description, related_entities,
                     source_paper_ids, study_count, last_published_year, cluster_distance)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    str(uuid.uuid4()),
                    card["gap_id"],
                    output["topic"],
                    card["title"],
                    card["description"],
                    json.dumps(card.get("related_entities", [])),
                    paper_ids_text,
                    card["paper_count"],
                    card.get("last_published_year"),
                    card.get("cluster_distance"),
                ),
            )
            written += 1
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return written


# -------------------------
# Prompt
# -------------------------
def build_prompt(paper_text):
    return f"""You are a senior biomedical research analyst.

Analyze the following research papers and identify research gaps.

Respond with ONLY valid JSON. No markdown, no code fences, no commentary.
Use EXACTLY this structure:

{{
  "research_gaps": [
    {{
      "title": "short title of the gap",
      "description": "1-3 sentence description of the gap",
      "related_entities": ["entity1", "entity2"]
    }}
  ],
  "common_limitations": ["limitation 1", "limitation 2"],
  "unexplored_opportunities": ["opportunity 1", "opportunity 2"],
  "future_directions": ["direction 1", "direction 2"]
}}

Write each list item as a full, natural sentence (not a short label) since these
will be joined into flowing paragraphs for a report.

Papers:
{paper_text}
"""


def call_ollama(prompt):
    response = requests.post(
        OLLAMA_GENERATE_URL,
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",  # ask Ollama to constrain output to valid JSON
            "options": {
                "temperature": 0.2,   # less drift/creativity, more instruction-following
                "num_predict": 900,   # enough for the JSON schema, without excess
                "num_ctx": 4096,      # smaller KV cache — much lighter on CPU/RAM
            },
        },
        timeout=OLLAMA_GENERATE_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def get_embedding(text, model=OLLAMA_EMBED_MODEL):
    """Get an embedding vector from Ollama for a piece of text.
    Returns None on any failure (e.g. embedding model not pulled)."""
    if not text:
        return None
    try:
        response = requests.post(
            OLLAMA_EMBED_URL,
            json={"model": model, "prompt": text},
            timeout=OLLAMA_EMBED_TIMEOUT,
        )
        response.raise_for_status()
        return response.json().get("embedding") or None
    except requests.RequestException:
        return None


def cosine_similarity(a, b):
    if not a or not b or len(a) != len(b):
        return None
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return None
    return dot / (norm_a * norm_b)


def compute_cluster_distance(gap_text, paper_embeddings):
    """Cosine distance between the gap's embedding and the centroid of its
    supporting papers' (already-computed) embeddings. Lower = gap is
    tightly grounded in that paper cluster; higher = more of a stretch /
    potentially more novel. Returns None if embeddings aren't available."""
    gap_emb = get_embedding(gap_text)
    if gap_emb is None or not paper_embeddings:
        return None

    dim = len(paper_embeddings[0])
    centroid = [sum(e[i] for e in paper_embeddings) / len(paper_embeddings) for i in range(dim)]

    sim = cosine_similarity(gap_emb, centroid)
    if sim is None:
        return None
    return round(1 - sim, 4)


def safe_parse_json(raw):
    """Handles cases where the model wraps JSON in code fences or adds
    stray text before/after it. Extracts the outermost {...} block."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start : end + 1]

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def is_valid_result(result):
    """Checks the model actually followed the schema we asked for, rather
    than e.g. echoing the input papers back under different keys."""
    if not isinstance(result, dict):
        return False
    gaps = result.get("research_gaps")
    if not isinstance(gaps, list) or len(gaps) == 0:
        return False
    first = gaps[0]
    return isinstance(first, dict) and "title" in first and "description" in first


# -------------------------
# Core
# -------------------------
def generate_research_gaps(topic):
    rows = fetch_papers(topic)  # each row: (id, title, abstract, year, pmid)
    print(f"Found {len(rows)} papers")
    for row in rows:
        print(f"  - {row[1]}")

    if not rows:
        return {"error": f"No papers found for topic '{topic}'"}, []

    paper_ids = [row[0] for row in rows]

    # Prefer PMID for nearest_papers when available, else fall back to
    # the internal DB id so the field is never empty.
    nearest_papers = [
        f"PMID:{pmid}" if pmid else f"ID:{pid}" for (pid, _, _, _, pmid) in rows
    ]
    years = [year for (_, _, _, year, _) in rows if year]
    last_published_year = max(years) if years else None

    paper_texts = [f"Title: {r[1] or ''}\nAbstract:\n{r[2] or ''}" for r in rows]
    paper_text = "\n\n".join(paper_texts)

    prompt = build_prompt(paper_text)

    result = None
    raw = ""
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        print(f"Calling Ollama (attempt {attempt}/{max_attempts})...")
        call_start = time.time()
        try:
            data = call_ollama(prompt)
        except requests.Timeout:
            print(f"Attempt {attempt}/{max_attempts}: Ollama timed out after "
                  f"{OLLAMA_GENERATE_TIMEOUT}s, retrying...")
            continue
        except requests.RequestException as e:
            # Connection refused etc. — Ollama likely isn't running at all,
            # no point retrying the same failure 3 times.
            return {"error": f"Could not reach Ollama: {e}"}, paper_ids

        elapsed = time.time() - call_start
        print(f"Ollama responded in {elapsed:.1f}s")

        if "error" in data:
            return data, paper_ids

        raw = data.get("response", "")
        candidate = safe_parse_json(raw)

        if candidate is not None and is_valid_result(candidate):
            result = candidate
            break

        print(f"Attempt {attempt}/{max_attempts}: model output didn't match "
              f"the expected schema, retrying...")

    if result is None:
        debug_path = os.path.join(os.getcwd(), "research_gaps_debug_raw.txt")
        with open(debug_path, "w") as f:
            f.write(raw)
        return {
            "error": "Ollama returned invalid JSON after retries",
            "raw_response": raw,
            "debug_file": debug_path,
        }, paper_ids

    research_gaps = result.get("research_gaps", [])
    limitations = result.get("common_limitations", [])
    opportunities = result.get("unexplored_opportunities", [])
    future = result.get("future_directions", [])

    # Compute each paper's embedding ONCE and reuse it for every gap,
    # instead of re-embedding all papers per gap (was ~15 x num_gaps calls,
    # now just ~15 calls total).
    embed_start = time.time()
    paper_embeddings = [e for e in (get_embedding(t) for t in paper_texts) if e]
    print(f"Embeddings computed in {time.time() - embed_start:.1f}s")
    if not paper_embeddings:
        print("Note: no paper embeddings available — cluster_distance will be null "
              "for all gaps. Run `ollama pull nomic-embed-text` to enable this.")

    gap_cards = []
    for gap in research_gaps:
        description = gap.get("description", "")
        cluster_distance = compute_cluster_distance(description, paper_embeddings)

        gap_cards.append(
            {
                "gap_id": "GAP-" + str(uuid.uuid4())[:8],
                "title": (gap.get("title") or "Untitled")[:70],
                "description": description,
                "related_entities": gap.get("related_entities", []),
                "paper_count": len(rows),
                "nearest_papers": nearest_papers,
                "last_published_year": last_published_year,
                "cluster_distance": cluster_distance,
            }
        )

    output = {
        "topic": topic,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "research_gaps": [g.get("description", "") for g in research_gaps],
            "common_limitations": limitations,
            "unexplored_opportunities": opportunities,
            "future_directions": future,
        },
        "gap_cards": gap_cards,
    }
    return output, paper_ids


# -------------------------
# Output
# -------------------------
def _paragraph(items):
    """Join a list of sentences into one flowing paragraph."""
    sentences = [s.strip() for s in items if s and s.strip()]
    return " ".join(sentences) if sentences else "No notable findings identified."


def print_report(output):
    if "error" in output:
        print(f"\nError: {output['error']}")
        if "debug_file" in output:
            print(f"Raw model output saved for inspection at: {output['debug_file']}")
        return

    summary = output["summary"]
    gap_descriptions = [g.get("description", "") for g in output["gap_cards"]]

    print("\n===== RESEARCH GAPS =====")
    print(
        "Based on the given papers, I have identified several key points "
        "regarding their content analysis:\n"
    )

    print("1. Research Gaps:")
    print(_paragraph(gap_descriptions))
    print()

    print("2. Common Limitations:")
    print(_paragraph(summary["common_limitations"]))
    print()

    print("3. Unexplored Opportunities:")
    print(_paragraph(summary["unexplored_opportunities"]))
    print()

    print("4. Future Research Directions:")
    print(_paragraph(summary["future_directions"]))
    print()


def save_json(output, path=OUTPUT_JSON_PATH):
    with open(path, "w") as f:
        json.dump(output, f, indent=2)


if __name__ == "__main__":
    ensure_gap_candidates_table()
    topic = input("Enter topic: ")
    result, paper_ids = generate_research_gaps(topic)

    print_report(result)

    # Always save the JSON, success or error, and always say exactly where.
    save_json(result)
    print(f"Full structured output saved to: {OUTPUT_JSON_PATH}")

    if "error" not in result:
        try:
            n = save_gap_cards_to_db(result, paper_ids)
            print(f"Saved {n} gap card(s) to `gap_candidates` table for the ML team.")
        except Exception as e:
            # A DB hiccup should never make it look like nothing was produced —
            # the JSON file above is already saved and usable regardless.
            print(f"Note: could not write to `gap_candidates` table ({e}). "
                  f"The JSON file above still has everything the ML team needs.")