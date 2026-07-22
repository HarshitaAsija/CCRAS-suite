
"""
RishiAI Knowledge Graph Pipeline — Keyword-First Approach
1. Search keywords table for query term (exact + fuzzy)
2. Get all papers containing those keywords
3. Get ALL keywords from those papers
4. Use LLM to normalize + group concepts
5. Build co-occurrence edges (concept appears in same paper)
6. Write to Neo4j
"""

import os
import re
import json
import logging
from collections import defaultdict

import psycopg2
import psycopg2.extras
from neo4j import GraphDatabase
from dotenv import load_dotenv

from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity as cos_sim
from sklearn.feature_extraction.text import TfidfVectorizer

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
PG_DSN         = os.getenv("PG_DSN", "postgresql://user:password@host:5432/ccras_db")
NEO4J_URI      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "rishiai123")
ANTHROPIC_KEY  = os.getenv("ANTHROPIC_API_KEY", "")

TOP_K_PAPERS   = int(os.getenv("TOP_K_PAPERS",    "100"))
MIN_EDGE_WEIGHT= int(os.getenv("MIN_EDGE_WEIGHT",  "1"))
MAX_CONCEPTS   = int(os.getenv("MAX_CONCEPTS",    "100"))

# Co-occurrence ("just showed up together") edges are a fallback for concept
# pairs the LLM didn't explicitly relate. Left uncapped they explode
# combinatorially and drown out the typed treats/causes/contains/... edges
# both visually and in the layout. This caps how many co-occurrence edges
# any single node can pick up.
MAX_COOCCUR_EDGES_PER_NODE = int(os.getenv("MAX_COOCCUR_EDGES_PER_NODE", "4"))

# Semantic search over paper_chunks.embedding (pgvector). Distance is
# cosine distance (0 = identical, 2 = opposite) — lower is more similar.
SEMANTIC_TOP_K        = int(os.getenv("SEMANTIC_TOP_K", "50"))
SEMANTIC_MAX_DISTANCE = float(os.getenv("SEMANTIC_MAX_DISTANCE", "0.6"))

# How many extra candidate keywords to mine per paper straight out of its
# abstract/full_text via TF-IDF, to cover concepts missing from `keywords`
EXTRA_KEYWORDS_PER_PAPER = int(os.getenv("EXTRA_KEYWORDS_PER_PAPER", "8"))

# Relevance score weights  (must sum to 1.0)
ALPHA = float(os.getenv("ALPHA", "0.4"))  # embedding similarity weight
BETA  = float(os.getenv("BETA",  "0.6"))  # co-occurrence weight

# Shared embedding model (loaded once)
_embed_model = None
def get_embedder():
    global _embed_model
    if _embed_model is None:
        logger.info("Loading embedding model...")
        _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embed_model


def get_query_embedding(query: str) -> list[float]:
    """Embed the user's query with the same model used for paper_chunks,
    so the vectors are directly comparable."""
    embedder = get_embedder()
    emb = embedder.encode([query], normalize_embeddings=True)[0]
    return emb.tolist()


_JUNK_KEYWORDS = frozenset({
    "with", "the", "its", "due", "old", "case", "form", "cause", "common",
    "patient", "patients", "randomized", "and", "for", "from", "this",
    "that", "was", "were", "are", "not", "has", "have", "had", "but",
    "study", "studies", "results", "result", "using", "used", "use",
    "may", "can", "also", "new", "each", "both", "into", "than", "then",
})

def _is_junk_keyword(kw: str) -> bool:
    """Filters keywords regardless of source (DB column or text-mined) —
    the DB `keywords` column has no stopword filtering applied at
    ingestion time, unlike the TF-IDF mining step, so this catches what
    that step would otherwise let through."""
    k = kw.strip().lower()
    if len(k) < 3:
        return True
    if k in _JUNK_KEYWORDS:
        return True
    if k.isdigit():
        return True
    return False


def extract_extra_keywords(papers: list[dict], top_n: int = EXTRA_KEYWORDS_PER_PAPER) -> dict[str, list[str]]:
    """
    Mines extra candidate keywords straight out of each paper's title +
    abstract + full_text via TF-IDF, so concepts that were never captured
    in the `keywords` column still make it into the graph. Returns
    {paper_id: [candidate_keyword, ...]}.
    """
    docs, ids = [], []
    for p in papers:
        text = " ".join(filter(None, [
            p.get("title") or "",
            p.get("abstract") or "",
            (p.get("full_text") or "")[:5000],   # cap per-doc cost
        ])).strip()
        if text:
            docs.append(text)
            ids.append(str(p["id"]))

    if len(docs) < 2:
        return {}

    try:
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 3), stop_words="english",
            max_df=0.85, min_df=1, max_features=5000,
        )
        matrix = vectorizer.fit_transform(docs)
        vocab = np.array(vectorizer.get_feature_names_out())
    except Exception as e:
        logger.warning(f"TF-IDF keyword extraction failed: {e}")
        return {}

    result: dict[str, list[str]] = {}
    for i, pid in enumerate(ids):
        row = matrix[i].toarray().ravel()
        if not row.any():
            continue
        top_idx = row.argsort()[::-1][:top_n]
        result[pid] = [vocab[j] for j in top_idx if row[j] > 0]

    logger.info(f"Extracted extra keywords for {len(result)}/{len(papers)} papers via TF-IDF")
    return result


