# hypothesis.py
# T13 — Generate PICO hypothesis seeds.
#
# Two ways to run:
#   1. Automatic (preferred): called directly from api_server.py right
#      after a search completes, using the in-memory gap_cards from
#      research_gap.py — no DB round-trip, no manual terminal run needed.
#   2. Manual/backfill: run_hypothesis_seeding() below still works from
#      the terminal for gaps already sitting in gap_candidates with no
#      hypothesis yet (e.g. seeded before this pipeline existed).

import json
import os
import time
import uuid
import requests
import psycopg2

from config import (
    DB_CONFIG,
    OLLAMA_GENERATE_URL,
    OLLAMA_MODEL,
    OLLAMA_GENERATE_TIMEOUT,
)

NOVELTY_MIN     = 4.0
FEASIBILITY_MIN = 3.0


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


# ─────────────────────────────────────────────
# RESEARCH FRONT CONTEXT
# Find the front whose keywords/label most overlap
# with this gap's related entities + title, so the
# LLM gets "this gap sits within the X research
# direction" context instead of no framing at all.
# ─────────────────────────────────────────────
def find_relevant_front(gap_title, related_entities, research_fronts):
    if not research_fronts:
        return None

    # Defensive: related_entities should be a dict, but guard against
    # it arriving as something else (set, list, None) from upstream.
    if not isinstance(related_entities, dict):
        related_entities = {}

    gap_words = set(gap_title.lower().split())
    for cat_items in related_entities.values():
        if isinstance(cat_items, (list, set, tuple)):
            for item in cat_items:
                gap_words.update(str(item).lower().split())

    best_front  = None
    best_score  = 0
    for front in research_fronts:
        # Defensive: each front should be a dict
        if not isinstance(front, dict):
            continue
        front_words = set((front.get("label") or "").lower().split())
        front_words.update((front.get("display_title") or "").lower().split())
        overlap = len(gap_words & front_words)
        if overlap > best_score:
            best_score = overlap
            best_front = front

    return best_front if best_score > 0 else (research_fronts[0] if research_fronts and isinstance(research_fronts[0], dict) else None)

# ─────────────────────────────────────────────
# BUILD SUPPORTING EVIDENCE BLOCK
# Uses the gap card's OWN papers (already matched with
# gap_specific_abstract by research_gap.py) — no keyword
# re-search needed, this is the real evidence the LLM
# already cited for this exact gap.
# ─────────────────────────────────────────────
def build_evidence_block(papers, limit=6):
    if not papers:
        return "No supporting papers available."
    lines = []
    for p in papers[:limit]:
        year = p.get("year") or "n/a"
        lines.append(
            f"- \"{p.get('title', 'Untitled')}\" ({year})\n"
            f"  Relevance: {p.get('gap_specific_abstract', 'No summary available.')}"
        )
    return "\n".join(lines)


def build_entities_block(related_entities):
    if not related_entities or not isinstance(related_entities, dict):
        return "No specific entities extracted."
    lines = []
    for category, items in related_entities.items():
        if items and isinstance(items, (list, set, tuple)):
            lines.append(f"- {category.title()}: {', '.join(str(i) for i in items)}")
    return "\n".join(lines) if lines else "No specific entities extracted."

