# api_server.py
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import psycopg2
import psycopg2.extras
import threading
import json as _json
import re
import uuid as uuid_lib
from datetime import datetime
from config import DB_CONFIG

app = FastAPI(title="RISHI-AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_jobs: dict = {}


def get_conn():
    return psycopg2.connect(**DB_CONFIG, cursor_factory=psycopg2.extras.RealDictCursor)


# ── helpers ────────────────────────────────────────────────────
def _build_link(pmid, doi):
    if pmid:
        return f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
    if doi:
        return f"https://doi.org/{str(doi).strip()}"
    return None


def _year_from_row(p):
    if p.get("published_at"):
        try:
            return p["published_at"].year
        except Exception:
            pass
    if p.get("published_date"):
        try:
            m = re.search(r"(19|20)\d{2}", str(p["published_date"]))
            if m:
                return int(m.group(0))
        except Exception:
            pass
    return None


def _snippet(abstract, n=40):
    if not abstract:
        return "No abstract available."
    w = abstract.split()
    return (" ".join(w[:n]) + "...") if len(w) > n else abstract.strip()


def _parse_entities(val):
    """
    related_entities is stored as JSONB.
    New format: categorized dict {"herbs": [...], "chemicals": [...]}
    Old format: flat list ["entity1", "entity2"]
    Returns a dict in all cases.
    """
    try:
        if not val:
            return {}
        data = _json.loads(val) if isinstance(val, str) else val
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if v}
        if isinstance(data, list):
            return {"uncategorized": data} if data else {}
        return {}
    except Exception:
        return {}


def _supporting_papers(cur, source_ids):
    if not source_ids:
        return []
    try:
        cur.execute("""
            SELECT id, title, abstract, pmid, doi,
                   published_at, published_date, citation_count
            FROM papers
            WHERE id = ANY(%s::uuid[])
            ORDER BY published_at DESC NULLS LAST
            LIMIT 15
        """, (source_ids,))
        out = []
        for p in cur.fetchall():
            pmid = p["pmid"]
            doi  = p.get("doi")
            link = _build_link(pmid, doi)
            out.append({
                "id":                    str(p["id"]),
                "title":                 p["title"] or "Untitled",
                "year":                  _year_from_row(p),
                "pmid":                  pmid or "",
                "doi":                   doi or "",
                "link":                  link,
                "paper_url":             link,
                "gap_specific_abstract": _snippet(p["abstract"]),
                "citation_count":        p.get("citation_count"),
            })
        return out
    except Exception as e:
        print(f"  supporting_papers error: {e}")
        return []



def _shape_gap(row, cur):
    n = float(row["novelty_score"])     if row.get("novelty_score")     is not None else None
    f = float(row["feasibility_score"]) if row.get("feasibility_score") is not None else None
    overall = round((n + f) / 2, 1) if n is not None and f is not None else None

    # Prefer the rich, gap-specific detail saved at generation time
    detail = row.get("supporting_papers_detail")
    if detail:
        try:
            papers_data = _json.loads(detail) if isinstance(detail, str) else detail
            supporting = [{
                "id":                    p.get("paper_id", ""),
                "title":                 p.get("title", "Untitled"),
                "year":                  p.get("year"),
                "pmid":                  "",
                "doi":                   p.get("doi", ""),
                "link":                  p.get("paper_url"),
                "paper_url":             p.get("paper_url"),
                "gap_specific_abstract": p.get("gap_specific_abstract", ""),
                "citation_count":        None,
            } for p in papers_data]
        except Exception:
            supporting = _supporting_papers(cur, row.get("source_paper_ids") or [])
    else:
        # Fallback for older gaps saved before this column existed
        supporting = _supporting_papers(cur, row.get("source_paper_ids") or [])

    return {
        "id":                str(row["id"]),
        "gap_id":            row.get("gap_id") or str(row["id"])[:8],
        "topic":             row.get("topic") or "",
        "domain":            (row.get("domain") or "GENERAL").upper(),
        "subdomain":         (row.get("subdomain") or "").upper(),
        "title":             row.get("title") or "",
        "description":       row.get("description") or "",
        "novelty_score":     round(n, 1) if n is not None else None,
        "feasibility_score": round(f, 1) if f is not None else None,
        "overall_score":     overall,
        "study_count":       row.get("study_count") or 0,
        "last_published_year": row.get("last_published_year"),
        "status":            row.get("status") or "scored",
        "related_entities":  _parse_entities(row.get("related_entities")),
        "cluster_distance":  row.get("cluster_distance"),
        "supporting_papers": supporting,
    }


