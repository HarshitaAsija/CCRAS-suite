
"""
RishiAI — Whole Database Ontology Knowledge Graph
Classifies papers into 8 ontologies using keyword matching (no LLM needed).
"""

import os, json, logging, re
from collections import defaultdict

import psycopg2, psycopg2.extras
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Reuse the already-working search→normalize→graph pipeline instead of
# duplicating it: same LLM provider switch (Gemini/Ollama), same TF-IDF
# text-mined keyword fallback, same connectivity-guaranteeing graph builder.
from app.services.knowledge_graph import (
    PostgresClient as KGPostgresClient,
    normalize_concepts_with_llm,
    build_graph,
    extract_extra_keywords,
)

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PG_DSN         = os.getenv("PG_DSN")
NEO4J_URI      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "rishiai123")

# How many paper IDs to retain per ontology node in Neo4j, so "expand" has a
# real pool of papers to draw from without re-scanning the whole `papers`
# table on every click. Just IDs (small), so a generous cap is cheap.
ONTOLOGY_MAX_STORED_PAPER_IDS = int(os.getenv("ONTOLOGY_MAX_STORED_PAPER_IDS", "2000"))

# How many of those papers to actually pull full text/keywords for and feed
# to the LLM when a node is expanded. Keep this modest — it directly drives
# LLM prompt size (and therefore latency) on every click.
ONTOLOGY_EXPAND_PAPER_LIMIT = int(os.getenv("ONTOLOGY_EXPAND_PAPER_LIMIT", "60"))

# Cap on how many concept nodes a single expand reveals — smaller than a
# full top-level search, since this is meant to be one bite-sized "reveal"
# in a living, click-to-grow graph rather than the whole picture at once.
ONTOLOGY_EXPAND_MAX_CONCEPTS = int(os.getenv("ONTOLOGY_EXPAND_MAX_CONCEPTS", "18"))

ONTOLOGIES = {
    "BIO":    {"name": "Biomedical Biology",           "emoji": "🧬", "color": "#34d399"},
    "MED":    {"name": "Clinical & Disease",           "emoji": "⚕️",  "color": "#60a5fa"},
    "CHEM":   {"name": "Chemical & Pharmacology",      "emoji": "🧪", "color": "#f59e0b"},
    "MICRO":  {"name": "Microbiology & Infectious",    "emoji": "🦠", "color": "#f87171"},
    "COMP":   {"name": "Computational & AI",           "emoji": "🤖", "color": "#a78bfa"},
    "EPIO":   {"name": "Epidemiology & Public Health", "emoji": "📊", "color": "#38bdf8"},
    "ETHNO":  {"name": "Ethnobotany & Traditional",    "emoji": "🌿", "color": "#4ade80"},
    "PHYSIO": {"name": "Physiology & Anatomy",         "emoji": "🫀", "color": "#fb923c"},
}