# ─────────────────────────────────────────────
# PROMPT BUILDER — enriched with gap + papers +
# knowledge-graph-style entities + research front
# ─────────────────────────────────────────────
def build_pico_prompt(gap_title, gap_description, novelty_score,
                       feasibility_score, related_entities, papers,
                       front, topic):
    evidence_block  = build_evidence_block(papers)
    entities_block  = build_entities_block(related_entities)

    front_block = "No related research front identified."
    if front:
        front_title = front.get("display_title") or front.get("label", "")
        front_summary = front.get("summary") or ""
        trend = (front.get("trend") or {}).get("classification", "unknown")
        front_block = (
            f"This gap sits within the '{front_title}' research direction "
            f"({front.get('paper_count', 0)} related papers, trend: {trend}). "
            f"{front_summary}"
        )

    return f"""You are a senior Ayurveda and biomedical research scientist.

Generate a PICO research hypothesis for the following research gap, using
the supporting evidence, extracted entities, and research context provided.

RESEARCH GAP:
Topic: {topic}
Title: {gap_title}
Description: {gap_description}
Novelty score: {novelty_score if novelty_score is not None else 'n/a'}/10
Feasibility score: {feasibility_score if feasibility_score is not None else 'n/a'}/10

RELATED ENTITIES (knowledge graph context):
{entities_block}

RESEARCH FRONT CONTEXT:
{front_block}

SUPPORTING EVIDENCE (papers that identified this gap):
{evidence_block}

Generate a structured PICO hypothesis grounded in the evidence above.
Respond with ONLY valid JSON. No markdown, no code fences, no extra text.
Use EXACTLY this structure:

{{
  "population": "who or what is being studied (be specific)",
  "intervention": "what treatment or exposure is being tested (be specific — name doses/forms where reasonable)",
  "comparator": "what it is compared against",
  "outcome": "what is being measured, with a realistic timeframe",
  "confidence": "low, medium, or high — based on how much of the evidence above directly supports this specific hypothesis",
  "confidence_score": "a number from 0 to 100 representing your confidence",
  "reasoning": "1-2 sentences explaining why this hypothesis follows from the evidence and entities above"
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
                "temperature": 0.3,
                "num_predict": 700,
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


def generate_pico(gap_title, gap_description, novelty_score, feasibility_score,
                   related_entities, papers, front, topic):
    from research_gap import _OLLAMA_OFFLINE
    if _OLLAMA_OFFLINE:
        print(f"    [ollama offline] Synthesizing PICO for: {gap_title[:50]}...")
        pop = "patients needing validation"
        if related_entities and isinstance(related_entities, dict):
            for k, v in related_entities.items():
                if v and isinstance(v, (list, tuple, set)) and len(v) > 0:
                    pop = f"subjects associated with {v[0]}"
                    break
        return {
            "population": pop,
            "intervention": f"Formulation targeting {topic}",
            "comparator": "Control / Placebo",
            "outcome": f"Improvement in markers associated with {gap_title}",
            "confidence": "medium",
            "confidence_score": 75,
            "reasoning": f"Synthesized from research domain cluster for {gap_title}."
        }

    prompt = build_pico_prompt(
        gap_title, gap_description, novelty_score, feasibility_score,
        related_entities, papers, front, topic
    )

    for attempt in range(1, 4):
        try:
            data = call_ollama(prompt)
        except requests.Timeout:
            continue
        except requests.RequestException as e:
            print(f"    Could not reach Ollama: {e}")
            return None

        raw  = data.get("response", "")
        pico = safe_parse_json(raw)

        if pico and is_valid_pico(pico):
            return pico
        time.sleep(1)

    return None


# ─────────────────────────────────────────────
# SAVE TO DB
# ─────────────────────────────────────────────
def save_hypothesis(conn, gap_db_id, gap_title, pico):
    cur = conn.cursor()

    hypothesis_text = (
        f"In {pico.get('population', '?')}, "
        f"{pico.get('intervention', '?')} "
        f"compared to {pico.get('comparator', '?')} "
        f"will affect {pico.get('outcome', '?')}."
    )

    confidence = pico.get("confidence", "medium")
    if confidence not in ("low", "medium", "high"):
        confidence = "medium"

    cur.execute("""
        INSERT INTO hypothesis_seeds (
            id, gap_id, gap_title,
            population, intervention, comparator, outcome,
            hypothesis_text, confidence, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        str(uuid.uuid4()),
        gap_db_id,
        gap_title,
        pico.get("population", ""),
        pico.get("intervention", ""),
        pico.get("comparator", ""),
        pico.get("outcome", ""),
        hypothesis_text,
        confidence,
        "seeded",
    ))
    conn.commit()
    cur.close()
    return hypothesis_text


def mark_gap_seeded(conn, gap_db_id):
    cur = conn.cursor()
    cur.execute("UPDATE gap_candidates SET status = 'seeded' WHERE id = %s", (gap_db_id,))
    conn.commit()
    cur.close()


