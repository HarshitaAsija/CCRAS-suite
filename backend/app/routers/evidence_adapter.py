"""
Evidence Adapter Router — RISHI → BRAHMA Interface

This module provides a clean API boundary between the RISHI evidence
discovery pipeline and the BRAHMA study design module.

Architecture:
  - RISHI (or RECAP) produces evidence collections (papers, hypotheses, gaps)
  - Brahma NEVER scrapes literature itself
  - Brahma consumes evidence ONLY through this adapter interface
  - In production, these endpoints would proxy to RISHI's live API
  - In development/mock mode, they return structured mock payloads
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import MetaData, Table, func, inspect, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(prefix="/evidence", tags=["evidence-adapter"])


# ─── Schemas ───────────────────────────────────────────────────────────────────

class EvidencePaper(BaseModel):
    id: str
    title: str
    authors: str
    year: str
    journal: Optional[str] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None
    abstract: Optional[str] = None
    evidence_level: str  # "High", "Medium", "Low"
    source: str          # "PubMed", "bioRxiv", "RECAP"
    tags: List[str] = []


class EvidenceCollection(BaseModel):
    collection_id: str
    hypothesis_seed: str
    query_used: str
    paper_count: int
    created_at: str
    papers: List[EvidencePaper]
    gaps: List[str]
    summary: str


class HandoffPayload(BaseModel):
    collection_id: str
    hypothesis_seed: str
    sources: List[Dict[str, Any]]
    gaps: List[str]
    query: Optional[str] = None
    summary: Optional[str] = None


class HandoffRequest(BaseModel):
    collection_id: str


AYUSH_TERMS = [
    "ashwagandha",
    "withania somnifera",
    "curcumin",
    "turmeric",
    "resveratrol",
    "guduchi",
    "tinospora cordifolia",
    "amla",
    "amalaki",
    "triphala",
    "brahmi",
    "shatavari",
    "shallaki",
    "haridra",
    "tulsi",
    "ginger",
    "yoga",
]

CONDITION_TERMS = [
    "diabetes",
    "osteoarthritis",
    "anxiety",
    "stress",
    "inflammation",
    "obesity",
    "hypertension",
    "arthritis",
    "cancer",
    "asthma",
    "covid",
]

OUTCOME_TERMS = [
    "pain",
    "cortisol",
    "glucose",
    "hba1c",
    "inflammation",
    "quality of life",
    "anxiety",
    "sleep",
    "safety",
]


def _value(record: Any, *names: str) -> Any:
    if isinstance(record, dict):
        for name in names:
            if name in record and record[name] is not None:
                return record[name]
        return None
    for name in names:
        value = getattr(record, name, None)
        if value is not None:
            return value
    return None


def _paper_title(paper: Any) -> str:
    return _value(paper, "title", "raw_title", "paper_title", "name") or ""


def _paper_abstract(paper: Any) -> str:
    return _value(paper, "abstract", "abstract_text", "summary", "description") or ""


def _paper_url(paper: Any) -> str:
    return _value(paper, "url", "source_url", "pdf_url", "doi_url") or ""


def _paper_year(paper: Any) -> str:
    year = _value(paper, "year", "publication_year", "published_year")
    if year:
        return str(year)
    publication_date = _value(paper, "publication_date", "published_date", "date", "created_at")
    return str(publication_date.year) if hasattr(publication_date, "year") else "Unknown"


def _authors_text(authors: Any) -> str:
    if isinstance(authors, list):
        return ", ".join(str(author) for author in authors[:3])
    if isinstance(authors, dict):
        return ", ".join(str(value) for value in list(authors.values())[:3])
    return str(authors or "Unknown authors")


def _evidence_level(paper: Any) -> str:
    text = f"{_paper_title(paper)} {_paper_abstract(paper)}".lower()
    if any(term in text for term in ["systematic review", "meta-analysis", "randomized", "randomised", "clinical trial", "rct"]):
        return "High"
    if any(term in text for term in ["cohort", "case-control", "pilot", "observational"]):
        return "Medium"
    return "Low"


def _matching_tags(paper: Any, query: str) -> List[str]:
    text = f"{_paper_title(paper)} {_paper_abstract(paper)}".lower()
    tags: List[str] = []
    for term in [*AYUSH_TERMS, *CONDITION_TERMS, *OUTCOME_TERMS]:
        if term in text and term.title() not in tags:
            tags.append(term.title())
        if len(tags) >= 5:
            break
    for term in query.lower().split():
        clean = term.strip(" ,.;:()[]{}")
        if len(clean) > 3 and clean in text and clean.title() not in tags:
            tags.append(clean.title())
        if len(tags) >= 5:
            break
    return tags


def _first_match_priority(query: str, corpus: str, terms: List[str]) -> Optional[str]:
    import re
    q_lowered = query.lower()
    # 1. First check exact matches in the query string
    for term in terms:
        if re.search(r"\b" + re.escape(term) + r"\b", q_lowered):
            return term.title()
    
    # 2. Then check matches in the corpus
    c_lowered = corpus.lower()
    for term in terms:
        if re.search(r"\b" + re.escape(term) + r"\b", c_lowered):
            return term.title()
    return None


def _infer_brahma_fields(papers: List[Any], query: str) -> Dict[str, Any]:
    corpus = " ".join(f"{_paper_title(p)} {_paper_abstract(p)}" for p in papers[:20])
    intervention = _first_match_priority(query, corpus, AYUSH_TERMS) or (query.title() if query else "Selected intervention")
    condition = _first_match_priority(query, corpus, CONDITION_TERMS) or "the target clinical population"
    outcome = _first_match_priority(query, corpus, OUTCOME_TERMS) or "primary clinical outcome and safety biomarkers"

    population = f"Adults with {condition}"
    comparator = "placebo or standard care"
    hypothesis_seed = (
        f"{intervention} may improve {outcome} compared with {comparator} in {population.lower()}, "
        f"but the current literature needs a rigorously designed clinical study."
    )

    return {
        "title": f"Evidence-based study of {intervention} for {condition}",
        "pico": {
            "population": population,
            "intervention": intervention,
            "comparator": comparator,
            "outcome": outcome,
        },
        "hypothesis_seed": hypothesis_seed,
        "ayurveda": {
            "formulation": intervention,
            "dosage": "",
            "anupana": "Ushnodaka",
            "prakriti": "Vata-Pitta",
            "duration": "12 Weeks",
            "safety": "LFT/RFT and adverse-event monitoring every 4 weeks",
            "standardization": "API compliant batch standardization to be confirmed",
        },
    }


def _pick_column(table: Table, *candidates: str) -> Any:
    for candidate in candidates:
        if candidate in table.c:
            return table.c[candidate]
    return None


def _reflect_paper_table(db: Session, table_names: set[str]) -> Table:
    if "papers" in table_names:
        table_name = "papers"
    elif "library_papers" in table_names:
        table_name = "library_papers"
    else:
        table_name = "raw_papers"

    metadata = MetaData()
    return Table(table_name, metadata, autoload_with=db.bind)


# ─── Mock Data ─────────────────────────────────────────────────────────────────

MOCK_COLLECTIONS: Dict[str, EvidenceCollection] = {
    "COL-9942": EvidenceCollection(
        collection_id="COL-9942",
        hypothesis_seed="Targeting the NLRP3 inflammasome with natural polyphenols (Curcumin, Resveratrol) may provide adjuvant therapeutic benefit in Type 2 Diabetes Mellitus.",
        query_used="NLRP3 inflammasome polyphenols AYUSH diabetes",
        paper_count=42,
        created_at="2026-06-30T10:00:00Z",
        gaps=[
            "No head-to-head RCT comparing Curcumin vs. Resveratrol on NLRP3 in T2DM.",
            "Limited data on long-term safety in geriatric populations.",
            "No standardized dosing guidelines in AYUSH context."
        ],
        summary="42 papers from PubMed and bioRxiv supporting the role of natural polyphenols in NLRP3-mediated inflammation in T2DM. Strong pre-clinical evidence. Clinical RCT data sparse.",
        papers=[
            EvidencePaper(id="p1", title="Curcumin inhibits NLRP3 inflammasome activation in macrophages", authors="Zhao et al.", year="2022", journal="J. Immunology", doi="10.1016/j.jep.2022.115021", evidence_level="High", source="PubMed", tags=["NLRP3", "Curcumin", "Macrophage"]),
            EvidencePaper(id="p2", title="Resveratrol attenuates IL-1β secretion via NLRP3 suppression in adipose tissue", authors="Singh et al.", year="2021", journal="Phytomedicine", doi="10.1016/j.phymed.2021.153620", evidence_level="High", source="PubMed", tags=["Resveratrol", "IL-1β", "Adipose"]),
            EvidencePaper(id="p3", title="Systematic review: Polyphenols and inflammasome-mediated pathways in T2DM", authors="Verma & Patel", year="2023", journal="Nutrients", doi="10.3390/nu15030712", evidence_level="High", source="PubMed", tags=["T2DM", "Inflammasome", "Review"]),
            EvidencePaper(id="p4", title="AYUSH polyphenol standardization for clinical trials: a regulatory framework", authors="CCRAS Working Group", year="2022", journal="J. Ayurveda Integr. Med.", doi="10.1016/j.jaim.2022.100558", evidence_level="Medium", source="PubMed", tags=["AYUSH", "Standardization", "Regulatory"]),
        ]
    ),
    "COL-2910": EvidenceCollection(
        collection_id="COL-2910",
        hypothesis_seed="Ashwagandha (Withania somnifera) supplementation demonstrates neuroprotective and anxiolytic effects in chronic stress and generalized anxiety disorders.",
        query_used="Ashwagandha anxiolytic neuroprotective anxiety cortisol",
        paper_count=28,
        created_at="2026-07-01T08:00:00Z",
        gaps=[
            "Limited long-term RCT data beyond 12 weeks.",
            "No standardized biomarker panel across existing studies.",
            "Underrepresentation of female participants in cortisol-linked studies."
        ],
        summary="28 papers from PubMed and bioRxiv supporting anxiolytic and neuroprotective effects of Ashwagandha. Good clinical evidence from short-duration RCTs. Gaps in long-term outcomes.",
        papers=[
            EvidencePaper(id="p5", title="Efficacy of Ashwagandha in anxiety disorders: a systematic review", authors="Pratte et al.", year="2014", journal="J. Clin. Psychiatry", doi="10.3389/fpsyt.2014.00192", evidence_level="High", source="PubMed", tags=["Ashwagandha", "Anxiety", "RCT"]),
            EvidencePaper(id="p6", title="Withania somnifera root extract reduces cortisol in chronically stressed adults", authors="Chandrasekhar et al.", year="2012", journal="Indian J Psychol Med", doi="10.4103/0253-7176.106022", evidence_level="High", source="PubMed", tags=["Cortisol", "Ashwagandha", "Stress"]),
            EvidencePaper(id="p7", title="Standardization of Ashwagandha Churna as per Ayurvedic Pharmacopoeia", authors="Sharma et al.", year="2021", journal="J. Ethnopharmacol.", doi="10.1016/j.jep.2021.114512", evidence_level="Medium", source="PubMed", tags=["API", "Standardization", "Churna"]),
        ]
    )
}


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/brahma/live-paper-handoff", summary="Build a temporary Brahma handoff from live database papers")
def create_live_brahma_handoff(
    query: str = Query("", description="Optional topic search across paper titles, abstracts, and journals"),
    limit: int = Query(30, ge=1, le=100, description="Maximum number of live papers to include"),
    db: Session = Depends(get_db),
):
    """
    Temporary Brahma-owned demo bridge.

    This reads the shared papers table directly until RISHI/RECAP provide a
    production evidence collection API. It keeps the same handoff shape Brahma
    will consume later, so the UI and protocol workflow remain reusable.
    """
    try:
        table_names = set(inspect(db.bind).get_table_names())
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail=f"Database is not reachable for Brahma live handoff: {exc}") from exc

    if not {"papers", "library_papers", "raw_papers"}.intersection(table_names):
        raise HTTPException(
            status_code=503,
            detail="No papers, library_papers, or raw_papers table found in the configured database. Check POSTGRES_* env values before the demo.",
        )

    try:
        paper_table = _reflect_paper_table(db, table_names)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail=f"Unable to inspect Recap paper table: {exc}") from exc

    title_column = _pick_column(paper_table, "title", "raw_title", "paper_title", "name")
    abstract_column = _pick_column(paper_table, "abstract", "abstract_text", "summary", "description")
    journal_column = _pick_column(paper_table, "journal", "journal_name", "source_name")
    date_column = _pick_column(paper_table, "publication_date", "published_date", "date", "created_at")
    created_column = _pick_column(paper_table, "created_at", "updated_at")
    if title_column is None:
        raise HTTPException(
            status_code=503,
            detail=f"Recap table '{paper_table.name}' has no recognizable title column. Available columns: {', '.join(paper_table.c.keys())}",
        )

    statement = select(paper_table)
    clean_query = query.strip()
    if clean_query:
        terms = [term.strip() for term in clean_query.split() if len(term.strip()) > 2]
        filters = []
        searchable_columns = [col for col in [title_column, abstract_column, journal_column] if col is not None]
        for term in terms:
            like = f"%{term}%"
            filters.extend([column.ilike(like) for column in searchable_columns])
        if filters:
            statement = statement.where(or_(*filters))

    try:
        total_matches = db.execute(select(func.count()).select_from(statement.subquery())).scalar_one()
        order_columns = [col.desc().nullslast() for col in [date_column, created_column] if col is not None]
        if order_columns:
            statement = statement.order_by(*order_columns)
        papers = [dict(row) for row in db.execute(statement.limit(limit)).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail=f"Unable to read live papers for Brahma handoff: {exc}") from exc

    if not papers:
        raise HTTPException(status_code=404, detail="No papers found in the live database for this Brahma handoff.")

    inferred = _infer_brahma_fields(papers, clean_query)
    sources = [
        {
            "id": str(_value(paper, "id", "paper_id") or ""),
            "title": _paper_title(paper),
            "authors": _authors_text(_value(paper, "authors", "author_names", "authors_text")),
            "year": _paper_year(paper),
            "journal": _value(paper, "journal", "journal_name", "source_name"),
            "doi": _value(paper, "doi"),
            "pmid": _value(paper, "pmid", "pubmed_id"),
            "abstract": _paper_abstract(paper),
            "url": _paper_url(paper),
            "evidenceLevel": _evidence_level(paper),
            "source": _value(paper, "source", "source_name") or f"PostgreSQL {paper_table.name}",
            "tags": _matching_tags(paper, clean_query),
        }
        for paper in papers
    ]
    high_quality = sum(1 for source in sources if source["evidenceLevel"] == "High")

    gaps = [
        f"{len(papers)} papers are available for Brahma, but a curated RECAP collection is still pending.",
        "Brahma can draft the protocol now; RISHI should later re-check novelty and gap strength.",
        "Dosage, formulation standardization, and comparator choice still require investigator confirmation.",
    ]

    return {
        "collection_id": f"LIVE-DB-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "hypothesis_seed": inferred["hypothesis_seed"],
        "query": clean_query or "latest papers in shared database",
        "summary": (
            f"Loaded {len(papers)} live papers from PostgreSQL"
            f"{f' for {clean_query}' if clean_query else ''}. "
            f"{high_quality} sources were classified as high evidence by Brahma's temporary rule engine. "
            "This bridge will be replaced by the RISHI/RECAP collection API when upstream modules are ready."
        ),
        "gaps": gaps,
        "sources": sources,
        "source": "Brahma Live DB Bridge",
        "table": paper_table.name,
        "total_matches": total_matches,
        "included_papers": len(papers),
        "pico_suggestion": inferred["pico"],
        "title_suggestion": inferred["title"],
        "ayurveda_suggestion": inferred["ayurveda"],
        "created_at": datetime.now().isoformat(),
    }


@router.get("/collections", summary="List all available RISHI evidence collections")
def list_collections(db: Session = Depends(get_db)):
    """Returns a summary list of all available evidence collections from RISHI/RECAP."""
    try:
        from sqlalchemy import text
        result = db.execute(text("""
            SELECT id, title, study_count, last_published_year, status 
            FROM gap_candidates 
            WHERE status IN ('scored', 'seeded')
            ORDER BY novelty_score DESC NULLS LAST
            LIMIT 50
        """)).mappings().all()
        
        if result:
            collections = []
            for r in result:
                collections.append({
                    "collection_id": str(r["id"]),
                    "hypothesis_seed": r["title"] or "No hypothesis seed text",
                    "paper_count": r["study_count"] or 0,
                    "created_at": datetime.now().isoformat()
                })
            return {
                "collections": collections,
                "source": "RISHI Live DB Adapter",
                "note": "Fetched dynamically from gap_candidates table."
            }
    except Exception as e:
        print(f"Error querying live gaps, falling back to mocks: {e}")
        
    return {
        "collections": [
            {
                "collection_id": c.collection_id,
                "hypothesis_seed": c.hypothesis_seed[:120] + "...",
                "paper_count": c.paper_count,
                "created_at": c.created_at,
            }
            for c in MOCK_COLLECTIONS.values()
        ],
        "source": "RISHI-RECAP Mock Adapter v1 (Fallback)",
        "note": "Database query failed; returned mock fallback."
    }


@router.get("/collections/{collection_id}", summary="Fetch a specific RISHI evidence collection")
def get_collection(collection_id: str, db: Session = Depends(get_db)):
    """
    Fetch a specific evidence collection from RISHI by ID.
    Returns full paper list, hypothesis seed, gaps, and summary.
    """
    try:
        import json
        from sqlalchemy import text
        
        gap_row = db.execute(text("""
            SELECT id, title, description, topic, domain, subdomain, study_count, 
                   source_paper_ids, supporting_papers_detail
            FROM gap_candidates 
            WHERE id = :gap_id
        """), {"gap_id": collection_id}).mappings().first()
        
        if gap_row:
            hyp_row = db.execute(text("""
                SELECT hypothesis_text, population, intervention, comparator, outcome, confidence
                FROM hypothesis_seeds 
                WHERE gap_id = :gap_id 
                LIMIT 1
            """), {"gap_id": collection_id}).mappings().first()
            
            hypothesis_seed = ""
            if hyp_row:
                hypothesis_seed = hyp_row["hypothesis_text"]
            else:
                hypothesis_seed = f"Targeting the gaps in {gap_row['topic']} with AYUSH formulations."
                
            papers = []
            detail = gap_row.get("supporting_papers_detail")
            if detail:
                try:
                    papers_data = json.loads(detail) if isinstance(detail, str) else detail
                    for idx, p in enumerate(papers_data):
                        papers.append(EvidencePaper(
                            id=str(p.get("paper_id") or f"p{idx}"),
                            title=p.get("title", "Untitled"),
                            authors=p.get("authors") or "Unknown",
                            year=str(p.get("year")) if p.get("year") else "Unknown",
                            journal=p.get("journal"),
                            doi=p.get("doi"),
                            pmid=p.get("pmid"),
                            abstract=p.get("gap_specific_abstract") or "",
                            evidence_level="High" if p.get("doi") else "Medium",
                            source="RISHI",
                            tags=[]
                        ))
                except Exception as e:
                    print(f"Error parsing supporting papers detail: {e}")
                    
            if not papers and gap_row.get("source_paper_ids"):
                source_ids = gap_row["source_paper_ids"]
                if source_ids:
                    paper_rows = db.execute(text("""
                        SELECT id, title, abstract, pmid, doi, published_at, journal, authors
                        FROM papers
                        WHERE id = ANY(:ids::uuid[])
                        LIMIT 15
                    """), {"ids": source_ids}).mappings().all()
                    for p in paper_rows:
                        papers.append(EvidencePaper(
                            id=str(p["id"]),
                            title=p["title"] or "Untitled",
                            authors=_authors_text(p.get("authors")),
                            year=str(p["published_at"].year) if p.get("published_at") else "Unknown",
                            journal=p.get("journal"),
                            doi=p.get("doi"),
                            pmid=p.get("pmid"),
                            abstract=p["abstract"][:500] if p["abstract"] else "",
                            evidence_level=_evidence_level(p),
                            source="PostgreSQL",
                            tags=_matching_tags(p, gap_row["topic"] or "")
                        ))
                        
            gaps = [gap_row["description"]] if gap_row["description"] else ["Research gap identified in literature analysis."]
            
            return EvidenceCollection(
                collection_id=str(gap_row["id"]),
                hypothesis_seed=hypothesis_seed,
                query_used=gap_row["topic"] or "",
                paper_count=gap_row["study_count"] or len(papers),
                created_at=datetime.now().isoformat(),
                papers=papers,
                gaps=gaps,
                summary=f"Dynamically loaded evidence for gap ID: {collection_id} on topic '{gap_row['topic']}'."
            )
    except Exception as e:
        print(f"Error fetching live collection, falling back: {e}")
        
    collection = MOCK_COLLECTIONS.get(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail=f"Evidence collection '{collection_id}' not found.")
    return collection


@router.post("/handoff", summary="Convert a RISHI collection into a Brahma-ready handoff payload")
def create_handoff(request: HandoffRequest, db: Session = Depends(get_db)):
    """
    Converts a RISHI evidence collection into a structured handoff payload
    that Brahma's study design workflow can consume.
    This is the primary integration point between RISHI and BRAHMA.
    """
    try:
        col = get_collection(request.collection_id, db)
        
        from sqlalchemy import text
        hyp_row = db.execute(text("""
            SELECT population, intervention, comparator, outcome, hypothesis_text, confidence
            FROM hypothesis_seeds 
            WHERE gap_id = :gap_id 
            LIMIT 1
        """), {"gap_id": request.collection_id}).mappings().first()
        
        pico_suggestion = {
            "population": hyp_row["population"] if hyp_row and hyp_row["population"] else "Target clinical population",
            "intervention": hyp_row["intervention"] if hyp_row and hyp_row["intervention"] else "AYUSH Formulation",
            "comparator": hyp_row["comparator"] if hyp_row and hyp_row["comparator"] else "Placebo or standard care",
            "outcome": hyp_row["outcome"] if hyp_row and hyp_row["outcome"] else "Primary efficacy biomarker"
        }
        
        title_suggestion = f"Efficacy of {pico_suggestion['intervention']} for {pico_suggestion['population']}"
        
        ayurveda_suggestion = {
            "formulation": pico_suggestion["intervention"],
            "dosage": "As per Ayurvedic Pharmacopoeia of India guidelines",
            "anupana": "Warm water (Ushnodaka)",
            "prakriti": "Vata-Pitta",
            "duration": "12 Weeks",
            "safety": "LFT/RFT safety parameters monitored at baseline and weekly",
            "standardization": "Batch standardization as per API guidelines"
        }
        
        return {
            "collection_id": col.collection_id,
            "hypothesis_seed": col.hypothesis_seed,
            "query": col.query_used,
            "summary": col.summary,
            "gaps": col.gaps,
            "sources": [
                {
                    "title": p.title,
                    "authors": p.authors,
                    "year": p.year,
                    "journal": p.journal,
                    "doi": p.doi,
                    "pmid": p.pmid,
                    "evidenceLevel": p.evidence_level,
                    "source": p.source,
                    "tags": p.tags,
                }
                for p in col.papers
            ],
            "pico_suggestion": pico_suggestion,
            "title_suggestion": title_suggestion,
            "ayurveda_suggestion": ayurveda_suggestion
        }
    except Exception as e:
        print(f"Error in handoff integration, falling back: {e}")
        
    collection = MOCK_COLLECTIONS.get(request.collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail=f"Collection '{request.collection_id}' not found.")

    handoff = HandoffPayload(
        collection_id=collection.collection_id,
        hypothesis_seed=collection.hypothesis_seed,
        query=collection.query_used,
        summary=collection.summary,
        gaps=collection.gaps,
        sources=[
            {
                "title": p.title,
                "authors": p.authors,
                "year": p.year,
                "journal": p.journal,
                "doi": p.doi,
                "pmid": p.pmid,
                "evidenceLevel": p.evidence_level,
                "source": p.source,
                "tags": p.tags,
            }
            for p in collection.papers
        ]
    )
    
    return {
        "collection_id": handoff.collection_id,
        "hypothesis_seed": handoff.hypothesis_seed,
        "query": handoff.query,
        "summary": handoff.summary,
        "gaps": handoff.gaps,
        "sources": handoff.sources,
        "pico_suggestion": {
            "population": "Adults with Type 2 Diabetes Mellitus",
            "intervention": "Curcumin Extract",
            "comparator": "Placebo capsule",
            "outcome": "NLRP3 inflammation reduction"
        },
        "title_suggestion": "Adjuvant Polyphenol Therapy for NLRP3 Inhibition in T2DM",
        "ayurveda_suggestion": {
            "formulation": "Haridra (Curcuma longa) Extract",
            "dosage": "500 mg twice daily",
            "anupana": "Warm water (Ushnodaka)"
        }
    }


@router.post("/validate-handoff", summary="Validate that a Brahma handoff payload is structurally complete")
def validate_handoff(payload: HandoffPayload):
    """
    Validates that an incoming handoff from RISHI has the required fields
    for Brahma to use it to bootstrap a study protocol.
    """
    issues = []
    if not payload.hypothesis_seed or len(payload.hypothesis_seed) < 20:
        issues.append("hypothesis_seed is too short or missing.")
    if not payload.sources or len(payload.sources) == 0:
        issues.append("No evidence sources included in handoff.")
    if not payload.collection_id:
        issues.append("collection_id is required.")

    high_quality = [s for s in payload.sources if s.get("evidenceLevel") == "High"]

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "paper_count": len(payload.sources),
        "high_quality_sources": len(high_quality),
        "ready_for_brahma": len(issues) == 0 and len(payload.sources) > 0,
        "validated_at": datetime.now().isoformat()
    }
