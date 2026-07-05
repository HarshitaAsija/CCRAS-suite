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
OLLAMA_EMBED_MODEL = "nomic-embed-text"

OLLAMA_GENERATE_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", 600))
OLLAMA_EMBED_TIMEOUT = int(os.environ.get("OLLAMA_EMBED_TIMEOUT", 120))

OUTPUT_JSON_PATH = os.path.join(os.getcwd(), "research_gaps_output.json")

YEAR_COLUMN_CANDIDATES = ["year", "published_year", "publication_year", "pub_year"]
PMID_COLUMN_CANDIDATES = ["pmid", "pubmed_id", "pm_id"]


# -------------------------
# Ayurveda + Biomedical Synonym Map
# Maps common/Ayurveda names → list of all known
# scientific names, synonyms, and active compounds.
# Add more entries as you discover missing ones.
# -------------------------
AYURVEDA_SYNONYMS = {
    # ── Core Ayurveda herbs ──
    "turmeric":         ["turmeric", "curcumin", "curcuma longa",
                         "curcuminoid", "haridra"],
    "haridra":          ["haridra", "turmeric", "curcumin",
                         "curcuma longa"],
    "mulethi":          ["mulethi", "licorice", "liquorice",
                         "glycyrrhiza glabra", "glycyrrhizin",
                         "glycyrrhizinic acid", "yashtimadhu"],
    "yashtimadhu":      ["yashtimadhu", "mulethi", "licorice",
                         "glycyrrhiza glabra"],
    "ashwagandha":      ["ashwagandha", "withania somnifera",
                         "withanolide", "withaferin",
                         "indian ginseng"],
    "brahmi":           ["brahmi", "bacopa monnieri", "bacoside",
                         "bacosides", "water hyssop"],
    "neem":             ["neem", "azadirachta indica", "nimbidin",
                         "nimbin", "azadirachtin", "margosa"],
    "giloy":            ["giloy", "guduchi", "tinospora cordifolia",
                         "tinosporin", "heart-leaved moonseed"],
    "guduchi":          ["guduchi", "giloy", "tinospora cordifolia"],
    "amla":             ["amla", "amalaki", "phyllanthus emblica",
                         "emblica officinalis", "indian gooseberry",
                         "emblicanin"],
    "amalaki":          ["amalaki", "amla", "phyllanthus emblica",
                         "emblica officinalis"],
    "shatavari":        ["shatavari", "asparagus racemosus",
                         "shatavarin", "wild asparagus"],
    "triphala":         ["triphala", "haritaki", "bibhitaki",
                         "amalaki", "terminalia chebula",
                         "terminalia bellirica",
                         "phyllanthus emblica"],
    "haritaki":         ["haritaki", "terminalia chebula",
                         "chebulic myrobalan", "chebulagic acid"],
    "tulsi":            ["tulsi", "holy basil", "ocimum sanctum",
                         "ocimum tenuiflorum", "eugenol"],
    "shilajit":         ["shilajit", "mumijo", "mumio",
                         "fulvic acid", "humic acid",
                         "mineral pitch"],
    "guggul":           ["guggul", "commiphora mukul",
                         "guggulsterone", "commiphora wightii"],
    "punarnava":        ["punarnava", "boerhavia diffusa",
                         "boerhavia", "spreading hogweed"],
    "manjistha":        ["manjistha", "rubia cordifolia",
                         "munjistin", "indian madder"],
    "vasaka":           ["vasaka", "adhatoda vasica",
                         "malabar nut", "justicia adhatoda",
                         "vasicine"],
    "karela":           ["karela", "bitter melon",
                         "momordica charantia",
                         "bitter gourd", "charantin"],
    "methi":            ["methi", "fenugreek",
                         "trigonella foenum-graecum",
                         "trigonella", "diosgenin"],
    "ajwain":           ["ajwain", "carom seeds",
                         "trachyspermum ammi",
                         "bishop's weed", "thymol"],
    "kalmegh":          ["kalmegh", "andrographis paniculata",
                         "andrographolide", "king of bitters"],
    "shankhpushpi":     ["shankhpushpi", "convolvulus pluricaulis",
                         "convolvulus prostratus"],
    "jatamansi":        ["jatamansi", "nardostachys jatamansi",
                         "spikenard", "nardostachys"],
    "bhringraj":        ["bhringraj", "eclipta alba",
                         "eclipta prostrata", "wedelolactone"],
    "vidanga":          ["vidanga", "embelia ribes",
                         "embelin", "false black pepper"],
    "pippali":          ["pippali", "long pepper",
                         "piper longum", "piperine"],
    "marich":           ["marich", "black pepper",
                         "piper nigrum", "piperine"],
    "shunthi":          ["shunthi", "ginger", "zingiber officinale",
                         "gingerol", "shogaol", "saunth"],
    "ginger":           ["ginger", "zingiber officinale",
                         "gingerol", "shogaol", "shunthi"],
    "garlic":           ["garlic", "allium sativum",
                         "allicin", "ajoene", "lahsun"],
    "lahsun":           ["lahsun", "garlic", "allium sativum",
                         "allicin"],
    "kutki":            ["kutki", "picrorhiza kurroa",
                         "picrorhiza scrophulariiflora",
                         "kutkin", "picroliv"],
    "saraswatarishta":  ["saraswatarishta", "sarasvatarishta",
                         "brahmi", "bacopa"],
    "dashmool":         ["dashmool", "dashamula",
                         "bael", "aegle marmelos",
                         "oroxylum indicum"],
    "pushkarmool":      ["pushkarmool", "inula racemosa",
                         "inulin", "alantolactone"],
    "arjuna":           ["arjuna", "terminalia arjuna",
                         "arjunolic acid", "arjunetin"],
    "chirata":          ["chirata", "swertia chirata",
                         "swertiamarin", "amarogentin"],

    # ── Panchakarma / treatments ──
    "panchakarma":      ["panchakarma", "virechana", "basti",
                         "nasya", "vamana", "raktamokshana",
                         "ayurvedic detoxification"],
    "virechana":        ["virechana", "therapeutic purgation",
                         "panchakarma"],
    "basti":            ["basti", "enema therapy",
                         "ayurvedic enema", "panchakarma"],

    # ── Rasayana category ──
    "rasayana":         ["rasayana", "rejuvenation therapy",
                         "adaptogen", "ayurvedic tonic"],
    "medhya":           ["medhya", "medhya rasayana",
                         "nootropic", "cognitive enhancer",
                         "brain tonic"],

    # ── Common biomedical terms that often co-occur ──
    "nanoparticle":     ["nanoparticle", "nanoparticles",
                         "nanomedicine", "nano formulation",
                         "nanoencapsulation", "liposome"],
    "inflammation":     ["inflammation", "inflammatory",
                         "anti-inflammatory", "cytokine",
                         "cox-2", "tnf-alpha", "interleukin"],
    "diabetes":         ["diabetes", "diabetic",
                         "hyperglycemia", "insulin resistance",
                         "type 2 diabetes", "glycemic"],
    "cancer":           ["cancer", "tumor", "tumour",
                         "carcinoma", "oncology", "neoplasm",
                         "apoptosis", "anticancer"],
    "arthritis":        ["arthritis", "osteoarthritis",
                         "rheumatoid arthritis", "joint inflammation",
                         "synovitis"],
    "anxiety":          ["anxiety", "anxiolytic", "stress",
                         "cortisol", "adaptogen", "gaba"],
    "depression":       ["depression", "antidepressant",
                         "serotonin", "dopamine", "mood disorder"],
    "alzheimer":        ["alzheimer", "dementia",
                         "cognitive decline", "amyloid",
                         "neurodegeneration", "acetylcholinesterase"],
    "hypertension":     ["hypertension", "blood pressure",
                         "antihypertensive", "vasodilation",
                         "cardiovascular"],
    "obesity":          ["obesity", "weight loss", "adipose",
                         "lipid metabolism", "antiobesity",
                         "bmi"],
    "liver":            ["liver", "hepato", "hepatoprotective",
                         "hepatotoxicity", "nafld",
                         "liver fibrosis"],
    "kidney":           ["kidney", "renal", "nephro",
                         "nephroprotective", "glomerular"],
    "antimicrobial":    ["antimicrobial", "antibacterial",
                         "antifungal", "antiviral",
                         "antibiotic", "pathogen"],
    "antioxidant":      ["antioxidant", "free radical",
                         "oxidative stress", "reactive oxygen",
                         "superoxide dismutase"],
    "wound":            ["wound", "wound healing",
                         "skin repair", "collagen synthesis",
                         "cicatrization"],
    "sleep":            ["sleep", "insomnia", "sedative",
                         "hypnotic", "sleep disorder",
                         "polysomnography"],
    "immunity":         ["immunity", "immune", "immunomodulatory",
                         "immunostimulant", "nk cells",
                         "macrophage"],
    "gut":              ["gut", "microbiome", "gut microbiota",
                         "probiotic", "prebiotic",
                         "gastrointestinal", "dysbiosis"],
}