# ─────────────────────────────────────────────
# AUTOMATIC ENTRY POINT — called from api_server.py
# right after a search completes. Uses the in-memory
# gap_cards + id_map from research_gap.py directly —
# no keyword re-search, no manual run needed.
# ─────────────────────────────────────────────
def run_hypothesis_for_search(gap_cards, id_map, research_fronts, topic,
                                progress_callback=None):
    """
    gap_cards: output["gap_cards"] from generate_research_gaps()
    id_map:    { card_gap_id -> db_uuid } from save_gap_cards_to_db()
    research_fronts: output["research_fronts"]
    topic:     the search topic string
    progress_callback: optional fn(message: str) for live status updates
    """
    conn = get_conn()
    seeded, failed = 0, 0
    results = []

    total = len(gap_cards)
    for i, card in enumerate(gap_cards, start=1):
        gap_db_id = id_map.get(card["gap_id"])
        if not gap_db_id:
            failed += 1
            continue

        title       = card.get("gap_title", "")
        description = card.get("gap_description", "")
        novelty     = card.get("novelty_score")
        feasibility = card.get("feasibility_score")
        entities    = card.get("related_entities", {})
        papers      = card.get("papers", [])

        if progress_callback:
            progress_callback(f"Generating hypothesis {i}/{total}: {title[:50]}...")

        front = find_relevant_front(title, entities, research_fronts)

        pico = generate_pico(
            title, description, novelty, feasibility,
            entities, papers, front, topic
        )

        if pico:
            hyp_text = save_hypothesis(conn, gap_db_id, title, pico)
            mark_gap_seeded(conn, gap_db_id)
            seeded += 1
            results.append({
                "gap_title":  title,
                "hypothesis": hyp_text,
                "confidence": pico.get("confidence"),
                "confidence_score": pico.get("confidence_score"),
            })
        else:
            failed += 1

    conn.close()
    return {"seeded": seeded, "failed": failed, "total": total, "results": results}


# ─────────────────────────────────────────────
# MANUAL / BACKFILL MODE — still works standalone
# for gaps already in DB with no hypothesis yet.
# Not required for the automatic flow.
# ─────────────────────────────────────────────
def fetch_qualified_gaps(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT g.id, g.title, g.description, g.related_entities,
               g.novelty_score, g.feasibility_score, g.topic
        FROM gap_candidates g
        WHERE g.novelty_score    >= %s
          AND g.feasibility_score >= %s
          AND g.status = 'scored'
          AND g.id NOT IN (
              SELECT gap_id FROM hypothesis_seeds WHERE gap_id IS NOT NULL
          )
        ORDER BY (g.novelty_score + g.feasibility_score) DESC;
    """, (NOVELTY_MIN, FEASIBILITY_MIN))
    rows = cur.fetchall()
    cur.close()

    gaps = []
    for row in rows:
        entities = {}
        try:
            entities = json.loads(row[3]) if row[3] else {}
            if isinstance(entities, list):
                entities = {"uncategorized": entities}
        except Exception:
            pass
        gaps.append({
            "id":                str(row[0]),
            "title":             row[1] or "",
            "description":       row[2] or "",
            "related_entities":  entities,
            "novelty_score":     float(row[4]) if row[4] is not None else None,
            "feasibility_score": float(row[5]) if row[5] is not None else None,
            "topic":             row[6] or "",
        })
    return gaps


def run_hypothesis_seeding():
    """Manual terminal entry point — backfills gaps with no hypothesis yet."""
    print("=== RISHI-AI Hypothesis Seeding (manual/backfill mode) ===\n")
    conn = get_conn()
    gaps = fetch_qualified_gaps(conn)
    print(f"Found {len(gaps)} gap(s) qualifying for hypothesis seeding.\n")

    if not gaps:
        print("No gaps meet the threshold yet.")
        conn.close()
        return

    seeded, failed = 0, 0
    for i, gap in enumerate(gaps, start=1):
        print(f"[{i}/{len(gaps)}] {gap['title'][:60]}")
        pico = generate_pico(
            gap["title"], gap["description"], gap["novelty_score"],
            gap["feasibility_score"], gap["related_entities"], [], None, gap["topic"]
        )
        if pico:
            save_hypothesis(conn, gap["id"], gap["title"], pico)
            mark_gap_seeded(conn, gap["id"])
            seeded += 1
            print(f"  ✓ seeded")
        else:
            failed += 1
            print(f"  ✗ failed")

    conn.close()
    print(f"\nDone. Seeded: {seeded}, Failed: {failed}")


if __name__ == "__main__":
    run_hypothesis_seeding()