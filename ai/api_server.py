# api_server.py
# Run: uvicorn api_server:app --reload --port 8000
# Install: pip install fastapi uvicorn psycopg2-binary

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import psycopg2
import psycopg2.extras
from config import DB_CONFIG

app = FastAPI(title="RISHI-AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_conn():
    return psycopg2.connect(
        **DB_CONFIG,
        cursor_factory=psycopg2.extras.RealDictCursor
    )


# ── GET /api/gaps ──────────────────────────────────────────────
@app.get("/api/gaps")
def get_gaps(
    domain: Optional[str] = Query(None),
    sort:   str            = Query("novelty"),
    limit:  int            = Query(50),
):
    sort_col = "novelty_score" if sort == "novelty" else "feasibility_score"

    conn = get_conn()
    cur  = conn.cursor()

    try:
        if domain and domain.lower() not in ("all", "all domains"):
            cur.execute(f"""
                SELECT id, title, description, domain, subdomain,
                       novelty_score, feasibility_score, study_count, status
                FROM gap_candidates
                WHERE status IN ('scored','seeded')
                  AND domain ILIKE %s
                ORDER BY {sort_col} DESC NULLS LAST
                LIMIT %s
            """, (f"%{domain}%", limit))
        else:
            cur.execute(f"""
                SELECT id, title, description, domain, subdomain,
                       novelty_score, feasibility_score, study_count, status
                FROM gap_candidates
                WHERE status IN ('scored','seeded')
                ORDER BY {sort_col} DESC NULLS LAST
                LIMIT %s
            """, (limit,))

        rows = cur.fetchall()
    except Exception as e:
        cur.close()
        conn.close()
        return {"error": str(e), "gaps": [], "total": 0}

    cur.close()
    conn.close()

    gaps = []
    for row in rows:
        gaps.append({
            "id":                str(row["id"]),
            "domain":            (row["domain"] or "GENERAL").upper(),
            "subdomain":         (row["subdomain"] or "").upper(),
            "title":             row["title"] or "",
            "description":       row["description"] or "",
            "novelty_score":     round(float(row["novelty_score"]), 1)
                                 if row["novelty_score"] is not None else None,
            "feasibility_score": round(float(row["feasibility_score"]), 1)
                                 if row["feasibility_score"] is not None else None,
            "study_count":       row["study_count"] or 0,
            "status":            row["status"] or "scored",
        })

    return {"gaps": gaps, "total": len(gaps)}


# ── GET /api/gaps/domains ──────────────────────────────────────
@app.get("/api/gaps/domains")
def get_domains():
    conn = get_conn()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT DISTINCT UPPER(domain) AS domain
            FROM gap_candidates
            WHERE status IN ('scored','seeded')
              AND domain IS NOT NULL
              AND domain != ''
            ORDER BY domain
        """)
        rows = cur.fetchall()
    except Exception:
        cur.close()
        conn.close()
        return {"domains": []}

    cur.close()
    conn.close()
    return {"domains": [r["domain"] for r in rows]}


# ── GET /api/hypotheses ────────────────────────────────────────
@app.get("/api/hypotheses")
def get_hypotheses(limit: int = Query(50)):
    conn = get_conn()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT id, gap_id, gap_title,
                   population, intervention, comparator, outcome,
                   hypothesis_text, confidence, created_at
            FROM hypothesis_seeds
            ORDER BY created_at DESC
            LIMIT %s
        """, (limit,))
        rows = cur.fetchall()
    except Exception as e:
        cur.close()
        conn.close()
        return {"error": str(e), "seeds": [], "total": 0}

    cur.close()
    conn.close()

    seeds = []
    for row in rows:
        seeds.append({
            "id":              str(row["id"]),
            "gap_id":          str(row["gap_id"]) if row["gap_id"] else None,
            "gap_title":       row["gap_title"] or "",
            "population":      row["population"] or "",
            "intervention":    row["intervention"] or "",
            "comparator":      row["comparator"] or "",
            "outcome":         row["outcome"] or "",
            "hypothesis_text": row["hypothesis_text"] or "",
            "confidence":      row["confidence"] or "medium",
            "created_at":      row["created_at"].isoformat()
                               if row["created_at"] else "",
        })

    return {"seeds": seeds, "total": len(seeds)}