# ── GET /api/health ────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "mode": "full"}


# ── GET /api/gaps ──────────────────────────────────────────────
@app.get("/api/gaps")
def get_gaps(
    domain: Optional[str] = Query(None),
    sort:   str            = Query("novelty"),
    limit:  int            = Query(50),
    topic:  Optional[str]  = Query(None),
):
    # sort column mapping
    sort_col_map = {
        "novelty":           "novelty_score",
        "feasibility":       "feasibility_score",
        "supporting_papers": "study_count",
        "most_recent":       "last_published_year",
        "overall":           "novelty_score",  # fallback; overall computed in Python
    }
    sort_col = sort_col_map.get(sort, "novelty_score")

    conn = get_conn()
    cur  = conn.cursor()
    try:
        conds  = ["g.status IN ('scored','seeded')"]
        params = []
        if domain and domain.lower() not in ("all", "all domains"):
            conds.append("g.domain ILIKE %s"); params.append(f"%{domain}%")
        if topic:
            conds.append("g.topic ILIKE %s"); params.append(f"%{topic}%")
        params.append(limit)

        cur.execute(f"""
            SELECT g.id, g.gap_id, g.title, g.description, g.domain, g.subdomain,
                g.topic, g.novelty_score, g.feasibility_score, g.study_count,
                g.last_published_year, g.status,
                g.source_paper_ids, g.related_entities, g.cluster_distance,
                g.supporting_papers_detail
            FROM gap_candidates g
            WHERE {" AND ".join(conds)}
            ORDER BY {sort_col} DESC NULLS LAST
            LIMIT %s
        """, params)
        rows = cur.fetchall()
        gaps = [_shape_gap(r, cur) for r in rows]

        # client-side sort by overall is approximate above; re-sort here
        if sort == "overall":
            gaps.sort(key=lambda g: (g["overall_score"] or 0), reverse=True)

    except Exception as e:
        cur.close(); conn.close()
        return {"error": str(e), "gaps": [], "total": 0}

    cur.close(); conn.close()
    return {"gaps": gaps, "total": len(gaps)}


# ── GET /api/gaps/domains ──────────────────────────────────────
@app.get("/api/gaps/domains")
def get_domains():
    conn = get_conn(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT DISTINCT UPPER(domain) AS domain FROM gap_candidates
            WHERE status IN ('scored','seeded')
              AND domain IS NOT NULL AND domain != ''
            ORDER BY domain
        """)
        rows = cur.fetchall()
    except Exception:
        cur.close(); conn.close(); return {"domains": []}
    cur.close(); conn.close()
    return {"domains": [r["domain"] for r in rows]}


# ── GET /api/hypotheses ────────────────────────────────────────
@app.get("/api/hypotheses")
def get_hypotheses(
    limit:   int           = Query(50),
    gap_ids: Optional[str] = Query(None),
):
    conn = get_conn(); cur = conn.cursor()
    try:
        if gap_ids:
            id_list = [g.strip() for g in gap_ids.split(",") if g.strip()]
            cur.execute("""
                SELECT id, gap_id, gap_title, population, intervention,
                       comparator, outcome, hypothesis_text, confidence, created_at
                FROM hypothesis_seeds
                WHERE gap_id = ANY(%s::uuid[])
                ORDER BY created_at DESC LIMIT %s
            """, (id_list, limit))
        else:
            cur.execute("""
                SELECT id, gap_id, gap_title, population, intervention,
                       comparator, outcome, hypothesis_text, confidence, created_at
                FROM hypothesis_seeds
                ORDER BY created_at DESC LIMIT %s
            """, (limit,))
        rows = cur.fetchall()
    except Exception as e:
        cur.close(); conn.close()
        return {"error": str(e), "seeds": [], "total": 0}
    cur.close(); conn.close()
    return {
        "seeds": [{
            "id":              str(r["id"]),
            "gap_id":          str(r["gap_id"]) if r["gap_id"] else None,
            "gap_title":       r["gap_title"] or "",
            "population":      r["population"] or "",
            "intervention":    r["intervention"] or "",
            "comparator":      r["comparator"] or "",
            "outcome":         r["outcome"] or "",
            "hypothesis_text": r["hypothesis_text"] or "",
            "confidence":      r["confidence"] or "medium",
            "created_at":      r["created_at"].isoformat() if r["created_at"] else "",
        } for r in rows],
        "total": len(rows),
    }


# ── GET /api/stats ─────────────────────────────────────────────
@app.get("/api/stats")
def get_stats():
    conn = get_conn(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT COUNT(*) FILTER (WHERE status IN ('scored','seeded')) AS gaps,
                   AVG(novelty_score) FILTER (WHERE novelty_score IS NOT NULL) AS avg_novelty
            FROM gap_candidates
        """)
        g = cur.fetchone()
        cur.execute("SELECT COUNT(*) AS c FROM hypothesis_seeds")
        h = cur.fetchone()
    except Exception:
        cur.close(); conn.close()
        return {"gaps_identified": 0, "hypothesis_seeds": 0, "avg_novelty_score": 0.0}
    cur.close(); conn.close()
    return {
        "gaps_identified":   int(g["gaps"] or 0),
        "hypothesis_seeds":  int(h["c"] or 0),
        "avg_novelty_score": round(float(g["avg_novelty"] or 0), 1),
    }


