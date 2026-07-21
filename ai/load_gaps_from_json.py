# load_gaps_from_json.py
import json
import uuid
import os
import re
import psycopg2
import sys
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


# ─────────────────────────────────────────────
# LOAD JSON FILE
# ─────────────────────────────────────────────
def load_json(path):
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return None
    with open(path) as f:
        return json.load(f)


# ─────────────────────────────────────────────
# INSERT GAPS INTO DB
# ─────────────────────────────────────────────
def insert_gaps(data):
    if not data or "error" in data:
        print("JSON has error or is empty:", data.get("error") if data else "no data")
        return

    topic = data.get("topic", "unknown")
    gap_cards = data.get("gap_cards", [])

    if not gap_cards:
        print("No gap cards found in JSON.")
        return

    conn = get_conn()
    cur = conn.cursor()
    inserted = 0
    skipped = 0

    for card in gap_cards:
        title           = card.get("title", "Untitled")
        description     = card.get("description", "")
        related         = card.get("related_entities", [])
        study_count     = card.get("paper_count", 0)
        cluster_distance = card.get("cluster_distance")

        # Map related entities → domain / subdomain
        # First entity = domain, second = subdomain
        # Falls back to topic if no entities
        domain    = related[0] if len(related) > 0 else topic
        subdomain = related[1] if len(related) > 1 else ""

        # coverage_score: invert cluster_distance
        # cluster_distance: higher = more novel = less covered
        # So coverage = 1 - cluster_distance
        if cluster_distance is not None:
            coverage_score = round(1.0 - float(cluster_distance), 4)
        else:
            coverage_score = 0.5   # neutral default when embedding wasn't available

        try:
            cur.execute("""
                INSERT INTO gap_candidates (
                    id,
                    title,
                    description,
                    domain,
                    subdomain,
                    source_paper_ids,
                    study_count,
                    coverage_score,
                    status
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s::uuid[],
                    %s, %s, %s
                )
                ON CONFLICT DO NOTHING
            """, (
                str(uuid.uuid4()),   # fresh UUID for each gap
                title,
                description,
                domain,
                subdomain,
                [],                  # empty uuid[] — scorer.py doesn't need these
                study_count,
                coverage_score,
                'new'                # scorer.py will update this to 'scored'
            ))
            inserted += 1

        except Exception as e:
            print(f"  Skipped '{title[:50]}': {e}")
            conn.rollback()
            skipped += 1
            continue

    conn.commit()
    cur.close()
    conn.close()

    print(f"\nDone. Inserted: {inserted}, Skipped: {skipped}")
    if inserted > 0:
        print("Next step: run  python3 scorer.py  to fill novelty + feasibility scores.")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────



if __name__ == "__main__":
    # Priority 1: path passed as command line argument
    # Usage: python3 load_gaps_from_json.py /path/to/research_gaps_output.json
    if len(sys.argv) > 1:
        json_path = sys.argv[1]

    # Priority 2: environment variable
    # export GAPS_JSON_PATH=/your/path/research_gaps_output.json
    elif os.environ.get("GAPS_JSON_PATH"):
        json_path = os.environ["GAPS_JSON_PATH"]

    # Priority 3: look in the same folder as this script
    # Works for everyone if research_gap.py and load_gaps_from_json.py
    # are in the same folder — which they are (both in ml/)
    else:
        json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 "research_gaps_output.json")

    print(f"Reading from: {json_path}")
    data = load_json(json_path)
    if data:
        topic = data.get("topic", "?")
        count = len(data.get("gap_cards", []))
        print(f"Found {count} gap cards for topic: '{topic}'")
        insert_gaps(data)