def get_search_terms(topic):
    """
    Returns a list of search terms for a given topic.

    Priority order:
    1. Direct match in synonym map
    2. Partial match (e.g. user typed "curcumin" matches turmeric)
    3. Multi-word topic — expand each word separately
       e.g. "turmeric diabetes" → curcumin synonyms + diabetes synonyms
    4. No match — use topic as-is (works for all general biomedical terms)
    """
    topic_lower = topic.lower().strip()

    # 1. Direct match
    if topic_lower in AYURVEDA_SYNONYMS:
        terms = AYURVEDA_SYNONYMS[topic_lower]
        print(f"  [synonym] Direct match: {terms}")
        return terms

    # 2. Partial match — catches scientific names typed directly
    #    e.g. "withania" matches "ashwagandha"
    for key, synonyms in AYURVEDA_SYNONYMS.items():
        if topic_lower in key or key in topic_lower:
            print(f"  [synonym] Partial match on key '{key}': {synonyms}")
            return synonyms
        if any(topic_lower in s or s in topic_lower for s in synonyms):
            print(f"  [synonym] Partial match in synonyms of '{key}': {synonyms}")
            return synonyms

    # 3. Multi-word topic — expand each word individually
    words = topic_lower.split()
    if len(words) > 1:
        expanded = []
        for word in words:
            if len(word) <= 3:      # skip short words like "of", "in"
                continue
            matched = False
            if word in AYURVEDA_SYNONYMS:
                expanded.extend(AYURVEDA_SYNONYMS[word])
                matched = True
            else:
                for key, synonyms in AYURVEDA_SYNONYMS.items():
                    if word in key or key in word:
                        expanded.extend(synonyms)
                        matched = True
                        break
                    if any(word in s or s in word for s in synonyms):
                        expanded.extend(synonyms)
                        matched = True
                        break
            if not matched:
                expanded.append(word)   # keep the word as-is

        if expanded:
            deduped = list(dict.fromkeys(expanded))   # deduplicate, preserve order
            print(f"  [synonym] Multi-word expansion: {deduped}")
            return deduped

    # 4. No match — direct search (works for all standard biomedical terms)
    print(f"  [no synonym] Searching directly for: '{topic_lower}'")
    return [topic_lower]