# ── POST /api/search ───────────────────────────────────────────
@app.post("/api/search")
def start_search(body: dict):
    topic = (body.get("topic") or "").strip()
    if not topic:
        return {"error": "topic is required"}

    job_id = str(uuid_lib.uuid4())
    _jobs[job_id] = {
        "status":          "running",
        "topic":           topic,
        "message":         "Starting pipeline...",
        "gaps":            [],
        "research_fronts": [],
        "overall_trend":   {},
        "error":           None,
        "started":         datetime.now().isoformat(),
    }
    threading.Thread(target=_run_pipeline, args=(job_id, topic), daemon=True).start()
    return {"job_id": job_id, "status": "running"}


def _run_pipeline(job_id: str, topic: str):
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    try:
        from research_gap import generate_research_gaps, save_gap_cards_to_db

        def progress_callback(msg):
            _jobs[job_id]["message"] = msg

        result, paper_ids = generate_research_gaps(topic, progress_callback=progress_callback)

        if "error" in result:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"]  = result["error"]
            return

        n_gaps = len(result.get("gap_cards", []))
        _jobs[job_id]["message"] = f"Saving {n_gaps} gaps to database..."
        id_map = save_gap_cards_to_db(result, paper_ids)

        # Scores already computed by the LLM per-gap in research_gap.py —
        # no separate scorer.py pass needed anymore.

        _jobs[job_id]["research_fronts"] = result.get("research_fronts", [])
        _jobs[job_id]["overall_trend"]   = result.get("overall_trend", {})

        # Automatic hypothesis generation — uses the in-memory gap_cards
        # directly, no manual terminal run required.
        from hypothesis import run_hypothesis_for_search

        def hyp_progress(msg):
            _jobs[job_id]["message"] = msg

        hyp_result = run_hypothesis_for_search(
            gap_cards=result.get("gap_cards", []),
            id_map=id_map,
            research_fronts=result.get("research_fronts", []),
            topic=topic,
            progress_callback=hyp_progress,
        )

        gaps = _fetch_gaps_for_topic(topic)
        _jobs[job_id]["status"]  = "done"
        _jobs[job_id]["message"] = (
            f"Done — {len(gaps)} gaps, "
            f"{hyp_result['seeded']} hypotheses generated for '{topic}'"
        )
        _jobs[job_id]["gaps"] = gaps

    except Exception as e:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"]  = str(e)


def _fetch_gaps_for_topic(topic: str) -> list:
    conn = get_conn(); cur = conn.cursor()
    try:
        cur.execute("""
            SELECT g.id, g.gap_id, g.title, g.description, g.domain, g.subdomain,
                g.topic, g.novelty_score, g.feasibility_score, g.study_count,
                g.last_published_year, g.status,
                g.source_paper_ids, g.related_entities, g.cluster_distance,
                g.supporting_papers_detail
            FROM gap_candidates g
            WHERE g.topic ILIKE %s AND g.status IN ('scored','seeded')
            ORDER BY g.novelty_score DESC NULLS LAST
            LIMIT 50
        """, (f"%{topic}%",))
        rows = cur.fetchall()
        gaps = [_shape_gap(r, cur) for r in rows]
    except Exception as e:
        print(f"_fetch_gaps_for_topic error: {e}")
        gaps = []
    cur.close(); conn.close()
    return gaps


# ── GET /api/search/status/{job_id} ───────────────────────────
@app.get("/api/search/status/{job_id}")
def search_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        return {"error": "Job not found"}
    return job