# ─────────────────────────────────────────────
# 1. POSTGRESQL CLIENT
# ─────────────────────────────────────────────
class PostgresClient:
    def __init__(self):
        self._connect()

    def _connect(self):
        try:
            self.conn = psycopg2.connect(
                PG_DSN,
                options="-c timezone=Asia/Kolkata"
            )
            self.conn.autocommit = True
            logger.info("Connected to PostgreSQL [OK]")
        except Exception as e:
            self.conn = None
            logger.warning(f"PostgreSQL connection failed: {e}")

    def _ensure_connection(self):
        try:
            cur = self.conn.cursor()
            cur.execute("SELECT 1")
            cur.close()
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            logger.warning("PostgreSQL connection lost - reconnecting...")
            self._connect()

    def search_papers_by_keyword(self, query: str, top_k: int = TOP_K_PAPERS) -> list[dict]:
        self._ensure_connection()
        with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(f"""
                SELECT id, title, abstract, journal, doi, full_text,
                    published_date, keywords AS paper_keywords, authors
                FROM papers
                WHERE keywords::text ILIKE %s
                    OR title ILIKE %s
                    OR abstract ILIKE %s
                LIMIT {top_k}
            """, (f'%{query}%', f'%{query}%', f'%{query}%'))
            papers = cur.fetchall()

        result = [dict(p) for p in papers]
        logger.info(f"Found {len(result)} papers for keyword '{query}'")
        return result

    def _search_papers_jsonb(self, query: str, top_k: int) -> list[dict]:
        """Fallback: search papers.keywords JSONB array."""
        with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, title, abstract, journal, doi, published_date,
                       keywords AS paper_keywords, authors
                FROM papers
                WHERE keywords::text ILIKE %s
                LIMIT %s
            """, (f"%{query}%", top_k))
            rows = cur.fetchall()
        logger.info(f"JSONB fallback: found {len(rows)} papers")
        return [dict(r) for r in rows]

    def get_keywords_for_papers(self, paper_ids: list[str]) -> dict[str, list[dict]]:
        self._ensure_connection()
        if not paper_ids:
            return {}
        with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, keywords FROM papers
                WHERE id = ANY(%s::uuid[])
                AND keywords IS NOT NULL
            """, (paper_ids,))
            rows = cur.fetchall()

        result = {}
        for row in rows:
            pid = str(row['id'])
            kws = row['keywords']
            if isinstance(kws, list):
                result[pid] = [{"keyword": k, "score": 1} for k in kws if k]
            elif isinstance(kws, str):
                import json
                try:
                    parsed = json.loads(kws)
                    result[pid] = [{"keyword": k, "score": 1} for k in parsed if k]
                except:
                    result[pid] = []
        return result

    def get_papers_by_ids(self, paper_ids: list[str]) -> list[dict]:
        """Fetch full paper details for a list of IDs."""
        if not paper_ids:
            return []
        with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, title, abstract, journal, doi, published_date, full_text
                FROM papers WHERE id = ANY(%s::uuid[])
            """, (paper_ids,))
            return [dict(r) for r in cur.fetchall()]

    def search_papers_semantic(self, query_embedding: list[float],
                                top_k: int = SEMANTIC_TOP_K,
                                max_distance: float = SEMANTIC_MAX_DISTANCE) -> list[dict]:
        """
        Semantic search over paper_chunks.embedding using pgvector cosine
        distance, so papers whose text means the same thing as the query
        surface even when the exact term is absent. Each paper is scored by
        its single closest chunk. Requires `CREATE EXTENSION IF NOT EXISTS
        vector;` and, ideally, an ivfflat/hnsw index on paper_chunks.embedding
        for performance at scale. Falls back to a bounded in-Python scan if
        the vector operator isn't available.
        """
        self._ensure_connection()
        vec_literal = "[" + ",".join(f"{v:.6f}" for v in query_embedding) + "]"

        try:
            with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT pc.paper_id AS id, MIN(pc.embedding <=> %s::vector) AS distance
                    FROM paper_chunks pc
                    GROUP BY pc.paper_id
                    HAVING MIN(pc.embedding <=> %s::vector) <= %s
                    ORDER BY distance ASC
                    LIMIT %s
                """, (vec_literal, vec_literal, max_distance, top_k))
                hits = cur.fetchall()
        except Exception as e:
            logger.warning(f"pgvector semantic search failed ({e}) — falling back to bounded scan. "
                            f"Enable the `vector` extension for proper performance.")
            self.conn.rollback()
            hits = self._search_papers_semantic_fallback(query_embedding, top_k, max_distance)

        if not hits:
            logger.info("Semantic search: no papers above similarity threshold")
            return []

        dist_by_id = {str(h["id"]): h["distance"] for h in hits}
        papers = self.get_papers_by_ids(list(dist_by_id.keys()))
        for p in papers:
            pid = str(p["id"])
            p["semantic_distance"] = dist_by_id.get(pid)
            p["semantic_similarity"] = round(1 - dist_by_id.get(pid, 1), 4)
        logger.info(f"Semantic search found {len(papers)} papers (max_distance={max_distance})")
        return papers

    def _search_papers_semantic_fallback(self, query_embedding: list[float], top_k: int,
                                          max_distance: float, scan_limit: int = 20000) -> list[dict]:
        """
        Degraded fallback used only when pgvector's `<=>` operator isn't
        available. Pulls a bounded batch of chunk embeddings and scores them
        in Python. Not meant for production scale — enable the vector
        extension instead.
        """
        with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT paper_id, embedding FROM paper_chunks LIMIT %s", (scan_limit,))
            rows = cur.fetchall()

        q = np.array(query_embedding, dtype=float)
        q = q / (np.linalg.norm(q) + 1e-9)

        best: dict[str, float] = {}
        for r in rows:
            emb = r["embedding"]
            if isinstance(emb, str):
                try:
                    emb = json.loads(emb)
                except Exception:
                    continue
            if not emb:
                continue
            v = np.array(emb, dtype=float)
            v = v / (np.linalg.norm(v) + 1e-9)
            dist = 1 - float(np.dot(q, v))
            pid = str(r["paper_id"])
            if pid not in best or dist < best[pid]:
                best[pid] = dist

        hits = [{"id": pid, "distance": d} for pid, d in best.items() if d <= max_distance]
        hits.sort(key=lambda h: h["distance"])
        return hits[:top_k]