# -------------------------
# DB
# -------------------------
def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def detect_paper_columns(conn):
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


def fetch_papers(topic, limit=100):   # ← increased from 8 to 100
    conn = get_conn()
    try:
        year_col, pmid_col = detect_paper_columns(conn)

        # Get all search terms (Ayurveda synonyms + biomedical expansion)
        search_terms = get_search_terms(topic)
        print(f"  Searching {len(search_terms)} term(s) across {limit} paper limit...")

        # Build dynamic OR conditions — each term checks title AND abstract
        conditions = " OR ".join(
            ["(title ILIKE %s OR abstract ILIKE %s)"] * len(search_terms)
        )

        query = sql.SQL(
            """
            SELECT id, title, abstract, {year_col}, {pmid_col}
            FROM papers
            WHERE {conditions}
            LIMIT %s;
            """
        ).format(
            year_col=sql.Identifier(year_col) if year_col
                     else sql.SQL("NULL"),
            pmid_col=sql.Identifier(pmid_col) if pmid_col
                     else sql.SQL("NULL"),
            conditions=sql.SQL(conditions),
        )

        # Each term needs 2 params (title ILIKE + abstract ILIKE)
        params = []
        for term in search_terms:
            params.extend([f"%{term}%", f"%{term}%"])
        params.append(limit)

        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        cursor.close()

        return rows
    finally:
        conn.close()