# Keyword rules — each ontology has trigger words
# Paper is assigned to ALL matching ontologies (can belong to multiple)
ONTOLOGY_RULES = {
    "MICRO": [
        "tuberculosis","tb","mycobacterium","malaria","hiv","aids","hepatitis",
        "bacteria","bacterial","virus","viral","fungal","fungi","pathogen",
        "infection","infectious","antimicrobial","antibiotic","vaccine","vaccination",
        "parasite","parasitic","epidemic","pandemic","covid","sars","influenza",
        "pneumonia","dengue","typhoid","cholera","plague","ebola","zika"
    ],
    "COMP": [
        "machine learning","deep learning","neural network","artificial intelligence",
        "ai","algorithm","classification","prediction","nlp","natural language",
        "computer","computational","data mining","random forest","svm","cnn","rnn",
        "transformer","bert","llm","model","clustering","regression","feature",
        "dataset","training","testing","accuracy","precision","recall"
    ],
    "CHEM": [
        "drug","compound","molecule","chemical","pharmacology","pharmacological",
        "synthesis","enzyme","metabolite","metabolism","biochemistry","biochemical",
        "dosage","dose","toxicity","inhibitor","receptor","ligand","protein binding",
        "pharmacokinetic","bioavailability","nanoparticle","extraction","chromatography"
    ],
    "ETHNO": [
        "ayurveda","ayurvedic","herbal","herb","traditional medicine","plant extract",
        "botanical","ethnobotany","ethnomedicine","natural product","folk medicine",
        "ashwagandha","turmeric","curcumin","neem","tulsi","triphala","dosha",
        "rasayana","panchakarma","unani","siddha","homeopathy","yoga","meditation",
        "phytochemical","phytotherapy","medicinal plant","crude extract"
    ],
    "EPIO": [
        "epidemiology","prevalence","incidence","mortality","morbidity","surveillance",
        "population","cohort","cross-sectional","case control","risk factor",
        "public health","healthcare","screening","demographic","burden","global health",
        "systematic review","meta-analysis","randomized","clinical trial","observational"
    ],
    "PHYSIO": [
        "heart","cardiac","cardiovascular","lung","pulmonary","liver","hepatic",
        "kidney","renal","brain","neurological","neurology","muscle","bone","blood",
        "immune","immunity","hormone","endocrine","gut","digestive","anatomy",
        "physiology","physiological","organ","tissue","cell","cellular","homeostasis"
    ],
    "MED": [
        "disease","disorder","syndrome","diagnosis","treatment","therapy","patient",
        "clinical","surgery","surgical","hospital","medicine","medical","symptom",
        "prognosis","outcome","complication","chronic","acute","pediatric","geriatric",
        "cancer","tumor","carcinoma","diabetes","hypertension","obesity","stroke"
    ],
    "BIO": [
        "gene","genomic","genomics","dna","rna","protein","molecular","biology",
        "cell","cellular","crispr","sequencing","mutation","expression","pathway",
        "biomarker","chromosome","epigenetic","transcription","translation","stem cell",
        "signaling","apoptosis","proliferation","differentiation","bioinformatics"
    ],
}

def classify_keyword(kw: str) -> list[str]:
    """Return list of ontology codes matching this keyword."""
    kw_lower = kw.lower()
    matches = []
    for code, triggers in ONTOLOGY_RULES.items():
        for trigger in triggers:
            if trigger in kw_lower or kw_lower in trigger:
                matches.append(code)
                break
    return matches if matches else ["BIO"]  # default fallback

def classify_paper(keywords: list[str]) -> set[str]:
    """Return set of ontology codes for a paper based on its keywords."""
    codes = set()
    for kw in keywords:
        codes.update(classify_keyword(kw))
    return codes if codes else {"BIO"}