# ─────────────────────────────────────────────
# 2. LLM CONCEPT NORMALIZATION
# ─────────────────────────────────────────────
# Which LLM backend to use for concept normalization. "gemini" (default)
# calls Google's API and needs GEMINI_API_KEY. "ollama" calls a local Ollama
# server — no API key, no per-call cost, but needs Ollama installed, running
# (`ollama serve`), and the model pulled (`ollama pull llama3.1`).
LLM_PROVIDER    = os.getenv("LLM_PROVIDER", "ollama").lower()   # "gemini" | "ollama"
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_TIMEOUT  = int(os.getenv("OLLAMA_TIMEOUT", "180"))

def _build_normalization_prompt(query: str, unique_kws: list[str]) -> str:
    return f"""You are a biomedical knowledge graph expert building a research knowledge graph.

User query: "{query}"

TASK 1 — CANONICALIZATION:
Group these keywords into canonical concepts. Merge only true synonyms/variants
of the SAME specific thing.
Examples: "withania somnifera" + "ashwagandha root" + "ashwagandha extract" → "ashwagandha"
Do NOT merge distinct concepts just because they're related or co-occur — e.g.
"curcumin", "turmeric", and "anti-inflammatory" are three DIFFERENT canonical
concepts, not one. You MUST end up with many distinct canonical concepts
(typically 15-{MAX_CONCEPTS}), not just one or two. Collapsing most keywords
into a single concept is WRONG and will be rejected.
Keep max {MAX_CONCEPTS} most relevant canonical concepts.
"{query}" MUST be one of the canonical concepts.

TASK 2 — RELATIONSHIPS:
For every pair of canonical concepts that has a clear biomedical relationship, define it.
Use ONLY these relation types:
- treats        : A treats/cures/manages B  (e.g. antibiotic treats tuberculosis)
- causes        : A causes/leads to B  (e.g. mycobacterium causes tuberculosis)
- contains      : A contains/has component B  (e.g. ashwagandha contains withanolide)
- interacts_with: A interacts with/inhibits/activates B  (e.g. drug interacts_with enzyme)
- part_of       : A is a type/subtype/part of B  (e.g. pulmonary tb part_of tuberculosis)
- studied_in    : A is studied/used in context of B  (e.g. machine learning studied_in diagnosis)
- associated_with: A is clinically associated with B  (e.g. hiv associated_with tuberculosis)
- biomarker_of  : A is a biomarker/indicator of B  (e.g. crp biomarker_of inflammation)
- produces      : A produces/secretes/generates B  (e.g. bacteria produces toxin)
- prevents      : A prevents/protects against B  (e.g. vaccine prevents tuberculosis)

RULES:
- Generate AT LEAST 15 relationships if possible
- Every important concept should have at least one relationship
- Only use exact canonical concept names in relationships (from canonical_map values)

Return ONLY this JSON structure, nothing else, no markdown:
{{
  "canonical_map": {{
    "raw_keyword": "canonical_concept"
  }},
  "relationships": [
    {{"from": "concept_a", "to": "concept_b", "relation": "relation_type"}}
  ]
}}

Keywords to process:
{json.dumps(unique_kws, indent=2)}"""


