import json
import math
import os
import random
import re
import time
import uuid
import difflib
from datetime import datetime, timezone
 
import requests
import psycopg2
from psycopg2 import sql
 
import matplotlib
matplotlib.use("Agg")  # no display available / needed -- just rendering to PNG
import matplotlib.pyplot as plt
 
from config import (
    DB_CONFIG,
    OLLAMA_GENERATE_URL,
    OLLAMA_EMBED_URL,
    OLLAMA_MODEL,
    OLLAMA_EMBED_MODEL,
    OLLAMA_GENERATE_TIMEOUT,
    OLLAMA_EMBED_TIMEOUT,
)
 
OUTPUT_JSON_PATH = os.path.join(os.getcwd(), "research_gaps_output.json")
# NEW: single PNG holding the overall trend chart + one chart per research
# front, stacked as subplots. One file, not a folder of per-front images.
TREND_CHART_PATH = os.path.join(os.getcwd(), "research_trends.png")
# NEW: HTML report with each gap as a collapsible section showing its
# supporting sources in a dropdown, per the "show sources" / "collapsable
# dropdown tabs" request.
HTML_REPORT_PATH = os.path.join(os.getcwd(), "research_gaps_report.html")
 
# NOTE: your `papers` table has no plain `year` column -- it has
# `published_date` / `publication_date` (text/timestamp). We detect
# whichever exists and pull the year out of it in Python (see
# `_extract_year`) since its format isn't guaranteed to be a clean int.
YEAR_COLUMN_CANDIDATES = [
    "year", "published_year", "publication_year", "pub_year",
    "published_date", "publication_date",
]
PMID_COLUMN_CANDIDATES = ["pmid", "pubmed_id", "pm_id"]
# NEW: used as a fallback link when a paper has no PMID.
DOI_COLUMN_CANDIDATES = ["doi"]
 
# ─────────────────────────────────────────────
# BATCH CONFIG
# TOTAL_PAPERS: how many papers to fetch from DB
# BATCH_SIZE:   how many papers per Ollama call
# Tune BATCH_SIZE to what your laptop handles —
# 8 is safe for most MacBooks.
# ─────────────────────────────────────────────
TOTAL_PAPERS = 80
BATCH_SIZE   = 8
 
# NEW: how many words of the abstract to keep for the lightweight, non-LLM
# "papers" summary block (title + link + snippet) added to the output.
ABSTRACT_SUMMARY_WORD_LIMIT = int(os.environ.get("GAP_ABSTRACT_SUMMARY_WORDS", 40))
 
PUBMED_URL_TEMPLATE = "https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
 