# ─────────────────────────────────────────────
# POSTGRESQL
# ─────────────────────────────────────────────
class PostgresClient:
    def __init__(self):
        self._connect()

    def _connect(self):
        try:
            self.conn = psycopg2.connect(PG_DSN, options="-c timezone=Asia/Kolkata")
            self.conn.autocommit = True
            logger.info("Connected to PostgreSQL [OK]")
        except Exception as e:
            self.conn = None
            logger.warning(f"PostgreSQL connection failed: {e}")

    def _ensure(self):
        try:
            self.conn.cursor().execute("SELECT 1")
        except Exception:
            self._connect()

    def get_papers_with_keywords(self) -> list[dict]:
        self._ensure()
        with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, title, journal, doi, keywords
                FROM papers
                WHERE keywords IS NOT NULL
                AND keywords != 'null'::jsonb
                AND jsonb_typeof(keywords) = 'array'
                AND keywords != '[]'::jsonb
                LIMIT 15000
            """)
            rows = cur.fetchall()
        logger.info(f"Fetched {len(rows)} papers with keywords")
        return [dict(r) for r in rows]

    def get_all_papers(self) -> list[dict]:
        self._ensure()
        with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, title, journal, doi FROM papers LIMIT 15000")
            return [dict(r) for r in cur.fetchall()]


# ─────────────────────────────────────────────
# BUILD ONTOLOGY GRAPH
# ─────────────────────────────────────────────
def extract_keywords(raw) -> list[str]:
    """Safely extract keyword strings from JSONB value."""
    if not raw:
        return []
    if isinstance(raw, list):
        result = []
        for item in raw:
            s = str(item).strip().strip('"').strip("'")
            if s:
                result.append(s.lower())
        return result
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return extract_keywords(parsed)
        except:
            return [raw.lower().strip()]
    return []


def build_ontology_graph(papers: list[dict]) -> tuple[dict, dict]:
    nodes = {
        code: {**meta, "code": code, "paper_count": 0,
               "keyword_count": 0, "sample_kws": [], "sample_papers": [],
               "paper_ids": []}
        for code, meta in ONTOLOGIES.items()
    }

    edge_counts   = defaultdict(int)
    edge_paper_ids = defaultdict(list)
    kw_per_onto   = defaultdict(set)

    logger.info(f"Classifying {len(papers)} papers…")

    for paper in papers:
        pid      = str(paper["id"])
        title    = paper.get("title") or ""
        keywords = extract_keywords(paper.get("keywords"))

        if not keywords:
            continue

        # Classify paper into ontologies
        paper_ontos = classify_paper(keywords)

        # Update nodes
        for code in paper_ontos:
            nodes[code]["paper_count"] += 1
            kw_per_onto[code].update(keywords)
            if len(nodes[code]["sample_papers"]) < 8:
                nodes[code]["sample_papers"].append({
                    "pid": pid, "title": title,
                    "journal": paper.get("journal") or "",
                    "doi": paper.get("doi") or ""
                })
            if len(nodes[code]["paper_ids"]) < ONTOLOGY_MAX_STORED_PAPER_IDS:
                nodes[code]["paper_ids"].append(pid)

        # Co-occurrence edges
        onto_list = sorted(paper_ontos)
        for i in range(len(onto_list)):
            for j in range(i + 1, len(onto_list)):
                a, b = onto_list[i], onto_list[j]
                edge_counts[(a, b)] += 1
                if len(edge_paper_ids[(a, b)]) < 20:
                    edge_paper_ids[(a, b)].append(pid)

    # Finalize nodes
    for code in nodes:
        kws = list(kw_per_onto[code])
        nodes[code]["keyword_count"] = len(kws)
        nodes[code]["sample_kws"] = kws[:15]

    edges = {k: {"weight": v, "paper_ids": edge_paper_ids[k]}
             for k, v in edge_counts.items()}

    # Log results
    logger.info("Classification results:")
    for code, meta in sorted(nodes.items(), key=lambda x: -x[1]["paper_count"]):
        logger.info(f"  {meta['emoji']} {code}: {meta['paper_count']} papers, {meta['keyword_count']} keywords")
    logger.info(f"Edges: {len(edges)}")
    for (a, b), meta in sorted(edges.items(), key=lambda x: -x[1]["weight"])[:10]:
        logger.info(f"  {a} ↔ {b}: {meta['weight']} papers")

    return nodes, edges


# ─────────────────────────────────────────────
# NEO4J
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

    def write_ontology_graph(self, nodes, edges):
        if not self.driver:
            logger.warning("[neo4j offline] Driver not initialized, skipping write")
            return
        try:
            with self.driver.session() as s:
                logger.info("Clearing old ontology graph...")
                s.run("MATCH (n:Ontology) DETACH DELETE n")

                s.run("CREATE INDEX IF NOT EXISTS FOR (o:Ontology) ON (o.code)")

                logger.info("Writing 8 ontology nodes...")
                for code, meta in nodes.items():
                    s.run("""
                        CREATE (o:Ontology {
                            code: $code, name: $name, emoji: $emoji,
                            color: $color, paper_count: $pc,
                            keyword_count: $kc, sample_kws: $sk,
                            sample_papers: $sp, paper_ids: $pids
                        })
                    """, code=code, name=meta["name"], emoji=meta["emoji"],
                         color=meta["color"], pc=meta["paper_count"],
                         kc=meta["keyword_count"], sk=meta["sample_kws"],
                         sp=json.dumps(meta["sample_papers"]), pids=meta.get("paper_ids", []))

                logger.info(f"Writing {len(edges)} ontology edges...")
                for (a, b), meta in edges.items():
                    s.run("""
                        MATCH (oa:Ontology {code: $a})
                        MATCH (ob:Ontology {code: $b})
                        CREATE (oa)-[:CO_OCCURS {weight: $w}]->(ob)
                    """, a=a, b=b, w=meta["weight"])
            logger.info("Neo4j write complete")
        except Exception as e:
            logger.warning(f"[neo4j offline] Failed to write ontology graph: {e}")

    def get_ontology_graph_for_viz(self) -> dict:
        if not self.driver:
            logger.warning("[neo4j offline] Driver not initialized, returning empty viz")
            return {"nodes": [], "edges": [], "papers_by_ontology": {}}
        try:
            with self.driver.session() as s:
                onto_rows = s.run("""
                    MATCH (o:Ontology)
                    RETURN o.code AS code, o.name AS name, o.emoji AS emoji,
                           o.color AS color, o.paper_count AS paper_count,
                           o.keyword_count AS keyword_count,
                           o.sample_kws AS sample_kws,
                           o.sample_papers AS sample_papers
                """).data()

                edge_rows = s.run("""
                    MATCH (a:Ontology)-[r:CO_OCCURS]->(b:Ontology)
                    RETURN a.code AS source, b.code AS target, r.weight AS weight
                    ORDER BY r.weight DESC
                """).data()

            nodes = [{"data": {
                "id":            r["code"],
                "label":         f"{r['emoji']} {r['name']}",
                "code":          r["code"],
                "color":         r["color"],
                "paper_count":   r["paper_count"]   or 0,
                "keyword_count": r["keyword_count"] or 0,
                "sample_kws":    r["sample_kws"]    or [],
                "sample_papers": json.loads(r["sample_papers"]) if r["sample_papers"] else [],
            }} for r in onto_rows]

            edges = [{"data": {
                "id":     f"{r['source']}-{r['target']}",
                "source": r["source"],
                "target": r["target"],
                "weight": r["weight"],
            }} for r in edge_rows]

            logger.info(f"Returning viz: {len(nodes)} nodes, {len(edges)} edges")
            return {"nodes": nodes, "edges": edges, "papers_by_ontology": {}}
        except Exception as e:
            logger.warning(f"[neo4j offline] Failed to fetch ontology graph viz: {e}")
            return {"nodes": [], "edges": [], "papers_by_ontology": {}}

    def get_ontology_node(self, code: str) -> dict | None:
        """Fetch a single ontology node's stored data — used by expand to
        get its paper_ids pool plus display metadata (name/color/emoji)."""
        if not self.driver:
            return None
        try:
            with self.driver.session() as s:
                row = s.run("""
                    MATCH (o:Ontology {code: $code})
                    RETURN o.name AS name, o.emoji AS emoji, o.color AS color,
                           o.paper_count AS paper_count, o.paper_ids AS paper_ids
                """, code=code).single()
            if not row:
                return None
            return {
                "name": row["name"], "emoji": row["emoji"], "color": row["color"],
                "paper_count": row["paper_count"] or 0,
                "paper_ids": row["paper_ids"] or [],
            }
        except Exception as e:
            logger.warning(f"[neo4j offline] Failed to fetch single ontology node: {e}")
            return None


# ─────────────────────────────────────────────
# PIPELINE
# ─────────────────────────────────────────────
class OntologyGraphPipeline:
    def __init__(self):
        self.pg    = PostgresClient()
        self.neo4j = Neo4jClient()
        # Separate connection using knowledge_graph.py's richer PostgresClient
        # (title/abstract/full_text + the dedicated `keywords` table), reused
        # as-is for expand so we get the same quality of data the main
        # search pipeline uses, instead of re-deriving it from papers.keywords.
        self.kg_pg = KGPostgresClient()

    def run(self) -> dict:
        logger.info("=== Ontology Pipeline Start ===")
        papers = self.pg.get_papers_with_keywords()
        onto_nodes, onto_edges = build_ontology_graph(papers)
        self.neo4j.write_ontology_graph(onto_nodes, onto_edges)
        result = self.neo4j.get_ontology_graph_for_viz()
        logger.info("=== Ontology Pipeline Complete ===")
        return result

    def expand_ontology(self, code: str, limit: int = ONTOLOGY_EXPAND_PAPER_LIMIT) -> dict:
        """
        Turn one ontology category (e.g. "MICRO") into a real concept
        sub-graph: pull a batch of its papers, normalize their keywords into
        canonical concepts + typed relationships via the LLM (Gemini or
        Ollama, whichever knowledge_graph.py is configured for), and return
        Cytoscape-ready nodes/edges the frontend can graft onto the clicked
        ontology node.
        """
        if code not in ONTOLOGIES:
            raise ValueError(f"Unknown ontology code: {code}")

        onto_meta = self.neo4j.get_ontology_node(code)
        if not onto_meta or not onto_meta.get("paper_ids"):
            return {"nodes": [], "edges": [], "error":
                    f"No stored papers for ontology '{code}' — run/rebuild the ontology graph first."}

        onto_name = onto_meta["name"]
        paper_ids = onto_meta["paper_ids"][:limit]
        logger.info(f"=== Expand '{code}' ({onto_name}) | {len(paper_ids)}/{onto_meta['paper_count']} papers ===")

        papers = self.kg_pg.get_papers_by_ids(paper_ids)
        if not papers:
            return {"nodes": [], "edges": [], "error": f"Could not fetch papers for '{code}'"}

        paper_keywords = self.kg_pg.get_keywords_for_papers(paper_ids)

        # Same text-mined fallback the main search pipeline uses, in case the
        # dedicated `keywords` table is thin for some of these papers.
        extra_keywords = extract_extra_keywords(papers)
        for pid, kws in extra_keywords.items():
            paper_keywords.setdefault(pid, [])
            paper_keywords[pid].extend({"keyword": k, "score": 0.5} for k in kws)

        all_kws = [onto_name]
        for rows in paper_keywords.values():
            all_kws.extend(r["keyword"] for r in rows if r.get("keyword"))

        logger.info(f"Collected {len(all_kws)} raw keywords from {len(papers)} papers for '{code}'")

        llm_data = normalize_concepts_with_llm(onto_name, all_kws)
        nodes, edges = build_graph(onto_name, papers, paper_keywords, llm_data,
                                    max_concepts=ONTOLOGY_EXPAND_MAX_CONCEPTS)

        # The "query" node build_graph creates for onto_name is redundant —
        # the ontology node already exists in the caller's graph. Drop it and
        # rewire any edges that pointed at it to point at `code` instead, so
        # the frontend can graft everything straight onto the existing node.
        root_key = None
        canonical_map = llm_data.get("canonical_map", {})
        resolved_root = canonical_map.get(onto_name.lower().strip())
        root_key = resolved_root if resolved_root in nodes else onto_name.lower().strip()

        out_nodes = []
        for concept, meta in nodes.items():
            if concept == root_key:
                continue
            out_nodes.append({"data": {
                "id": concept, "label": concept,
                "weight": meta.get("weight", 0),
                "relevance": meta.get("relevance") or 0.0,
                "is_query": False,
                "parent_ontology": code,
                "papers": meta.get("papers", [])[:6],
            }})

        out_edges = []
        for (a, b), meta in edges.items():
            src = code if a == root_key else a
            tgt = code if b == root_key else b
            if src == tgt:
                continue
            out_edges.append({"data": {
                "source": src, "target": tgt,
                "weight": meta.get("weight", 1),
                "relation": meta.get("relation", "co_occurs_with"),
            }})

        result = {"nodes": out_nodes, "edges": out_edges,
                  "ontology_code": code, "papers_considered": len(papers)}
        if llm_data.get("llm_failed"):
            result["warning"] = ("LLM normalization failed for this expansion — showing raw "
                                  "keywords with co-occurrence-only edges. Check server logs.")
        elif not llm_data.get("relationships"):
            result["warning"] = "The LLM returned no typed relationships here — edges are co-occurrence only."

        logger.info(f"=== Expand '{code}' complete: {len(out_nodes)} concepts, {len(out_edges)} edges ===")
        return result

    def close(self):
        self.neo4j.close()


if __name__ == "__main__":
    pipeline = OntologyGraphPipeline()
    try:
        result = pipeline.run()
        print(json.dumps({
            "nodes": len(result["nodes"]),
            "edges": len(result["edges"]),
            "distribution": [
                f"{n['data']['label']}: {n['data']['paper_count']} papers"
                for n in sorted(result["nodes"], key=lambda x: -x["data"]["paper_count"])
            ]
        }, indent=2))
    finally:
        pipeline.close()