def _call_gemini(prompt: str) -> tuple[str | None, str | None]:
    """Returns (raw_response_text, error_message) — exactly one is None."""
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    if not GEMINI_KEY:
        return None, "No GEMINI_API_KEY set"
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
        # NOTE: gemini-1.0 and gemini-1.5 models were fully shut down by
        # Google — every call to them now 404s. gemini-2.5-flash is the
        # current stable GA model as of mid-2026.
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        return response.text, None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def _call_ollama(prompt: str) -> tuple[str | None, str | None]:
    """Returns (raw_response_text, error_message) — exactly one is None.
    Talks to a local Ollama server's /api/generate endpoint. Uses Ollama's
    `format: "json"` mode to constrain output to valid JSON — the model
    still needs the schema spelled out in the prompt itself, which
    _build_normalization_prompt already does."""
    try:
        import requests
    except ImportError:
        return None, "The 'requests' package is required for Ollama — run: pip install requests"

    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.1,
                    "num_ctx": 8192,       # raise context window so a ~200-keyword
                                           # prompt + JSON response doesn't get
                                           # silently truncated by a small default
                    "num_predict": 4096,   # give it enough output budget too
                },
            },
            timeout=OLLAMA_TIMEOUT,
        )
        if resp.status_code == 404:
            return None, (f"Model '{OLLAMA_MODEL}' not found on the Ollama server — "
                           f"run: ollama pull {OLLAMA_MODEL}")
        resp.raise_for_status()
        text = resp.json().get("response", "")
        if not text:
            return None, "Ollama returned an empty response"
        return text, None
    except requests.exceptions.ConnectionError:
        return None, (f"Could not connect to Ollama at {OLLAMA_BASE_URL} — is it running? "
                       f"Start it with `ollama serve`, and make sure the model is pulled: "
                       f"`ollama pull {OLLAMA_MODEL}`")
    except requests.exceptions.Timeout:
        return None, (f"Ollama request timed out after {OLLAMA_TIMEOUT}s — this query sent "
                       f"~200 keywords, which can be slow on CPU-only or smaller models. "
                       f"Try a smaller keyword batch, a smaller/faster model, or raise OLLAMA_TIMEOUT")
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def normalize_concepts_with_llm(query: str, keywords: list[str]) -> dict:
    """
    Use an LLM (Gemini or a local Ollama model, per LLM_PROVIDER) to:
    1. Group similar keywords into canonical concepts
    2. Return {raw_keyword: canonical_concept} mapping
    3. Only keep concepts relevant to the query
    """
    unique_kws = list(dict.fromkeys([k.lower().strip() for k in keywords if k]))[:200]
    prompt = _build_normalization_prompt(query, unique_kws)

    if LLM_PROVIDER == "ollama":
        raw_text, err = _call_ollama(prompt)
    else:
        raw_text, err = _call_gemini(prompt)

    if err:
        logger.error(
            f"⚠️  LLM normalization call FAILED via provider='{LLM_PROVIDER}' ({err}) — "
            f"falling back to raw keywords with rule-based relationships."
        )
        result = {"canonical_map": {k: k for k in unique_kws}, "relationships": [], "llm_failed": True}
        result["relationships"] = infer_relationships_from_rules(unique_kws)
        return result

    logger.info(f"[{LLM_PROVIDER}] raw response length: {len(raw_text)} chars "
                f"(sent {len(unique_kws)} keywords)")

    try:
        cleaned = re.sub(r"^```json\s*|^```\s*|\s*```$", "", raw_text.strip(), flags=re.MULTILINE).strip()
        data = json.loads(cleaned)
        n_rels = len(data.get("relationships", []))
        n_concepts = len(set(data.get("canonical_map", {}).values()))
        logger.info(f"[{LLM_PROVIDER}] normalized {len(unique_kws)} keywords → "
                    f"{n_concepts} concepts, {n_rels} typed relationships")

        # Degenerate case: model collapsed most/all keywords into one or two
        # concepts (common failure mode for smaller local models given a big
        # flat keyword list). This produces a graph with 1 node and 0 usable
        # edges even though relationships were "generated" — they reference
        # concept names that were never assigned as canonical values. Treat
        # this the same as an LLM failure rather than shipping a near-empty
        # graph silently.
        min_expected_concepts = min(10, max(3, len(unique_kws) // 15))
        if n_concepts < min_expected_concepts:
            logger.warning(
                f"LLM collapsed {len(unique_kws)} keywords into only {n_concepts} "
                f"concept(s) (expected >= {min_expected_concepts}) — treating as a "
                f"degenerate response and falling back to rule-based relationships "
                f"over the raw keywords instead."
            )
            data["canonical_map"] = {k: k for k in unique_kws}
            data["relationships"] = infer_relationships_from_rules(unique_kws)
            data["llm_degenerate"] = True
            return data

        if n_rels == 0:
            logger.warning("LLM returned ZERO typed relationships — using rule-based fallback")
            canonical_concepts = list(set(data["canonical_map"].values()))
            data["relationships"] = infer_relationships_from_rules(canonical_concepts)
            logger.info(f"Rule-based fallback added {len(data['relationships'])} relationships")
        return data
    except Exception as e:
        logger.error(f"⚠️  Failed to parse {LLM_PROVIDER} response ({e}) — using rule-based fallback")
        result = {"canonical_map": {k: k for k in unique_kws}, "relationships": [], "llm_failed": True}
        result["relationships"] = infer_relationships_from_rules(unique_kws)
        return result


# ─────────────────────────────────────────────
# RULE-BASED RELATIONSHIP INFERENCE
# ─────────────────────────────────────────────
RELATIONSHIP_RULES = [
    {
        "relation": "treats",
        "subject_patterns": [
            "ashwagandha","withania","turmeric","curcumin","neem","tulsi","triphala",
            "drug","antibiotic","treatment","therapy","medicine","extract","herb",
            "vaccine","antiviral","antimicrobial","supplement","formulation","rifampicin",
            "isoniazid","streptomycin","penicillin","amoxicillin","ibuprofen","aspirin"
        ],
        "object_patterns": [
            "anxiety","stress","depression","cancer","tumor","infection","disease",
            "disorder","syndrome","diabetes","hypertension","inflammation","pain",
            "fever","tuberculosis","malaria","asthma","arthritis","obesity","hiv",
            "aids","pneumonia","sepsis","disorder","condition","symptoms"
        ]
    },
    {
        "relation": "causes",
        "subject_patterns": [
            "bacteria","virus","pathogen","mycobacterium","infection","inflammation",
            "mutation","oxidative stress","toxin","allergen","parasite","fungus",
            "mycobacterium tuberculosis","hiv","plasmodium","staphylococcus","streptococcus"
        ],
        "object_patterns": [
            "disease","disorder","damage","death","inflammation","fever","pain",
            "cancer","tuberculosis","pneumonia","infection","symptoms","lesion",
            "necrosis","fibrosis","resistance","relapse"
        ]
    },
    {
        "relation": "contains",
        "subject_patterns": [
            "ashwagandha","withania","plant","herb","extract","root","leaf",
            "bark","seed","fruit","formulation","drug","compound","turmeric",
            "neem","tulsi","ginger","garlic","aloe"
        ],
        "object_patterns": [
            "withanolide","alkaloid","flavonoid","terpenoid","glycoside","protein",
            "vitamin","mineral","compound","molecule","chemical","phytochemical",
            "curcumin","allicin","quercetin","tannin","saponin","phenol"
        ]
    },
    {
        "relation": "interacts_with",
        "subject_patterns": [
            "drug","compound","molecule","protein","enzyme","receptor","hormone",
            "antibiotic","chemical","inhibitor","agonist","antagonist","ligand"
        ],
        "object_patterns": [
            "enzyme","receptor","protein","pathway","gene","dna","rna",
            "hormone","cell","membrane","transporter","kinase","catalyst",
            "cytochrome","p450","ace","cox"
        ]
    },
    {
        "relation": "part_of",
        "subject_patterns": [
            "pulmonary tuberculosis","latent tuberculosis","extrapulmonary",
            "primary tuberculosis","miliary tuberculosis","tb meningitis",
            "cell","tissue","organ","gene","protein","chromosome","pathway",
            "cortisol","neurotransmitter","hormone","enzyme","membrane"
        ],
        "object_patterns": [
            "tuberculosis","body","system","pathway","genome","immune system",
            "nervous system","endocrine system","cell","organism","metabolic pathway",
            "brain","respiratory system","circulatory system"
        ]
    },
    {
        "relation": "studied_in",
        "subject_patterns": [
            "yoga","meditation","ayurveda","traditional medicine","herbal",
            "machine learning","ai","deep learning","neural network","algorithm",
            "crispr","genomics","proteomics","metabolomics","bioinformatics"
        ],
        "object_patterns": [
            "clinical trial","study","research","treatment","therapy","diagnosis",
            "cancer","diabetes","anxiety","tuberculosis","population","patients",
            "randomized controlled","systematic review","meta-analysis"
        ]
    },
    {
        "relation": "associated_with",
        "subject_patterns": [
            "hiv","aids","malnutrition","poverty","smoking","diabetes","immunosuppression",
            "drug resistance","multidrug resistance","silicosis","alcohol"
        ],
        "object_patterns": [
            "tuberculosis","infection","disease","mortality","relapse","risk",
            "complications","severity","outcome","progression"
        ]
    },
    {
        "relation": "biomarker_of",
        "subject_patterns": [
            "crp","esr","interferon","interleukin","tnf","il-6","il-10",
            "cd4","cd8","igm","igg","pcr","sputum","culture","xpert"
        ],
        "object_patterns": [
            "tuberculosis","infection","inflammation","disease","cancer",
            "diagnosis","monitoring","prognosis","treatment response"
        ]
    },
    {
        "relation": "produces",
        "subject_patterns": [
            "bacteria","mycobacterium","virus","fungi","cell","liver","pancreas",
            "immune cell","t-cell","b-cell","macrophage","neutrophil"
        ],
        "object_patterns": [
            "toxin","cytokine","antibody","enzyme","protein","hormone",
            "interferon","interleukin","tnf","reactive oxygen","biofilm"
        ]
    },
    {
        "relation": "prevents",
        "subject_patterns": [
            "vaccine","bcg","vaccination","prophylaxis","preventive","mask",
            "isoniazid preventive","screening","early detection","quarantine"
        ],
        "object_patterns": [
            "tuberculosis","infection","disease","spread","transmission",
            "reactivation","progression","complications","mortality"
        ]
    },
]


def infer_relationships_from_rules(concepts: list[str]) -> list[dict]:
    """Infer relationships between concepts using pattern matching."""
    relationships = []
    seen = set()

    for concept_a in concepts:
        ca_lower = concept_a.lower()
        for concept_b in concepts:
            if concept_a == concept_b:
                continue
            cb_lower = concept_b.lower()
            pair_key = tuple(sorted([concept_a, concept_b]))
            if pair_key in seen:
                continue

            for rule in RELATIONSHIP_RULES:
                a_matches = any(p in ca_lower or ca_lower in p
                                for p in rule["subject_patterns"])
                b_matches = any(p in cb_lower or cb_lower in p
                                for p in rule["object_patterns"])
                if a_matches and b_matches:
                    relationships.append({
                        "from":     concept_a,
                        "to":       concept_b,
                        "relation": rule["relation"]
                    })
                    seen.add(pair_key)
                    break

    logger.info(f"Rule-based inference: {len(relationships)} relationships from {len(concepts)} concepts")
    return relationships
# ─────────────────────────────────────────────
# 3. RELEVANCE SCORING
# ─────────────────────────────────────────────
def score_concepts(
    query: str,
    nodes: dict,
    query_concept: str,
    cooccur: dict,
    total_query_papers: int,
) -> dict:
    """
    Combined relevance score for each concept:

      score = α × cosine_sim(concept, query)       ← semantic similarity
            + β × (papers_shared_with_query /       ← co-occurrence ratio
                   total_query_papers)

    Returns {concept_name: relevance_score (0-1)}
    """
    embedder = get_embedder()
    concept_names = list(nodes.keys())

    if not concept_names:
        return {}

    logger.info(f"Scoring {len(concept_names)} concepts with embeddings + co-occurrence…")

    # Embed query and all concepts in one batch
    all_texts  = [query] + concept_names
    embeddings = embedder.encode(all_texts, normalize_embeddings=True, batch_size=64)
    query_emb  = embeddings[0:1]          # shape (1, dim)
    concept_embs = embeddings[1:]         # shape (N, dim)

    # Cosine similarity of each concept with the query
    sims = cos_sim(query_emb, concept_embs)[0]  # shape (N,)

    scores = {}
    for i, concept in enumerate(concept_names):
        if concept == query_concept:
            scores[concept] = 1.0          # query node always gets max score
            continue

        # Co-occurrence ratio with the query concept
        key = tuple(sorted([query_concept, concept]))
        shared_papers = cooccur.get(key, 0)
        cooccur_ratio = shared_papers / total_query_papers if total_query_papers > 0 else 0

        # Embedding similarity (already 0-1 since normalized)
        embed_sim = float(sims[i])
        embed_sim = max(0.0, embed_sim)    # clip negatives

        # Combined score
        scores[concept] = round(ALPHA * embed_sim + BETA * cooccur_ratio, 4)

    logger.info(f"Top 5 by relevance: {sorted(scores.items(), key=lambda x: -x[1])[:5]}")
    return scores


# ─────────────────────────────────────────────
# 4. BUILD GRAPH DATA
# ─────────────────────────────────────────────
def build_graph(
    query: str,
    papers: list[dict],
    paper_keywords: dict[str, list[dict]],
    llm_data: dict,
    max_concepts: int | None = None,
) -> tuple[dict, dict]:
    """
    Returns:
      nodes  = {concept: {"papers": [...], "weight": int, "is_query": bool}}
      edges  = {(c1, c2): {"weight": int, "relation": str}}
    max_concepts overrides MAX_CONCEPTS for this call.
    """
    max_concepts = max_concepts or MAX_CONCEPTS
    canonical_map = llm_data.get("canonical_map", {})
    llm_relations = llm_data.get("relationships", [])

    def resolve(kw: str) -> str | None:
        k = kw.lower().strip()
        return canonical_map.get(k)

    nodes: dict[str, dict] = {}
    cooccur: dict[tuple, int] = defaultdict(int)

    query_concept = resolve(query) or query.lower().strip()

    for paper in papers:
        pid   = str(paper["id"])
        title = paper.get("title") or ""

        # Collect keywords for this paper
        kw_list = [r["keyword"] for r in paper_keywords.get(pid, []) if r.get("keyword")]
        if paper.get("paper_keywords") and isinstance(paper["paper_keywords"], list):
            kw_list.extend(paper["paper_keywords"])

        # Resolve to canonical concepts (only keep ones LLM approved)
        concepts = []
        seen = set()
        for kw in kw_list:
            c = resolve(kw)
            if c and c not in seen:
                seen.add(c)
                concepts.append(c)
                # Add/update node
                if c not in nodes:
                    nodes[c] = {
                        "papers": [],
                        "weight": 0,
                        "is_query": (c == query_concept)
                    }
                nodes[c]["weight"] += 1
                nodes[c]["papers"].append({"id": pid, "title": title,
                                           "journal": paper.get("journal", ""),
                                           "doi": paper.get("doi", "")})

        # Co-occurrence edges
        for i in range(len(concepts)):
            for j in range(i + 1, len(concepts)):
                a, b = sorted([concepts[i], concepts[j]])
                cooccur[(a, b)] += 1

    # ── Enforce max_concepts cap ────────────────────────────────────────
    if len(nodes) > max_concepts:
        relation_concepts = set()
        for rel in llm_relations:
            relation_concepts.add(rel.get("from", ""))
            relation_concepts.add(rel.get("to", ""))

        keep = {query_concept} | (relation_concepts & set(nodes.keys()))
        for c, _ in sorted(nodes.items(), key=lambda kv: -kv[1]["weight"]):
            if len(keep) >= max_concepts:
                break
            keep.add(c)
        if len(keep) > max_concepts:
            ranked = sorted(keep - {query_concept}, key=lambda c: -nodes[c]["weight"])
            keep = {query_concept} | set(ranked[:max_concepts - 1])

        logger.info(f"Concept cap: {len(nodes)} candidates → {len(keep)} kept (max {max_concepts})")
        nodes = {c: meta for c, meta in nodes.items() if c in keep}
        cooccur = {pair: w for pair, w in cooccur.items() if pair[0] in nodes and pair[1] in nodes}

    # Build edges: LLM semantic relations take priority, co-occurrence fills the rest
    edges: dict[tuple, dict] = {}

    # Add LLM-defined relationships first — these are the meaningful, typed
    # edges (treats/causes/contains/...) and are never capped.
    for rel in llm_relations:
        a, b = rel.get("from", ""), rel.get("to", "")
        if a in nodes and b in nodes and a != b:
            key = tuple(sorted([a, b]))
            edges[key] = {
                "weight": cooccur.get(key, 1),
                "relation": rel.get("relation", "related_to")
            }

    # Add co-occurrence edges (min weight filter), capped per node so a
    # handful of typed edges don't get visually and structurally swamped by
    # a combinatorial explosion of "showed up in the same paper" edges —
    # that explosion is also what was distorting the force-directed layout.
    cooccur_candidates = sorted(
        [(a, b, w) for (a, b), w in cooccur.items()
         if w >= MIN_EDGE_WEIGHT and (a, b) not in edges and (b, a) not in edges
         and a in nodes and b in nodes],
        key=lambda x: -x[2]
    )
    cooccur_fanout: dict[str, int] = defaultdict(int)
    for a, b, w in cooccur_candidates:
        # The query concept is exempt from the fan-out cap — it's the
        # intended hub of the graph, and capping it the same as any other
        # node causes it to get stranded from large chunks of the graph
        # once it hits the limit, leaving disconnected islands floating
        # off on their own (only reachable through the LLM's typed
        # relationships, which don't always route back through the query).
        a_capped = a != query_concept and cooccur_fanout[a] >= MAX_COOCCUR_EDGES_PER_NODE
        b_capped = b != query_concept and cooccur_fanout[b] >= MAX_COOCCUR_EDGES_PER_NODE
        if a_capped or b_capped:
            continue
        edges[(a, b)] = {"weight": w, "relation": "co_occurs_with"}
        cooccur_fanout[a] += 1
        cooccur_fanout[b] += 1

    # Make sure query node exists
    if query_concept not in nodes:
        nodes[query_concept] = {"papers": [], "weight": 1, "is_query": True}

    # Keep only the connected component that actually contains the query
    # node — not just "has some edge to something." A node connected only
    # to other stray nodes (e.g. dengue<->suis, forming their own tiny
    # island) is just as disconnected from the graph the user asked for as
    # a true zero-edge orphan, and produces the same "floating cluster"
    # distortion in the force-directed layout. BFS from the query node
    # guarantees everything left is reachable from it.
    adjacency: dict[str, set[str]] = defaultdict(set)
    for (a, b) in edges:
        adjacency[a].add(b)
        adjacency[b].add(a)

    reachable = {query_concept}
    frontier = [query_concept]
    while frontier:
        cur = frontier.pop()
        for nxt in adjacency[cur]:
            if nxt not in reachable:
                reachable.add(nxt)
                frontier.append(nxt)

    if len(reachable) > 1:
        dropped = set(nodes) - reachable
        if dropped:
            logger.info(
                f"Dropping {len(dropped)} concept(s) not connected to the query "
                f"node '{query_concept}' (either true orphans or isolated islands "
                f"only connected to each other)"
            )
        nodes = {c: meta for c, meta in nodes.items() if c in reachable}
        edges = {(a, b): meta for (a, b), meta in edges.items()
                  if a in reachable and b in reachable}

    # ── Combined relevance scoring ────────────────────────────────────
    total_query_papers = nodes.get(query_concept, {}).get("weight", 1)
    relevance_scores = score_concepts(
        query, nodes, query_concept, cooccur, total_query_papers
    )
    for concept, score in relevance_scores.items():
        if concept in nodes:
            nodes[concept]["relevance"] = score

    logger.info(f"Graph: {len(nodes)} concepts, {len(edges)} edges")
    return nodes, edges


# ─────────────────────────────────────────────
# 4. NEO4J CLIENT
# ─────────────────────────────────────────────
class Neo4jClient:
    def __init__(self):
        try:
            self.driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
            logger.info("Connected to Neo4j [OK]")
        except Exception as e:
            self.driver = None
            logger.warning(f"Neo4j connection failed: {e}")

    def close(self):
        self.driver.close()

    def clear_user_graph(self, user_id: str):
        with self.driver.session() as session:
            session.run("MATCH (n {user_id: $uid}) DETACH DELETE n", uid=user_id)

    def write_graph(self, user_id: str, q: str, nodes: dict, edges: dict, papers: list[dict]):
        with self.driver.session() as session:
            # Indexes
            session.run("CREATE INDEX concept_idx IF NOT EXISTS FOR (c:Concept) ON (c.user_id, c.name)")
            session.run("CREATE INDEX paper_idx IF NOT EXISTS FOR (p:Paper) ON (p.user_id, p.paper_id)")

            # Concept nodes
            logger.info(f"Writing {len(nodes)} concept nodes…")
            for concept, meta in nodes.items():
                session.run("""
                    MERGE (c:Concept {user_id: $uid, name: $name})
                    SET c.weight    = $weight,
                        c.is_query  = $is_query,
                        c.q         = $q,
                        c.relevance = $relevance
                """, uid=user_id, name=concept, weight=meta["weight"],
                    is_query=meta["is_query"], q=q,
                    relevance=meta.get("relevance", 0.0))

            # Paper nodes
            logger.info(f"Writing {len(papers)} paper nodes…")
            for paper in papers:
                pid = str(paper["id"])
                session.run("""
                    MERGE (p:Paper {user_id: $uid, paper_id: $pid})
                    SET p.title = $title, p.journal = $journal,
                        p.doi = $doi, p.q = $q, p.match_type = $match_type
                """, uid=user_id, pid=pid,
                    title=paper.get("title") or "",
                    journal=paper.get("journal") or "",
                    doi=paper.get("doi") or "",
                    q=q, match_type=paper.get("match_type") or "keyword")

            # Concept → Paper edges
            logger.info("Writing concept→paper edges…")
            for concept, meta in nodes.items():
                for paper_ref in meta["papers"]:
                    session.run("""
                        MATCH (c:Concept {user_id: $uid, name: $cname})
                        MATCH (p:Paper   {user_id: $uid, paper_id: $pid})
                        MERGE (c)-[:APPEARS_IN]->(p)
                    """, uid=user_id, cname=concept, pid=paper_ref["id"])

            # Concept ↔ Concept edges
            logger.info(f"Writing {len(edges)} concept edges…")
            for (a, b), meta in edges.items():
                session.run("""
                    MATCH (ca:Concept {user_id: $uid, name: $a})
                    MATCH (cb:Concept {user_id: $uid, name: $b})
                    MERGE (ca)-[r:RELATED_TO]-(cb)
                    SET r.weight = $weight, r.relation = $relation
                """, uid=user_id, a=a, b=b,
                    weight=meta["weight"], relation=meta["relation"])

        logger.info("Neo4j write complete ✓")

    def get_graph_for_viz(self, user_id: str, q: str) -> dict:
        with self.driver.session() as session:
            concept_rows = session.run("""
                MATCH (c:Concept {user_id: $uid, q: $q})
                RETURN c.name AS name, c.weight AS weight,
                       c.is_query AS is_query, c.relevance AS relevance
            """, uid=user_id, q=q).data()

            edge_rows = session.run("""
                MATCH (ca:Concept {user_id: $uid, q: $q})-[r:RELATED_TO]-(cb:Concept {user_id: $uid, q: $q})
                WHERE elementId(ca) < elementId(cb)
                RETURN ca.name AS source, cb.name AS target,
                       r.weight AS weight, r.relation AS relation
            """, uid=user_id, q=q).data()

            paper_rows = session.run("""
                MATCH (c:Concept {user_id: $uid, q: $q})-[:APPEARS_IN]->(p:Paper)
                RETURN c.name AS concept, p.paper_id AS pid,
                       p.title AS title, p.journal AS journal, p.doi AS doi,
                       p.match_type AS match_type
                LIMIT 500
            """, uid=user_id, q=q).data()

        nodes = [{"data": {"id": r["name"], "label": r["name"],
                           "weight": r["weight"], "is_query": r["is_query"],
                           "relevance": r.get("relevance") or 0.0}}
                 for r in concept_rows]

        edges = [{"data": {"source": r["source"], "target": r["target"],
                           "weight": r["weight"], "relation": r["relation"]}}
                 for r in edge_rows]

        papers_by_concept = defaultdict(list)
        for r in paper_rows:
            papers_by_concept[r["concept"]].append({
                "id": r["pid"], "title": r["title"],
                "journal": r["journal"], "doi": r["doi"],
                "match_type": r.get("match_type") or "keyword",
            })

        return {"nodes": nodes, "edges": edges,
                "papers_by_concept": dict(papers_by_concept)}

    def expand_node(self, user_id: str, concept_name: str) -> dict:
        with self.driver.session() as session:
            rows = session.run("""
                MATCH (c:Concept {user_id: $uid, name: $name})-[r:RELATED_TO]-(n:Concept)
                RETURN n.name AS name, n.weight AS weight,
                       n.is_query AS is_query, r.weight AS edge_weight,
                       r.relation AS relation
            """, uid=user_id, name=concept_name).data()

        nodes = [{"data": {"id": r["name"], "label": r["name"],
                           "weight": r["weight"], "is_query": r["is_query"]}}
                 for r in rows]
        edges = [{"data": {"source": concept_name, "target": r["name"],
                           "weight": r["edge_weight"], "relation": r["relation"]}}
                 for r in rows]
        return {"nodes": nodes, "edges": edges}


# ─────────────────────────────────────────────
# 5. MAIN PIPELINE
# ─────────────────────────────────────────────
class KnowledgeGraphPipeline:
    def __init__(self):
        self.pg     = PostgresClient()
        self.neo4j  = Neo4jClient()

    def run(self, query: str, user_id: str = "default") -> dict:
        logger.info(f"=== Pipeline start | query='{query}' user='{user_id}' ===")

        # Step 1a — keyword search (exact / ILIKE match on title, abstract, keywords)
        kw_papers = self.pg.search_papers_by_keyword(query, top_k=TOP_K_PAPERS)
        for p in kw_papers:
            p["match_type"] = "keyword"

        # Step 1b — semantic search over paper_chunks embeddings, so papers
        # with the same *meaning* surface even if the exact term never
        # appears in their keywords/title/abstract
        query_embedding = get_query_embedding(query)
        sem_papers = self.pg.search_papers_semantic(query_embedding, top_k=SEMANTIC_TOP_K)

        # Merge the two result sets, de-duplicating by paper id
        merged: dict[str, dict] = {}
        for p in kw_papers:
            merged[str(p["id"])] = p
        for p in sem_papers:
            pid = str(p["id"])
            if pid in merged:
                merged[pid]["match_type"] = "keyword+semantic"
                merged[pid]["semantic_similarity"] = p.get("semantic_similarity")
            else:
                p["match_type"] = "semantic"
                merged[pid] = p

        papers = list(merged.values())
        logger.info(f"Merged search: {len(kw_papers)} keyword + {len(sem_papers)} semantic "
                    f"→ {len(papers)} unique papers")

        if not papers:
            return {"nodes": [], "edges": [], "papers_by_concept": {},
                    "error": f"No papers found for '{query}'"}

        paper_ids = [str(p["id"]) for p in papers]

        # Step 2 — get keywords already stored for those papers
        paper_keywords = self.pg.get_keywords_for_papers(paper_ids)

        # Step 2b — mine extra candidate keywords straight from abstract/full_text,
        # since the `keywords` column doesn't always capture everything relevant
        extra_keywords = extract_extra_keywords(papers)
        for pid, kws in extra_keywords.items():
            paper_keywords.setdefault(pid, [])
            paper_keywords[pid].extend({"keyword": k, "score": 0.5} for k in kws)

        # Step 3 — collect all raw keywords (DB column + text-mined), filtering
        # out stopwords/junk regardless of source — the DB `keywords` column
        # was populated at ingestion time with no stopword filtering, unlike
        # the TF-IDF mining step below, so junk like "with"/"the"/"case" can
        # otherwise leak straight through into the graph as fake concepts.
        all_kws = [query]
        for rows in paper_keywords.values():
            all_kws.extend(r["keyword"] for r in rows if r.get("keyword"))
        for p in papers:
            if p.get("paper_keywords") and isinstance(p["paper_keywords"], list):
                all_kws.extend(p["paper_keywords"])
        n_before_filter = len(all_kws)
        all_kws = [k for k in all_kws if not _is_junk_keyword(k)]
        if n_before_filter != len(all_kws):
            logger.info(f"Filtered {n_before_filter - len(all_kws)} junk/stopword "
                        f"keyword(s) out of {n_before_filter}")

        logger.info(f"Collected {len(all_kws)} raw keywords from {len(papers)} papers "
                    f"(incl. {sum(len(v) for v in extra_keywords.values())} mined from text)")

        # Step 4 — LLM normalization
        llm_data = normalize_concepts_with_llm(query, all_kws)

        # Step 5 — build graph
        nodes, edges = build_graph(query, papers, paper_keywords, llm_data)

        # Step 6 — write to Neo4j
        self.neo4j.clear_user_graph(user_id)
        self.neo4j.write_graph(user_id, query, nodes, edges, papers)

        # Step 7 — return Cytoscape payload
        result = self.neo4j.get_graph_for_viz(user_id, query)
        if llm_data.get("llm_failed"):
            result["warning"] = (
                "LLM concept normalization failed — showing raw keywords with no synonym "
                "grouping and only co-occurrence edges (no treats/causes/contains/etc). "
                "Check the API server logs for the underlying error."
            )
        elif llm_data.get("llm_degenerate"):
            result["warning"] = (
                "The LLM collapsed most keywords into a single concept instead of "
                "distinguishing them — falling back to raw keywords with rule-based "
                "relationships. Try a larger/more capable model, or a smaller keyword "
                "batch, for richer LLM-grouped concepts."
            )
        elif not llm_data.get("relationships"):
            result["warning"] = (
                "The LLM returned no typed relationships for this query — edges shown are "
                "co-occurrence only."
            )
        logger.info(f"=== Pipeline complete: {len(result['nodes'])} nodes, {len(result['edges'])} edges ===")
        return result

    def expand(self, concept: str, user_id: str = "default") -> dict:
        return self.neo4j.expand_node(user_id, concept)

    def close(self):
        self.neo4j.close()


if __name__ == "__main__":
    import json
    pipeline = KnowledgeGraphPipeline()
    try:
        result = pipeline.run("ashwagandha", user_id="test_user")
        print(json.dumps({
            "nodes": len(result["nodes"]),
            "edges": len(result["edges"]),
            "sample_nodes": [n["data"]["label"] for n in result["nodes"][:15]],
            "sample_edges": [f"{e['data']['source']} --{e['data']['relation']}--> {e['data']['target']}"
                             for e in result["edges"][:10]],
        }, indent=2))
    finally:
        pipeline.close()