# -------------------------
# Ayurveda + Biomedical Synonym Map
# -------------------------
AYURVEDA_SYNONYMS = {
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
    "panchakarma":      ["panchakarma", "virechana", "basti",
                         "nasya", "vamana", "raktamokshana",
                         "ayurvedic detoxification"],
    "virechana":        ["virechana", "therapeutic purgation",
                         "panchakarma"],
    "basti":            ["basti", "enema therapy",
                         "ayurvedic enema", "panchakarma"],
    "rasayana":         ["rasayana", "rejuvenation therapy",
                         "adaptogen", "ayurvedic tonic"],
    "medhya":           ["medhya", "medhya rasayana",
                         "nootropic", "cognitive enhancer",
                         "brain tonic"],
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
    topic_lower = topic.lower().strip()
 
    if topic_lower in AYURVEDA_SYNONYMS:
        terms = AYURVEDA_SYNONYMS[topic_lower]
        print(f"  [synonym] Direct match: {terms}")
        return terms
 
    for key, synonyms in AYURVEDA_SYNONYMS.items():
        if topic_lower in key or key in topic_lower:
            print(f"  [synonym] Partial match on key '{key}': {synonyms}")
            return synonyms
        if any(topic_lower in s or s in topic_lower for s in synonyms):
            print(f"  [synonym] Partial match in synonyms of '{key}': {synonyms}")
            return synonyms
 
    words = topic_lower.split()
    if len(words) > 1:
        expanded = []
        for word in words:
            if len(word) <= 3:
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
                expanded.append(word)
 
        if expanded:
            deduped = list(dict.fromkeys(expanded))
            print(f"  [synonym] Multi-word expansion: {deduped}")
            return deduped
 
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
    doi_col = next((c for c in DOI_COLUMN_CANDIDATES if c in cols), None)
    return year_col, pmid_col, doi_col
 
 
# -------------------------
# NEW: paper links + lightweight papers summary
# -------------------------
DOI_URL_TEMPLATE = "https://doi.org/{doi}"
 
_YEAR_RE = re.compile(r"(19|20)\d{2}")
 
 
def _extract_year(raw_value):
    """`published_date`/`publication_date` can be an int, a datetime, or a
    free-text string ("2023-05-01", "May 2023", etc.) depending on how a
    row was ingested. Pull a 4-digit year out of whatever we got rather
    than assuming a clean int column.
    """
    if raw_value is None:
        return None
    if isinstance(raw_value, int):
        return raw_value
    if isinstance(raw_value, datetime):
        return raw_value.year
    if hasattr(raw_value, "year"):  # date objects
        return raw_value.year
    match = _YEAR_RE.search(str(raw_value))
    return int(match.group(0)) if match else None
 
 
def build_paper_link(pid, pmid, doi=None):
    """Best-effort link to the source paper.
 
    Priority: PMID -> PubMed link, else DOI -> doi.org link, else None.
    Many rows in this DB have an empty/NULL `pmid`, so without the DOI
    fallback almost every paper showed "no link available" even when a
    DOI was on file. There's no public URL we can construct from an
    internal `papers.id` alone, so if neither is present we report None
    rather than guessing.
    """
    if pmid:
        return PUBMED_URL_TEMPLATE.format(pmid=pmid)
    if doi:
        return DOI_URL_TEMPLATE.format(doi=str(doi).strip())
    return None
 
 
def _abstract_snippet(abstract, word_limit=ABSTRACT_SUMMARY_WORD_LIMIT):
    if not abstract:
        return "No abstract available."
    words = abstract.split()
    if len(words) <= word_limit:
        return abstract.strip()
    return " ".join(words[:word_limit]).strip() + "..."
 
 
def build_papers_summary(rows):
    """Turns raw DB rows into a plain, non-LLM summary block: one entry per
    paper with its title, year, a short abstract snippet, and a link
    (PubMed if a PMID is available, DOI otherwise). Cheap -- no model or
    embedding calls.
    """
    papers = []
    for pid, title, abstract, year_raw, pmid, doi in rows:
        papers.append(
            {
                "id": str(pid),
                "pmid": pmid,
                "doi": doi,
                "title": title or "Untitled",
                "year": _extract_year(year_raw),
                "link": build_paper_link(pid, pmid, doi),
                "summary": _abstract_snippet(abstract),
            }
        )
    return papers
 
 
def build_paper_id_links(rows):
    """Minimal id -> link mapping for EVERY paper fetched from the DB for
    this topic run (not just the ones behind a particular gap). This is
    the flat list requested for auditing/citation purposes: every paper_id
    the pipeline pulled in, alongside whatever link we could construct
    for it (PubMed if it has a PMID, DOI otherwise, else null).
    """
    return [
        {
            "id": str(pid),
            "pmid": pmid,
            "doi": doi,
            "link": build_paper_link(pid, pmid, doi),
        }
        for pid, _title, _abstract, _year_raw, pmid, doi in rows
    ]
 
 
# ─────────────────────────────────────────────
# FETCH ALL PAPERS + SPLIT INTO BATCHES
# ─────────────────────────────────────────────
def fetch_papers_batched(topic):
    """
    Fetch TOTAL_PAPERS from DB using synonym expansion,
    then split into BATCH_SIZE chunks for Ollama.
    Returns (all_rows, list_of_batches).
    """
    conn = get_conn()
    try:
        year_col, pmid_col, doi_col = detect_paper_columns(conn)
        search_terms = get_search_terms(topic)
        print(f"  Fetching up to {TOTAL_PAPERS} papers using "
              f"{len(search_terms)} search term(s)...")
 
        conditions = " OR ".join(
            ["(title ILIKE %s OR abstract ILIKE %s)"] * len(search_terms)
        )
 
        query = sql.SQL("""
            SELECT id, title, abstract, {year_col}, {pmid_col}, {doi_col}
            FROM papers
            WHERE {conditions}
            {order_clause}
            LIMIT %s;
        """).format(
            year_col=sql.Identifier(year_col) if year_col else sql.SQL("NULL"),
            pmid_col=sql.Identifier(pmid_col) if pmid_col else sql.SQL("NULL"),
            doi_col=sql.Identifier(doi_col) if doi_col else sql.SQL("NULL"),
            conditions=sql.SQL(conditions),
            # NEW: previously there was no ORDER BY at all, so LIMIT just
            # grabbed whatever 80 rows Postgres returned first for the
            # matching WHERE clause -- not the "top" or most relevant 80 by
            # any real measure, just an arbitrary DB-order slice. This sorts
            # by the detected year column (most recent first, NULLs last)
            # so the fetched set is at least consistently the newest papers
            # matching the topic, rather than random.
            order_clause=(
                sql.SQL("ORDER BY {} DESC NULLS LAST").format(sql.Identifier(year_col))
                if year_col else sql.SQL("")
            ),
        )
 
        params = []
        for term in search_terms:
            params.extend([f"%{term}%", f"%{term}%"])
        params.append(TOTAL_PAPERS)
 
        cursor = conn.cursor()
        cursor.execute(query, params)
        all_rows = cursor.fetchall()
        cursor.close()
 
        print(f"  Found {len(all_rows)} papers total.")
 
        # Split into batches of BATCH_SIZE
        batches = [
            all_rows[i: i + BATCH_SIZE]
            for i in range(0, len(all_rows), BATCH_SIZE)
        ]
        print(f"  Split into {len(batches)} batch(es) "
              f"of up to {BATCH_SIZE} papers each.")
        return all_rows, batches
 
    finally:
        conn.close()
 
 
# ─────────────────────────────────────────────
# Keep old fetch_papers for backward compat
# (api_server.py import may call it)
# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
# NEW: full-population year fetch, separate from the capped/sorted fetch
# above. fetch_papers_batched now sorts by recency and caps at
# TOTAL_PAPERS -- great for feeding recent papers to the LLM, but it means
# older matching papers are systematically excluded from that result set.
# If the overall trend chart were computed from that same capped set, older
# years would look artificially thin/empty -- not because publishing on the
# topic actually declined, but because we deliberately only fetched recent
# rows. This queries just the year column (not full title/abstract) across
# EVERY matching paper, so trend detection reflects the true population.
# ─────────────────────────────────────────────
def fetch_all_years_for_topic(topic):
    conn = get_conn()
    try:
        year_col, _pmid_col, _doi_col = detect_paper_columns(conn)
        if not year_col:
            return []
 
        search_terms = get_search_terms(topic)
        conditions = " OR ".join(
            ["(title ILIKE %s OR abstract ILIKE %s)"] * len(search_terms)
        )
        query = sql.SQL("""
            SELECT {year_col}
            FROM papers
            WHERE {conditions};
        """).format(
            year_col=sql.Identifier(year_col),
            conditions=sql.SQL(conditions),
        )
        params = []
        for term in search_terms:
            params.extend([f"%{term}%", f"%{term}%"])
 
        cursor = conn.cursor()
        cursor.execute(query, params)
        raw_values = [r[0] for r in cursor.fetchall()]
        cursor.close()
 
        return [y for y in (_extract_year(v) for v in raw_values) if y]
    finally:
        conn.close()
 
 
def fetch_papers(topic, limit=BATCH_SIZE):
    conn = get_conn()
    try:
        year_col, pmid_col, doi_col = detect_paper_columns(conn)
        search_terms = get_search_terms(topic)
 
        conditions = " OR ".join(
            ["(title ILIKE %s OR abstract ILIKE %s)"] * len(search_terms)
        )
        query = sql.SQL("""
            SELECT id, title, abstract, {year_col}, {pmid_col}, {doi_col}
            FROM papers
            WHERE {conditions}
            {order_clause}
            LIMIT %s;
        """).format(
            year_col=sql.Identifier(year_col) if year_col else sql.SQL("NULL"),
            pmid_col=sql.Identifier(pmid_col) if pmid_col else sql.SQL("NULL"),
            doi_col=sql.Identifier(doi_col) if doi_col else sql.SQL("NULL"),
            conditions=sql.SQL(conditions),
            order_clause=(
                sql.SQL("ORDER BY {} DESC NULLS LAST").format(sql.Identifier(year_col))
                if year_col else sql.SQL("")
            ),
        )
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
def save_gap_cards_to_db(output, paper_ids):
    if "error" in output:
        return 0
 
    conn    = get_conn()
    written = 0
    try:
        cur = conn.cursor()
        for card in output["gap_cards"]:
 
            papers_list = card.get("papers", [])
            support_ids = [p["paper_id"] for p in papers_list if p.get("paper_id")]
 
            try:
                cur.execute("""
                    INSERT INTO gap_candidates (
                        id, gap_id, topic, title, description,
                        related_entities, source_paper_ids,
                        study_count, last_published_year,
                        cluster_distance, status
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s::jsonb, %s::uuid[],
                        %s, %s, %s, 'new'
                    )
                    ON CONFLICT DO NOTHING
                """, (
                    str(uuid.uuid4()),
                    card["gap_id"],
                    output["topic"],
                    card["gap_title"],
                    card["gap_description"],
                    # related_entities is now a categorized dict (e.g.
                    # {"herbs": [...], "chemicals": [...]}) rather than a
                    # flat list -- json.dumps handles either shape fine,
                    # and the DB column is jsonb so no schema change needed.
                    json.dumps(card.get("related_entities", {})),
                    support_ids,
                    card.get("supporting_paper_count", len(support_ids)),
                    card.get("most_recent_year"),
                    # NOTE: novelty_score/feasibility_score/overall_score
                    # aren't stored yet -- gap_candidates has no columns for
                    # them. cluster_distance is no longer computed (we
                    # stopped calling compute_cluster_distance per gap), so
                    # this column gets NULL until/unless you add real score
                    # columns via ALTER TABLE and this write is updated to
                    # match.
                    None,
                ))
                written += 1
            except Exception as e:
                conn.rollback()
                print(f"  Skipped '{card.get('gap_title','')[:40]}': {e}")
                continue
 
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return written
 
 
# -------------------------
# Prompt + Ollama
# -------------------------
def build_prompt(paper_text):
    return f"""You are a senior biomedical research analyst.
 
Analyze the following research papers and identify research gaps.
 
For each gap's "title": write a short, meaningful, academic-style title
(4-10 words) that a researcher could scan and immediately understand, e.g.
"Explainable AI for Diabetes Diagnosis" or "Standardization of Curcumin
Extraction Methods". NEVER use a generic placeholder like "Gap 1", and
NEVER just dump keywords as the title (e.g. do not write "turmeric,
curcumin, extraction" as a title).
 
For each gap, rate:
- "novelty_score": how novel/underexplored this gap is, on a 0-10 scale (10 = highly novel and unexplored)
- "feasibility_score": how feasible it would be to address this gap with current methods, on a 0-10 scale
 
For each gap, extract "related_entities" GROUPED BY CATEGORY. Only include
categories that actually apply -- omit empty ones. Valid categories:
"diseases", "herbs", "drugs", "biomarkers", "methods", "datasets", "genes",
"chemicals". Example: {{"herbs": ["Turmeric"], "chemicals": ["Curcumin"],
"methods": ["HPLC"]}}
 
For each gap, list which of the papers above specifically support it, under
"supporting_evidence". For each entry:
- "paper_title" MUST be copied EXACTLY (verbatim, character-for-character)
  from one of the "Title:" lines below -- do not paraphrase, shorten, or
  invent titles.
- "gap_specific_abstract": 2-3 sentences explaining (a) why this specific
  paper supports this gap, (b) what limitation it identifies, and (c) how
  it contributes to understanding the gap. Write this as one flowing
  summary, not a list.
 
Respond with ONLY valid JSON. No markdown, no code fences, no commentary.
Use EXACTLY this structure:
 
{{
  "research_gaps": [
    {{
      "title": "short, meaningful, academic-style title (never 'Gap 1' or a keyword dump)",
      "description": "1-3 sentence description of the gap",
      "related_entities": {{"herbs": ["..."], "chemicals": ["..."], "diseases": ["..."], "drugs": ["..."], "biomarkers": ["..."], "methods": ["..."], "datasets": ["..."], "genes": ["..."]}},
      "novelty_score": 0,
      "feasibility_score": 0,
      "supporting_evidence": [
        {{
          "paper_title": "<exact title copied from a Title: line below>",
          "gap_specific_abstract": "..."
        }}
      ]
    }}
  ],
  "common_limitations": ["limitation 1", "limitation 2"],
  "unexplored_opportunities": ["opportunity 1", "opportunity 2"],
  "future_directions": ["direction 1", "direction 2"]
}}
 
Write each list item as a full, natural sentence (not a short label).
 
Papers:
{paper_text}
"""
 
 
def call_ollama(prompt):
    response = requests.post(
        OLLAMA_GENERATE_URL,
        json={
            "model":  OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.2,
                "num_predict": 900,
                "num_ctx":     4096,
            },
        },
        timeout=OLLAMA_GENERATE_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()
 
 
# CHANGED: your config.py's OLLAMA_EMBED_URL is returning 404 against your
# actual Ollama install, but curl confirmed http://localhost:11434/api/embeddings
# works directly. Rather than block on finding the exact typo in config.py,
# this hardcodes the confirmed-working endpoint as a fallback and tries it
# automatically if the configured URL fails with a 404.
FALLBACK_OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings"
OLLAMA_HOST = "http://localhost:11434"
 
 
def ensure_ollama_model(model_name, host=OLLAMA_HOST, timeout=600):
    """Checks whether `model_name` is actually available to the running
    Ollama daemon via /api/tags, and if not, pulls it automatically via
    /api/pull (streamed, with progress printed). This directly fixes the
    "model not found, try pulling it first" 404 -- instead of relying on
    `ollama list` in a terminal matching whatever daemon the script's
    requests actually reach (these can silently be different if there's
    more than one Ollama process/session on the machine).
    """
    try:
        tags_resp = requests.get(f"{host}/api/tags", timeout=10)
        tags_resp.raise_for_status()
        installed = {m.get("name", "") for m in tags_resp.json().get("models", [])}
    except requests.RequestException as e:
        print(f"  [ollama] Could not check installed models: {e}")
        return False
 
    # Tag names look like "nomic-embed-text:latest" -- match loosely on the
    # base name before the colon too, in case config specifies no tag.
    base_names = {name.split(":")[0] for name in installed}
    if model_name in installed or model_name.split(":")[0] in base_names:
        print(f"  [ollama] Model '{model_name}' confirmed available.")
        return True
 
    print(f"  [ollama] Model '{model_name}' not found on this daemon -- "
          f"pulling now (may take a few minutes)...")
    try:
        with requests.post(f"{host}/api/pull", json={"name": model_name},
                            stream=True, timeout=timeout) as r:
            r.raise_for_status()
            last_status = None
            for line in r.iter_lines():
                if not line:
                    continue
                try:
                    status = json.loads(line).get("status", "")
                except json.JSONDecodeError:
                    continue
                if status and status != last_status:
                    print(f"    {status}")
                    last_status = status
        print(f"  [ollama] Pull complete for '{model_name}'.")
        return True
    except requests.RequestException as e:
        print(f"  [ollama] Pull failed: {e}")
        return False
 
 
def _call_embed_endpoint(url, text, model):
    response = requests.post(
        url,
        json={"model": model, "prompt": text},
        timeout=OLLAMA_EMBED_TIMEOUT,
    )
    if not response.ok:
        # CHANGED: previously raise_for_status() fired before we ever looked
        # at what Ollama actually said in the response body -- a 404 alone
        # doesn't tell us if it's a bad route, unpulled model, or malformed
        # request. Print the real body so the next failure is diagnosable
        # instead of guessed at.
        print(f"  [ollama embed http {response.status_code}] url={url} model={model!r} body={response.text[:300]!r}")
    response.raise_for_status()
    data = response.json()
    # Different Ollama versions/routes shape this differently:
    # /api/embeddings -> {"embedding": [...]}
    # /api/embed       -> {"embeddings": [[...]]}
    if "embedding" in data:
        return data["embedding"] or None
    if "embeddings" in data and data["embeddings"]:
        return data["embeddings"][0] or None
    return None
 
 
def get_embedding(text, model=OLLAMA_EMBED_MODEL):
    if not text:
        return None
    try:
        return _call_embed_endpoint(OLLAMA_EMBED_URL, text, model)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 404 \
                and OLLAMA_EMBED_URL != FALLBACK_OLLAMA_EMBED_URL:
            try:
                return _call_embed_endpoint(FALLBACK_OLLAMA_EMBED_URL, text, model)
            except requests.RequestException as e2:
                print(f"  [embedding failed] {type(e2).__name__}: {e2}")
                return None
        print(f"  [embedding failed] {type(e).__name__}: {e}")
        return None
    except requests.RequestException as e:
        print(f"  [embedding failed] {type(e).__name__}: {e}")
        return None
 
 
def cosine_similarity(a, b):
    if not a or not b or len(a) != len(b):
        return None
    dot    = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return None
    return dot / (norm_a * norm_b)
 
 
def compute_cluster_distance(gap_text, paper_embeddings):
    gap_emb = get_embedding(gap_text)
    if gap_emb is None or not paper_embeddings:
        return None
    dim      = len(paper_embeddings[0])
    centroid = [
        sum(e[i] for e in paper_embeddings) / len(paper_embeddings)
        for i in range(dim)
    ]
    sim = cosine_similarity(gap_emb, centroid)
    if sim is None:
        return None
    return round(1 - sim, 4)
 
 
# -------------------------
# NEW: Research-front mapping (k-means clustering) + trend detection.
# Pure Python, no numpy/sklearn -- fine at this scale (tens of papers per
# topic run). Runs on the paper embeddings we already compute for
# cluster_distance, so no extra Ollama calls beyond what's already there.
# -------------------------
STOPWORDS = {
    "the", "and", "for", "with", "from", "into", "that", "this", "are",
    "was", "were", "has", "have", "had", "its", "their", "about", "using",
    "study", "studies", "effect", "effects", "role", "review", "analysis",
    "based", "between", "among", "during", "after", "before", "than",
    "such", "these", "those", "can", "may", "also", "not", "but",
}
 
 
def top_keywords(titles, exclude=None, top_n=5):
    exclude = exclude or set()
    counts = {}
    for title in titles:
        for word in re.findall(r"[a-zA-Z]+", title.lower()):
            if len(word) <= 3 or word in STOPWORDS or word in exclude:
                continue
            counts[word] = counts.get(word, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    return [w for w, _ in ranked[:top_n]]
 
 
def _euclidean(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))
 
 
def kmeans(vectors, k, iterations=25, seed=42):
    n = len(vectors)
    k = max(1, min(k, n))
    rnd = random.Random(seed)
    centroids = [list(v) for v in rnd.sample(vectors, k)]
    assignments = [0] * n
 
    for _ in range(iterations):
        new_assignments = [
            min(range(k), key=lambda ci: _euclidean(v, centroids[ci]))
            for v in vectors
        ]
        if new_assignments == assignments:
            break
        assignments = new_assignments
 
        for ci in range(k):
            members = [vectors[i] for i in range(n) if assignments[i] == ci]
            if members:
                dim = len(members[0])
                centroids[ci] = [
                    sum(m[d] for m in members) / len(members)
                    for d in range(dim)
                ]
    return assignments
 
 
def detect_trend(years, slope_threshold=0.15):
    """Classifies a set of publication years as emerging/declining/stable
    using the slope of a simple linear fit over per-year publication counts
    (missing years in the span are filled with 0, so gaps in publishing
    count against a trend rather than being skipped). Also returns the
    intercept so callers can draw the actual fitted line, not just report
    the slope as a number.
    """
    if len(years) < 3:
        return {"classification": "insufficient_data", "slope": None,
                "intercept": None, "counts_by_year": {}}
 
    counts = {}
    for y in years:
        counts[y] = counts.get(y, 0) + 1
 
    start, end = min(counts), max(counts)
    xs = list(range(start, end + 1))
    ys = [counts.get(y, 0) for y in xs]
    n = len(xs)
 
    if n < 2:
        return {"classification": "insufficient_data", "slope": None,
                "intercept": None, "counts_by_year": counts}
 
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    den = sum((x - mean_x) ** 2 for x in xs)
    slope = round(num / den, 3) if den else 0.0
    intercept = round(mean_y - slope * mean_x, 3)
 
    if slope > slope_threshold:
        classification = "emerging"
    elif slope < -slope_threshold:
        classification = "declining"
    else:
        classification = "stable"
 
    return {"classification": classification, "slope": slope,
            "intercept": intercept, "counts_by_year": counts}
 
 
def build_research_fronts(paper_embedding_pairs, topic=None, k=None):
    """Clusters papers into research fronts using k-means over their
    embeddings, then labels each cluster with its most frequent title
    keywords and attaches a trend classification based on its papers'
    publication years. No LLM calls -- keeps this cheap and fast.
 
    paper_embedding_pairs: list of (row, embedding) tuples, where row is
    the raw DB tuple (id, title, abstract, year_raw, pmid, doi).
 
    topic: the original search topic (e.g. "ginger"). Since every paper was
    fetched BECAUSE it matched the topic or one of its synonyms (see
    get_search_terms), those words show up in nearly every title and would
    otherwise dominate every single cluster's label -- e.g. every front
    labeled "ginger, zingiber, officinale, ...". We exclude the topic's own
    search-term words from keyword extraction so labels show what's
    actually distinctive about each cluster instead.
    """
    if not paper_embedding_pairs:
        return []
 
    rows    = [r for r, _ in paper_embedding_pairs]
    vectors = [e for _, e in paper_embedding_pairs]
    n       = len(vectors)
 
    exclude_words = set()
    if topic:
        for term in get_search_terms(topic):
            for word in re.findall(r"[a-zA-Z]+", term.lower()):
                exclude_words.add(word)
 
    if k is None:
        k = max(2, min(6, n // 10)) if n >= 12 else max(1, n // 4 or 1)
 
    assignments = kmeans(vectors, k)
 
    fronts = []
    for cluster_id in sorted(set(assignments)):
        member_rows = [rows[i] for i, a in enumerate(assignments) if a == cluster_id]
        if not member_rows:
            continue
        titles   = [r[1] or "" for r in member_rows]
        years    = [y for y in (_extract_year(r[3]) for r in member_rows) if y]
        keywords = top_keywords(titles, exclude=exclude_words)
 
        fronts.append({
            "front_id":   f"FRONT-{cluster_id + 1}",
            "label":      ", ".join(keywords) if keywords else "Unlabeled cluster",
            "paper_count": len(member_rows),
            "year_range": [min(years), max(years)] if years else None,
            "trend":      detect_trend(years),
            "papers": [
                {"id": str(r[0]), "title": r[1] or "Untitled", "year": _extract_year(r[3])}
                for r in member_rows
            ],
        })
 
    fronts.sort(key=lambda f: f["paper_count"], reverse=True)
    return fronts
 
 
# -------------------------
# NEW: human-readable front titles/summaries.
# Raw keyword labels like "turmeric, curcumin, curcuma, domestica, extract"
# are hard to scan at a glance. This does ONE lightweight LLM call per
# front (not per paper) that turns the keyword list + a handful of sample
# titles into a short, readable title + 2-3 sentence summary -- matching
# "FRONT-2: turmeric, curcumin, ..." -> "Curcumin Extraction and
# Phytochemical Analysis". Falls back to the raw keyword label if the LLM
# call fails or returns something unusable, so a front is never left
# without SOME title.
# -------------------------
def build_front_title_prompt(label, sample_titles):
    titles_block = "\n".join(f"- {t}" for t in sample_titles)
    return f"""You are labeling a cluster of related research papers for a
dashboard. The cluster was grouped by topic similarity. Its most frequent
title keywords are: {label}
 
A sample of paper titles in this cluster:
{titles_block}
 
Respond with ONLY valid JSON, no markdown, no commentary, in this exact
structure:
 
{{
  "display_title": "a short, human-readable title (4-8 words) for this cluster, e.g. 'Curcumin Extraction and Phytochemical Analysis'",
  "summary": "a 2-3 sentence summary of what this specific research direction covers",
  "common_methods": ["method or dataset type 1", "method or dataset type 2"]
}}
"""
 
 
def generate_front_display_info(front, max_sample_titles=10):
    """Mutates nothing -- returns a dict with display_title/summary/
    common_methods to merge into the front. Uses at most
    `max_sample_titles` paper titles from the front to keep the prompt
    short regardless of how large the cluster is.
    """
    sample_titles = [p["title"] for p in front["papers"][:max_sample_titles] if p.get("title")]
    if not sample_titles:
        return {"display_title": front["label"], "summary": None, "common_methods": []}
 
    prompt = build_front_title_prompt(front["label"], sample_titles)
    try:
        data = call_ollama(prompt)
        raw = data.get("response", "")
        parsed = safe_parse_json(raw)
        if isinstance(parsed, dict) and parsed.get("display_title"):
            return {
                "display_title": str(parsed["display_title"])[:80],
                "summary": parsed.get("summary"),
                "common_methods": parsed.get("common_methods", []) or [],
            }
    except requests.RequestException as e:
        print(f"  [front title generation failed] {type(e).__name__}: {e}")
 
    # Fallback: keep the raw keyword label rather than leaving it blank.
    return {"display_title": front["label"], "summary": None, "common_methods": []}
 
 
def add_front_display_info(fronts, max_representative_papers=5):
    """Adds display_title/summary/common_methods (via one Ollama call per
    front) and representative_papers (just the first N papers already in
    the front -- no extra computation) to each front dict in place.
    """
    for front in fronts:
        info = generate_front_display_info(front)
        front["display_title"] = info["display_title"]
        front["summary"] = info["summary"]
        front["common_methods"] = info["common_methods"]
        front["representative_papers"] = front["papers"][:max_representative_papers]
    return fronts
 
 
# -------------------------
# NEW: trend chart rendering. One PNG, one bar-chart subplot per trend
# (overall + each research front) instead of a text slope number.
# -------------------------
def plot_trends(output, path=TREND_CHART_PATH):
    """Renders publication-count-per-year bar charts: one for the overall
    trend, one for each research front's trend. All stacked into a single
    PNG file (not a directory of separate images). Returns the saved path,
    or None if there's nothing plottable (e.g. all trends are
    'insufficient_data' with no counts_by_year).
    """
    overall = output.get("overall_trend", {}) or {}
    fronts  = output.get("research_fronts", []) or []
 
    candidates = [("Overall", overall)]
    for f in fronts:
        chart_label = f.get("display_title") or f["label"]
        candidates.append((f"{f['front_id']}: {chart_label}", f["trend"]))
 
    # Skip any trend with no year data (e.g. fewer than 3 total papers)
    plots = [(name, t) for name, t in candidates if t.get("counts_by_year")]
    if not plots:
        return None
 
    n = len(plots)
    fig, axes = plt.subplots(n, 1, figsize=(9, 3 * n))
    if n == 1:
        axes = [axes]
 
    for ax, (name, trend) in zip(axes, plots):
        counts_by_year = trend["counts_by_year"]
        years  = sorted(counts_by_year.keys())
        counts = [counts_by_year[y] for y in years]
        x_pos  = list(range(len(years)))
 
        ax.bar(x_pos, counts, color="#4C72B0", label="papers published", zorder=2)
 
        # NEW: overlay the actual fitted regression line (slope + intercept)
        # on top of the bars, so the trend direction is visible at a glance
        # instead of just a slope number in the title. A bar chart alone
        # with gap-years reads as noisy; the line makes "emerging" /
        # "declining" / "stable" visually obvious.
        slope, intercept = trend.get("slope"), trend.get("intercept")
        if slope is not None and intercept is not None:
            fit_ys = [slope * year + intercept for year in years]
            ax.plot(x_pos, fit_ys, color="#DD8452", linestyle="--",
                     linewidth=2, marker="o", markersize=3,
                     label="trend line", zorder=3)
 
        classification = trend.get("classification", "n/a")
        slope_label = trend.get("slope")
        ax.set_title(f"{name} — {classification} (slope={slope_label})", fontsize=10)
        ax.set_ylabel("papers/year")
        ax.set_xlabel("year")
        ax.set_xticks(x_pos)
        ax.set_xticklabels([str(y) for y in years], rotation=45)
        ax.legend(fontsize=8, loc="upper left")
 
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    return path
 
 
# -------------------------
# NEW: HTML report with collapsible per-gap source lists.
# Per the note: "papers -> their gaps + summary -> final research gap" and
# "show sources" in a "collapsable/dropdown" section. Each gap card here
# renders as a <details> element; expanding it reveals exactly which
# papers (from that gap's batch) supported it, with links.
# -------------------------
def _escape_html(text):
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
 
 
def generate_html_report(output, path=HTML_REPORT_PATH):
    if "error" in output:
        html = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Research Gaps Report</title></head>
<body><h1>Research Gaps Report</h1><p>Error: {_escape_html(output['error'])}</p>
</body></html>"""
        with open(path, "w") as f:
            f.write(html)
        return path
 
    topic = _escape_html(output.get("topic", ""))
    gap_cards = output.get("gap_cards", [])
    research_fronts = output.get("research_fronts", [])
    overall_trend = output.get("overall_trend", {})
 
    gap_sections = []
    for card in gap_cards:
        sources_html = "\n".join(
            f'<li><a href="{_escape_html(p["paper_url"])}" target="_blank">{_escape_html(p["title"])}</a>'
            f' ({_escape_html(p.get("year") or "n/a")}) — {_escape_html(p.get("gap_specific_abstract", ""))}</li>'
            if p.get("paper_url") else
            f'<li>{_escape_html(p["title"])} ({_escape_html(p.get("year") or "n/a")})'
            f' — {_escape_html(p.get("gap_specific_abstract", ""))} (no link available)</li>'
            for p in card.get("papers", [])
        )
        scores_str = (
            f'Novelty: {card.get("novelty_score", "n/a")} · '
            f'Feasibility: {card.get("feasibility_score", "n/a")} · '
            f'Overall: {card.get("overall_score", "n/a")}'
        )
        # related_entities is now a categorized dict, e.g.
        # {"herbs": ["Turmeric"], "chemicals": ["Curcumin"]}. Render each
        # category as its own labeled line instead of one flat string.
        entities = card.get("related_entities", {}) or {}
        if entities:
            entities_html = "".join(
                f'<p><em>{_escape_html(category.replace("_", " ").title())}: '
                f'{_escape_html(", ".join(items))}</em></p>'
                for category, items in entities.items() if items
            )
        else:
            entities_html = "<p><em>Related entities: none</em></p>"
 
        gap_sections.append(f"""
<div class="gap-card">
  <h3>{_escape_html(card.get('gap_title', 'Untitled'))}</h3>
  <p class="topic-tag">{_escape_html(card.get('topic', ''))}</p>
  <p>{_escape_html(card.get('gap_description', ''))}</p>
  <p><em>{_escape_html(scores_str)} · Supporting Papers: {card.get('supporting_paper_count', len(card.get('papers', [])))}</em></p>
  <details>
    <summary>Show details &amp; {card.get('supporting_paper_count', len(card.get('papers', [])))} supporting papers</summary>
    {entities_html}
    <ul class="sources-list">
      {sources_html}
    </ul>
  </details>
</div>""")
 
    front_sections = []
    for f in research_fronts:
        yr = f.get("year_range")
        yr_str = f"{yr[0]}–{yr[1]}" if yr else "n/a"
        papers_html = "\n".join(
            f'<li>{_escape_html(p["title"])} ({_escape_html(p.get("year") or "n/a")})</li>'
            for p in f.get("papers", [])
        )
        title = f.get("display_title") or f["label"]
        summary_html = f"<p>{_escape_html(f['summary'])}</p>" if f.get("summary") else ""
        methods_html = (
            f"<p><em>Common methods/datasets: {_escape_html(', '.join(f['common_methods']))}</em></p>"
            if f.get("common_methods") else ""
        )
        front_sections.append(f"""
<div class="front-card">
  <h4>{_escape_html(f['front_id'])}: {_escape_html(title)}</h4>
  <p>{f['paper_count']} papers, {yr_str}, trend: {_escape_html(f['trend']['classification'])}</p>
  {summary_html}
  {methods_html}
  <p class="raw-keywords"><em>Keywords: {_escape_html(f['label'])}</em></p>
  <details>
    <summary>Show papers in this front ({f['paper_count']})</summary>
    <ul class="sources-list">
      {papers_html}
    </ul>
  </details>
</div>""")
 
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Research Gaps Report — {topic}</title>
<style>
  body {{ font-family: -apple-system, Arial, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #222; }}
  h1 {{ border-bottom: 2px solid #4C72B0; padding-bottom: 0.5rem; }}
  .gap-card, .front-card {{
    border: 1px solid #ddd; border-radius: 8px; padding: 1rem 1.25rem;
    margin-bottom: 1rem; background: #fafafa;
  }}
  .gap-card h3 {{ margin-top: 0; color: #2c3e6b; }}
  .front-card h4 {{ margin-top: 0; color: #2c3e6b; }}
  details summary {{
    cursor: pointer; font-weight: 600; color: #4C72B0; padding: 0.4rem 0;
  }}
  details summary:hover {{ color: #DD8452; }}
  .sources-list {{ padding-left: 1.2rem; }}
  .sources-list li {{ margin-bottom: 0.4rem; line-height: 1.4; }}
  .overall-trend {{ background: #eef2fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }}
</style>
</head>
<body>
  <h1>Research Gaps Report: {topic}</h1>
 
  <div class="overall-trend">
    <strong>Overall trend:</strong> {_escape_html(overall_trend.get('classification', 'n/a'))}
    (slope={overall_trend.get('slope', 'n/a')})
  </div>
 
  <h2>Research Gaps</h2>
  {"".join(gap_sections) if gap_sections else "<p>No gaps found.</p>"}
 
  <h2>Research Fronts</h2>
  {"".join(front_sections) if front_sections else "<p>No research fronts identified.</p>"}
 
</body>
</html>"""
 
    with open(path, "w") as f:
        f.write(html)
    return path
 
 
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
 
 
# -------------------------
# NEW: match an LLM-cited "paper_title" back to the real paper row it's
# fetched from. We never trust the LLM to generate correct doi/year/link
# itself -- only to correctly copy a title we already gave it. This
# normalizes whitespace/case for the c omparison, then falls back to a
# loose substring match in case the model paraphrased slightly despite
# instructions.
# -------------------------
def _normalize_title(t):
    return re.sub(r"\s+", " ", (t or "").strip().lower())
 
 
def match_paper_by_title(title_text, batch_paper_refs):
    norm_target = _normalize_title(title_text)
    if not norm_target:
        return None
    for p in batch_paper_refs:
        if _normalize_title(p["title"]) == norm_target:
            return p
    for p in batch_paper_refs:
        nt = _normalize_title(p["title"])
        if nt and (nt in norm_target or norm_target in nt):
            return p
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
# NEW: pipeline trace helper. Every stage appends a small record (name,
# status, timing, counts) so the final output/JSON/report can show exactly
# what the fetch + processing pipeline did, not just the end result.
# -------------------------
def _pipeline_step(pipeline, name, started_at, **details):
    pipeline.append({
        "step": name,
        "duration_sec": round(time.time() - started_at, 2),
        **details,
    })
 
 
# ─────────────────────────────────────────────
# CORE — BATCHED PIPELINE
# ─────────────────────────────────────────────
def generate_research_gaps(topic):
    pipeline = []
 
    # --- Step 1: fetch matching papers (with synonym expansion) + batch them ---
    t0 = time.time()
    all_rows, batches = fetch_papers_batched(topic)
    _pipeline_step(
        pipeline, "fetch_and_batch_papers", t0,
        status="ok" if all_rows else "empty",
        papers_found=len(all_rows),
        total_papers_cap=TOTAL_PAPERS,
        batch_size=BATCH_SIZE,
        total_batches=len(batches),
    )
 
    if not all_rows:
        print(f"\nNo papers found for '{topic}'.")
        return {
            "error": f"No papers found for topic '{topic}'",
            "pipeline": pipeline,
        }, []
 
    paper_ids           = [row[0] for row in all_rows]
    years               = [
        y for y in (_extract_year(row[3]) for row in all_rows) if y
    ]
    last_published_year = max(years) if years else None
 
    # NEW: cheap, non-LLM summary of every fetched paper (title, year, link, snippet)
    papers_summary = build_papers_summary(all_rows)
    # NEW: flat, minimal id -> link list for every paper fetched this run.
    paper_links = build_paper_id_links(all_rows)
 
    # Compute embeddings once for all papers.
    # CHANGED: previously embeddings were collected into a flat list with a
    # list-comprehension filter, which silently drops the row alignment if
    # any single embedding call fails (e.g. timeout on one paper) -- the
    # embedding just vanishes from the list while `all_rows` still has the
    # row, and there was no way to know which paper a given embedding
    # belonged to. That was harmless before (only used to build one
    # centroid), but research-front clustering below needs to know exactly
    # which paper each vector came from, so we now keep them paired.
    # NEW: confirm (and auto-pull if needed) the embedding model BEFORE
    # attempting any embed calls, so the "model not found" 404 from before
    # gets fixed at the source instead of failing silently 80+ times.
    ensure_ollama_model(OLLAMA_EMBED_MODEL)
 
    print("\nComputing paper embeddings...")
    t0 = time.time()
    paper_texts = [
        f"Title: {r[1] or ''}\nAbstract:\n{r[2] or ''}"
        for r in all_rows
    ]  # row shape: (id, title, abstract, year_raw, pmid, doi) -- only title/abstract used here
    paper_embedding_pairs = []
    for row, text in zip(all_rows, paper_texts):
        emb = get_embedding(text)
        if emb:
            paper_embedding_pairs.append((row, emb))
 
    paper_embeddings = [e for _, e in paper_embedding_pairs]  # kept for cluster_distance centroid, unchanged behavior
    _pipeline_step(
        pipeline, "embed_papers", t0,
        status="ok" if paper_embeddings else "no_embeddings",
        embedded=len(paper_embeddings),
        attempted=len(all_rows),
    )
    print(f"Embeddings done in {time.time() - t0:.1f}s")
 
    # NEW: research-front mapping (k-means clustering over paper embeddings)
    # + trend detection (per-front and overall). No LLM calls -- cheap and
    # fast, runs on data we already have.
    #
    # CHANGED: overall_trend now comes from fetch_all_years_for_topic(),
    # NOT from `years` (which only reflects the recency-capped 80 papers).
    # Since fetch_papers_batched sorts newest-first and caps at
    # TOTAL_PAPERS, using that capped set here would make older years look
    # artificially thin/empty on the chart -- not a real decline, just an
    # artifact of the cap. Research-front trends (per cluster) are still
    # necessarily scoped to the fetched+embedded subset, since we can't
    # cluster papers we never embedded -- that limitation remains, but the
    # overall trend line now reflects the true full matching population.
    t0 = time.time()
    all_matching_years = fetch_all_years_for_topic(topic)
    research_fronts = build_research_fronts(paper_embedding_pairs, topic=topic)
    # NEW: turn raw keyword labels ("turmeric, curcumin, ...") into a
    # readable title + summary via one LLM call per front. Cheap relative
    # to the per-batch gap-generation calls (at most ~6 extra calls here).
    add_front_display_info(research_fronts)
    overall_trend = detect_trend(all_matching_years)
    _pipeline_step(
        pipeline, "research_fronts_and_trends", t0,
        status="ok" if research_fronts else "no_clusters",
        fronts_found=len(research_fronts),
        total_matching_papers=len(all_matching_years),
        papers_used_for_fronts=len(paper_embedding_pairs),
    )
 
    all_gap_cards     = []
    all_limitations   = []
    all_opportunities = []
    all_future        = []
    batches_succeeded = 0
 
    # --- Step: MAP — one LLM call per batch ---
    t_map_start = time.time()
    for batch_num, batch_rows in enumerate(batches, start=1):
        print(f"\n--- Batch {batch_num}/{len(batches)} "
              f"({len(batch_rows)} papers) ---")
 
        # Build per-batch paper reference list — this is what
        # supports gaps from THIS batch specifically
        # NEW: now includes a `link` and `summary` per paper too
        batch_paper_refs = []
        for row in batch_rows:
            pid, title, abstract, year_raw, pmid, doi = row
            batch_paper_refs.append({
                "id":      str(pid),
                "pmid":    f"PMID:{pmid}" if pmid else None,
                "doi":     doi,
                "title":   title or "",
                "year":    _extract_year(year_raw),
                "link":    build_paper_link(pid, pmid, doi),
                "summary": _abstract_snippet(abstract),
            })
 
        batch_text = "\n\n".join(
            f"Title: {r[1] or ''}\nAbstract:\n{r[2] or ''}"
            for r in batch_rows
        )
        prompt = build_prompt(batch_text)
        result = None
        raw    = ""
 
        for attempt in range(1, 4):
            print(f"  Calling Ollama (attempt {attempt}/3)...")
            call_start = time.time()
            try:
                data = call_ollama(prompt)
            except requests.Timeout:
                print(f"  Timeout on attempt {attempt}, retrying...")
                continue
            except requests.RequestException as e:
                print(f"  Could not reach Ollama: {e}")
                break
 
            print(f"  Responded in {time.time() - call_start:.1f}s")
            raw       = data.get("response", "")
            candidate = safe_parse_json(raw)
 
            if candidate is not None and is_valid_result(candidate):
                result = candidate
                break
            print(f"  Attempt {attempt}: invalid schema, retrying...")
 
        if result is None:
            print(f"  Batch {batch_num}: skipped.")
            continue
 
        batches_succeeded += 1
        batch_gaps = result.get("research_gaps", [])
        for gap in batch_gaps:
            description = gap.get("description", "")
 
            novelty = gap.get("novelty_score")
            feasibility = gap.get("feasibility_score")
            novelty = novelty if isinstance(novelty, (int, float)) else None
            feasibility = feasibility if isinstance(feasibility, (int, float)) else None
            overall_score = (
                round((novelty + feasibility) / 2, 1)
                if novelty is not None and feasibility is not None
                else None
            )
 
            # CHANGED: related_entities is now whatever categorized dict the
            # LLM returned (e.g. {"herbs": [...], "chemicals": [...]}),
            # per the "group entities by category" request. If the LLM
            # returns a flat list instead (schema drift), wrap it under an
            # "uncategorized" key rather than dropping it.
            raw_entities = gap.get("related_entities", {})
            if isinstance(raw_entities, list):
                related_entities = {"uncategorized": raw_entities} if raw_entities else {}
            elif isinstance(raw_entities, dict):
                related_entities = {k: v for k, v in raw_entities.items() if v}
            else:
                related_entities = {}
 
            # Match each LLM-cited paper_title back to the real paper row
            # (id/doi/year/link) it was fetched from. Entries the LLM
            # invented or paraphrased past recognition are dropped rather
            # than fabricated -- see match_paper_by_title().
            matched_papers = []
            for evidence_item in gap.get("supporting_evidence", []) or []:
                matched = match_paper_by_title(
                    evidence_item.get("paper_title", ""), batch_paper_refs
                )
                if not matched:
                    continue
                matched_papers.append({
                    "paper_id":              matched["id"],  # real DB UUID, not a fabricated int
                    "title":                 matched["title"],
                    "doi":                   matched["doi"],
                    "year":                  matched["year"],
                    "paper_url":             matched["link"],
                    "gap_specific_abstract": evidence_item.get("gap_specific_abstract", ""),
                })
 
            most_recent_year = max(
                (p["year"] for p in matched_papers if p.get("year")),
                default=None,
            )
 
            all_gap_cards.append({
                "gap_id":                  "GAP-" + str(uuid.uuid4())[:8],  # reassigned to gap_NNN after dedup below
                "topic":                   topic,
                "gap_title":               (gap.get("title") or "Untitled")[:70],
                "gap_description":         description,
                "related_entities":        related_entities,
                "novelty_score":           novelty,
                "feasibility_score":       feasibility,
                "overall_score":           overall_score,
                "papers":                  matched_papers,
                "supporting_paper_count":  len(matched_papers),
                "most_recent_year":        most_recent_year,
                "_batch_num":              batch_num,  # internal only; consumed when building "generation" below
            })
 
        all_limitations.extend(result.get("common_limitations", []))
        all_opportunities.extend(result.get("unexplored_opportunities", []))
        all_future.extend(result.get("future_directions", []))
        print(f"  Batch {batch_num}: {len(batch_gaps)} gap(s) found.")
 
    _pipeline_step(
        pipeline, "map_batches", t_map_start,
        status="ok" if batches_succeeded else "failed",
        batches_succeeded=batches_succeeded,
        batches_total=len(batches),
    )
 
    if not all_gap_cards:
        return {
            "error": "No gaps found across all batches.",
            "pipeline": pipeline,
            "papers": papers_summary,
            "paper_links": paper_links,
            "research_fronts": research_fronts,
            "overall_trend": overall_trend,
        }, paper_ids
 
    # --- Step: dedup gaps across batches ---
    t0 = time.time()
    seen_titles = set()
    unique_gaps = []
    for card in all_gap_cards:
        key = card["gap_title"].lower()[:40]
        if key not in seen_titles:
            seen_titles.add(key)
            unique_gaps.append(card)
 
    # NEW: reassign sequential gap_001-style ids (matches requested schema)
    # and attach the "generation" metadata block. cluster_id here is the
    # batch number that produced the gap -- gaps come from per-batch LLM
    # calls, not from the k-means research-front clusters, so this is
    # honestly a batch id, not a front id; documented rather than silently
    # relabeled.
    generated_at_iso = datetime.now(timezone.utc).isoformat()
    for idx, card in enumerate(unique_gaps, start=1):
        card["gap_id"] = f"gap_{idx:03d}"
        card["generation"] = {
            "cluster_id":     card.pop("_batch_num", None),
            "generated_from": card.get("supporting_paper_count", 0),
            "llm_model":      OLLAMA_MODEL,
            "created_at":     generated_at_iso,
        }
 
    _pipeline_step(
        pipeline, "dedup_gaps", t0,
        status="ok",
        gaps_before_dedup=len(all_gap_cards),
        gaps_after_dedup=len(unique_gaps),
    )
 
    print(f"\nTotal: {len(all_gap_cards)} gaps → {len(unique_gaps)} after dedup.")
 
    # NEW: sort feature -- rather than pre-sorting gap_cards itself (which
    # would force a single fixed order), expose ready-made gap_id orderings
    # for each requested sort so the frontend can switch sort mode without
    # re-sorting client-side or needing every field's exact semantics.
    # "Most Recent" uses most_recent_year; missing/None values sort last.
    def _sort_key(field, reverse_none_last=True):
        def key(card):
            val = card.get(field)
            if val is None:
                return (1, 0)  # None always sorts after real values
            return (0, -val if reverse_none_last else val)
        return key
 
    gap_sort_orders = {
        "novelty":            [c["gap_id"] for c in sorted(unique_gaps, key=_sort_key("novelty_score"))],
        "feasibility":        [c["gap_id"] for c in sorted(unique_gaps, key=_sort_key("feasibility_score"))],
        "supporting_papers":  [c["gap_id"] for c in sorted(unique_gaps, key=_sort_key("supporting_paper_count"))],
        "most_recent":        [c["gap_id"] for c in sorted(unique_gaps, key=_sort_key("most_recent_year"))],
        "overall_score":      [c["gap_id"] for c in sorted(unique_gaps, key=_sort_key("overall_score"))],
    }
 
    output = {
        "topic":              topic,
        "generated_at":       datetime.now(timezone.utc).isoformat(),
        "papers_scanned":     len(all_rows),
        "batches_processed":  f"{batches_succeeded}/{len(batches)}",
        "papers":             papers_summary,   # per-paper title/year/link/snippet
        "paper_links":        paper_links,      # flat id -> link list for every paper fetched
        "pipeline":           pipeline,         # trace of every fetch/process stage
        "research_fronts":    research_fronts,  # clustered papers, labeled + trend per cluster
        "overall_trend":      overall_trend,    # trend across all fetched papers combined
        "gap_sort_orders":    gap_sort_orders,   # NEW: gap_id order for each sort option; frontend picks one
        "summary": {
            "research_gaps":            [g["gap_description"] for g in unique_gaps],
            "common_limitations":       list(dict.fromkeys(all_limitations)),
            "unexplored_opportunities": list(dict.fromkeys(all_opportunities)),
            "future_directions":        list(dict.fromkeys(all_future)),
        },
        "gap_cards": unique_gaps,
    }
    return output, paper_ids
 
 
# -------------------------
# Output helpers
# -------------------------
def _paragraph(items):
    sentences = [s.strip() for s in items if s and s.strip()]
    return " ".join(sentences) if sentences else "No notable findings identified."
 
 
def print_report(output):
    if "error" in output:
        print(f"\nError: {output['error']}")
        return
 
    summary        = output["summary"]
    gap_descriptions = [g.get("gap_description", "") for g in output["gap_cards"]]
 
    print("\n===== RESEARCH GAPS =====")
    print("Based on the given papers, key findings:\n")
 
    # pipeline trace
    print("0. Pipeline:")
    for step in output.get("pipeline", []):
        extras = {k: v for k, v in step.items() if k not in ("step", "duration_sec")}
        extras_str = ", ".join(f"{k}={v}" for k, v in extras.items())
        print(f"   - {step['step']}: {step['duration_sec']}s ({extras_str})")
    print()
 
    # papers summary + links
    print("0b. Papers Scanned:")
    for p in output.get("papers", []):
        link = p["link"] or "(no PMID / DOI / link available)"
        year = p["year"] or "n/a"
        print(f"   - [{year}] {p['title']}")
        print(f"     link: {link}")
        print(f"     summary: {p['summary']}")
    print()
 
    # flat paper_id -> link list
    print("0c. All Paper IDs & Links:")
    for p in output.get("paper_links", []):
        link = p["link"] or "(no PMID / DOI / link available)"
        print(f"   - {p['id']}: {link}")
    print()
 
    # NEW: research fronts (clusters) + per-front trend, now with a
    # readable title/summary instead of the raw keyword label.
    print("0d. Research Fronts:")
    for f in output.get("research_fronts", []):
        yr = f["year_range"]
        yr_str = f"{yr[0]}–{yr[1]}" if yr else "n/a"
        trend = f["trend"]["classification"]
        title = f.get("display_title") or f["label"]
        print(f"   - {f['front_id']}: {title} — {f['paper_count']} papers, {yr_str}, trend: {trend}")
        if f.get("summary"):
            print(f"     {f['summary']}")
        if f.get("common_methods"):
            print(f"     methods/datasets: {', '.join(f['common_methods'])}")
        print(f"     (raw keywords: {f['label']})")
    print()
 
    # NEW: overall trend across all fetched papers
    ot = output.get("overall_trend", {})
    print(f"0e. Overall Trend: {ot.get('classification', 'n/a')} (slope={ot.get('slope')})")
    print()
 
    # NEW: compact gap cards -- title, topic, short description, scores,
    # and supporting paper count only. Full details (categorized entities,
    # per-paper gap-specific abstracts) are available in the JSON/HTML but
    # deliberately left out here to match the "keep the card compact, hide
    # details until expanded" request.
    print("0f. Gap Cards (compact):")
    for card in output.get("gap_cards", []):
        desc = card.get("gap_description", "")
        short_desc = desc if len(desc) <= 160 else desc[:157] + "..."
        novelty = card.get("novelty_score")
        feasibility = card.get("feasibility_score")
        print(f"   - [{card['gap_id']}] {card.get('gap_title')} ({card.get('topic')})")
        print(f"     {short_desc}")
        print(f"     Novelty: {novelty if novelty is not None else 'n/a'}  "
              f"Feasibility: {feasibility if feasibility is not None else 'n/a'}  "
              f"Supporting Papers: {card.get('supporting_paper_count', 0)}")
    print()
 
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
 
 
# -------------------------
# Entry point
# -------------------------
if __name__ == "__main__":
    topic  = input("Enter topic: ")
    result, paper_ids = generate_research_gaps(topic)
 
    print_report(result)
 
    save_json(result)
    print(f"Full output saved to: {OUTPUT_JSON_PATH}")
 
    chart_path = plot_trends(result)
    if chart_path:
        print(f"Trend chart saved to: {chart_path}")
    else:
        print("Trend chart skipped: not enough year data to plot.")
 
    html_path = generate_html_report(result)
    print(f"HTML report (collapsible sources) saved to: {html_path}")
 
    if "error" not in result:
        try:
            n = save_gap_cards_to_db(result, paper_ids)
            print(f"Saved {n} gap card(s) to gap_candidates table.")
        except Exception as e:
            print(f"Note: could not write to DB ({e}). "
                  f"JSON file is saved and usable.")