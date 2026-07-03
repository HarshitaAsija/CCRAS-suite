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

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

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

@router.get("/collections", summary="List all available RISHI evidence collections")
def list_collections():
    """Returns a summary list of all available evidence collections from RISHI/RECAP."""
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
        "source": "RISHI-RECAP Mock Adapter v1",
        "note": "In production, this proxies to the live RISHI evidence discovery API."
    }


@router.get("/collections/{collection_id}", summary="Fetch a specific RISHI evidence collection")
def get_collection(collection_id: str):
    """
    Fetch a specific evidence collection from RISHI by ID.
    Returns full paper list, hypothesis seed, gaps, and summary.
    """
    collection = MOCK_COLLECTIONS.get(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail=f"Evidence collection '{collection_id}' not found in RISHI adapter.")
    return collection


@router.post("/handoff", summary="Convert a RISHI collection into a Brahma-ready handoff payload")
def create_handoff(request: HandoffRequest):
    """
    Converts a RISHI evidence collection into a structured handoff payload
    that Brahma's study design workflow can consume.
    This is the primary integration point between RISHI and BRAHMA.
    """
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
    return handoff


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