# -------------------------
# Gap candidates table
# -------------------------
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
    cluster_distance FLOAT,
    novelty_score FLOAT,
    feasibility_score FLOAT,
    status TEXT DEFAULT 'new',
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
            "format": "json",
            "options": {
                "temperature": 0.2,
                "num_predict": 900,
                "num_ctx": 4096,
            },
        },
        timeout=OLLAMA_GENERATE_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def get_embedding(text, model=OLLAMA_EMBED_MODEL):
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
    gap_emb = get_embedding(gap_text)
    if gap_emb is None or not paper_embeddings:
        return None

    dim = len(paper_embeddings[0])
    centroid = [
        sum(e[i] for e in paper_embeddings) / len(paper_embeddings)
        for i in range(dim)
    ]

    sim = cosine_similarity(gap_emb, centroid)
    if sim is None:
        return None
    return round(1 - sim, 4)


def safe_parse_json(raw):
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start: end + 1]

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def is_valid_result(result):
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
    rows = fetch_papers(topic)
    print(f"Found {len(rows)} papers")
    for row in rows:
        print(f"  - {row[1]}")

    if not rows:
        # Give a helpful message with suggestions
        print(f"\nNo papers found for '{topic}'.")
        print("Try a synonym or scientific name. Examples:")
        print("  turmeric → also try: curcumin, curcuma longa")
        print("  mulethi  → also try: glycyrrhiza glabra, licorice")
        print("  ashwagandha → also try: withania somnifera")
        return {"error": f"No papers found for topic '{topic}'"}, []

    paper_ids = [row[0] for row in rows]

    nearest_papers = [
        f"PMID:{pmid}" if pmid else f"ID:{pid}"
        for (pid, _, _, _, pmid) in rows
    ]
    years = [year for (_, _, _, year, _) in rows if year]
    last_published_year = max(years) if years else None

    paper_texts = [
        f"Title: {r[1] or ''}\nAbstract:\n{r[2] or ''}" for r in rows
    ]
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

    embed_start = time.time()
    paper_embeddings = [
        e for e in (get_embedding(t) for t in paper_texts) if e
    ]
    print(f"Embeddings computed in {time.time() - embed_start:.1f}s")
    if not paper_embeddings:
        print("Note: no paper embeddings available — cluster_distance will be null. "
              "Run `ollama pull nomic-embed-text` to enable this.")

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

    save_json(result)
    print(f"Full structured output saved to: {OUTPUT_JSON_PATH}")

    if "error" not in result:
        try:
            n = save_gap_cards_to_db(result, paper_ids)
            print(f"Saved {n} gap card(s) to `gap_candidates` table for the ML team.")
        except Exception as e:
            print(f"Note: could not write to `gap_candidates` table ({e}). "
                  f"The JSON file above still has everything the ML team needs.")