# ── GET /api/stats ─────────────────────────────────────────────
@app.get("/api/stats")
def get_stats():
    conn = get_conn()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE status IN ('scored','seeded')) AS gaps,
                AVG(novelty_score) FILTER (WHERE novelty_score IS NOT NULL) AS avg_novelty
            FROM gap_candidates
        """)
        g = cur.fetchone()

        cur.execute("SELECT COUNT(*) AS c FROM hypothesis_seeds")
        h = cur.fetchone()
    except Exception:
        cur.close()
        conn.close()
        return {"gaps_identified": 0, "hypothesis_seeds": 0, "avg_novelty_score": 0.0}

    cur.close()
    conn.close()

    return {
        "gaps_identified":   int(g["gaps"] or 0),
        "hypothesis_seeds":  int(h["c"] or 0),
        "avg_novelty_score": round(float(g["avg_novelty"] or 0), 1),
    }


# ── add these imports at the top of api_server.py ─────────────
import threading
import uuid as uuid_lib
from datetime import datetime

# In-memory job store — tracks running searches
_jobs: dict = {}

# ── POST /api/search ───────────────────────────────────────────
# Starts a background research job for a topic.
# Returns a job_id to poll with GET /api/search/status/{job_id}
@app.post("/api/search")
def start_search(body: dict):
    topic = (body.get("topic") or "").strip()
    if not topic:
        return {"error": "topic is required"}

    job_id = str(uuid_lib.uuid4())
    _jobs[job_id] = {
        "status":  "running",
        "topic":   topic,
        "message": "Fetching papers...",
        "gaps":    [],
        "error":   None,
        "started": datetime.now().isoformat(),
    }

    # Run the pipeline in a background thread so the HTTP response
    # returns immediately and the frontend can poll for status.
    thread = threading.Thread(
        target=_run_pipeline,
        args=(job_id, topic),
        daemon=True,
    )
    thread.start()

    return {"job_id": job_id, "status": "running"}


def _run_pipeline(job_id: str, topic: str):
    """
    Background thread — runs the full pipeline:
    1. Fetch papers + call Ollama → generate gaps
    2. Insert gaps into DB
    3. Score all gaps
    4. Store results so frontend can retrieve them
    """
    import sys, os
    # Import your existing pipeline functions
    # Adjust the path if api_server.py is not in the same folder as research_gap.py
    sys.path.insert(0, os.path.dirname(__file__))

    try:
        # ── Step 1: generate gaps via Ollama ──────────────────
        _jobs[job_id]["message"] = "Calling Ollama to identify gaps (this takes 1-3 minutes)..."
        from research_gap import generate_research_gaps, save_gap_cards_to_db
        result, paper_ids = generate_research_gaps(topic)

        if "error" in result:
            _jobs[job_id]["status"]  = "error"
            _jobs[job_id]["error"]   = result["error"]
            return

        # ── Step 2: save gaps to DB ───────────────────────────
        _jobs[job_id]["message"] = "Saving gaps to database..."
        _save_gaps_from_result(result, paper_ids)

        # ── Step 3: score all gaps ────────────────────────────
        _jobs[job_id]["message"] = "Scoring gaps for novelty and feasibility..."
        _score_all_gaps()

        # ── Step 4: fetch the new scored gaps to return ───────
        _jobs[job_id]["message"] = "Done"
        gaps = _fetch_gaps_for_topic(topic)
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["gaps"]   = gaps

    except Exception as e:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"]  = str(e)


def _save_gaps_from_result(data: dict, paper_ids: list):
    """Insert gap cards from JSON result into gap_candidates table."""
    import json as _json
    import uuid as _uuid

    topic     = data.get("topic", "unknown")
    gap_cards = data.get("gap_cards", [])
    conn      = get_conn()
    cur       = conn.cursor()

    for card in gap_cards:
        related   = card.get("related_entities", [])
        domain    = related[0] if len(related) > 0 else topic
        subdomain = related[1] if len(related) > 1 else ""
        cd        = card.get("cluster_distance")
        coverage  = round(1.0 - float(cd), 4) if cd is not None else 0.5

        try:
            cur.execute("""
                INSERT INTO gap_candidates (
                    id, gap_id, topic, title, description,
                    domain, subdomain, related_entities,
                    source_paper_ids, study_count,
                    last_published_year, cluster_distance,
                    coverage_score, status
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s::jsonb,
                    %s::uuid[], %s,
                    %s, %s,
                    %s, 'new'
                ) ON CONFLICT DO NOTHING
            """, (
                str(_uuid.uuid4()),
                card.get("gap_id", ""),
                topic,
                card.get("title", "Untitled"),
                card.get("description", ""),
                domain, subdomain,
                _json.dumps(related),
                [],
                card.get("paper_count", 0),
                card.get("last_published_year"),
                cd,
                coverage,
            ))
        except Exception:
            conn.rollback()
            continue

    conn.commit()
    cur.close()
    conn.close()


def _score_all_gaps():
    """Re-run scorer on all unscored gaps."""
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    from scorer import run_scoring
    run_scoring()


def _fetch_gaps_for_topic(topic: str) -> list:
    """Return the freshly scored gaps for this topic."""
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        SELECT id, title, description, domain, subdomain,
               novelty_score, feasibility_score, study_count, status
        FROM gap_candidates
        WHERE topic ILIKE %s
          AND status IN ('scored', 'seeded')
        ORDER BY novelty_score DESC NULLS LAST
        LIMIT 20
    """, (f"%{topic}%",))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [{
        "id":                str(r["id"]),
        "domain":            (r["domain"] or "GENERAL").upper(),
        "subdomain":         (r["subdomain"] or "").upper(),
        "title":             r["title"] or "",
        "description":       r["description"] or "",
        "novelty_score":     round(float(r["novelty_score"]), 1) if r["novelty_score"] else None,
        "feasibility_score": round(float(r["feasibility_score"]), 1) if r["feasibility_score"] else None,
        "study_count":       r["study_count"] or 0,
        "status":            r["status"] or "scored",
    } for r in rows]


# ── GET /api/search/status/{job_id} ───────────────────────────
@app.get("/api/search/status/{job_id}")
def search_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        return {"error": "Job not found"}
    return job