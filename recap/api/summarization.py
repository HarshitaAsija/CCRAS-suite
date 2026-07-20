from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List
from services.summarization_service import SummarizationService
from app.database import get_db
from app.models import Paper
from app.models_uploaded import UploadedPaper

router = APIRouter()
summarization_service = SummarizationService()


class PaperIdRequest(BaseModel):
    paper_id: str


class PaperIdsRequest(BaseModel):
    paper_ids: List[str]


@router.post("/api/summarize/single")
async def summarize_single_paper(request: PaperIdRequest, db: Session = Depends(get_db)):
    """
    Generate a summary for a single paper.
    """

    # First check uploaded papers
    paper = (
        db.query(UploadedPaper)
        .filter(UploadedPaper.id == request.paper_id)
        .first()
    )

    # Otherwise check existing papers
    if not paper:
        paper = (
            db.query(Paper)
            .filter(Paper.id == request.paper_id)
            .first()
        )

    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    text_to_summarize = ""
    if paper.abstract:
        text_to_summarize += paper.abstract

    if paper.full_text:
        if text_to_summarize:
            text_to_summarize += " "
        text_to_summarize += paper.full_text

    if not text_to_summarize.strip():
        raise HTTPException(
            status_code=400,
            detail="Paper has no content to summarize"
        )

    summary = summarization_service.summarize_single(text_to_summarize)

    return {
        "paper_id": str(paper.id),
        "summary": summary,
        "model": "bart-large-cnn"
    }


@router.post("/api/summarize/findings")
async def extract_findings_and_methodology(request: PaperIdRequest, db: Session = Depends(get_db)):
    """
    Extract key findings and methodology from a paper.
    """

    # First check uploaded papers
    paper = (
        db.query(UploadedPaper)
        .filter(UploadedPaper.id == request.paper_id)
        .first()
    )

    # Otherwise check existing papers
    if not paper:
        paper = (
            db.query(Paper)
            .filter(Paper.id == request.paper_id)
            .first()
        )

    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    full_text = ""
    if paper.abstract:
        full_text += paper.abstract

    if paper.full_text:
        if full_text:
            full_text += " "
        full_text += paper.full_text

    if not full_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Paper has no content to analyze"
        )

    sentences = [s.strip() for s in full_text.split(".") if s.strip()]

    key_findings = []
    methodology = []

    finding_keywords = [
        "found",
        "showed",
        "demonstrated",
        "results",
        "concluded",
        "revealed",
        "indicate",
    ]

    method_keywords = [
        "used",
        "employed",
        "analyzed",
        "measured",
        "sample",
        "method",
        "conducted",
        "study",
    ]

    for sentence in sentences:
        lower_sentence = sentence.lower()

        if any(keyword in lower_sentence for keyword in finding_keywords):
            key_findings.append(sentence)

        if any(keyword in lower_sentence for keyword in method_keywords):
            methodology.append(sentence)

    return {
        "paper_id": str(paper.id),
        "key_findings": key_findings,
        "methodology": methodology,
    }


@router.post("/api/summarize/compare")
async def compare_papers(request: PaperIdsRequest, db: Session = Depends(get_db)):
    """
    Generate a comparative summary and extract common themes from multiple papers.
    """
    if not request.paper_ids:
        raise HTTPException(status_code=400, detail="No paper IDs provided")

    papers = []

    for paper_id in request.paper_ids:
        paper = db.query(Paper).filter(Paper.id == paper_id).first()

        if not paper:
            raise HTTPException(
                status_code=404,
                detail=f"Paper with ID {paper_id} not found",
            )

        papers.append(paper)

    abstracts = [paper.abstract or "" for paper in papers]
    combined_abstract = " ".join(abstracts).strip()

    if not combined_abstract:
        raise HTTPException(
            status_code=400,
            detail="No abstracts available for the provided papers",
        )

    comparative_summary = summarization_service.summarize_single(combined_abstract)

    stopwords = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "should",
        "could", "may", "might", "must", "can", "i", "you", "he", "she", "it",
        "we", "they", "me", "him", "her", "us", "them", "this", "that", "these",
        "those", "am", "as", "from", "its", "their", "there", "where", "when",
        "how", "what", "which", "who", "whom", "why",
    }

    def get_words(text: str) -> set:
        import re

        words = re.findall(r"\b\w+\b", text.lower())
        return {
            word
            for word in words
            if word not in stopwords and len(word) > 2
        }

    word_sets = []

    for paper in papers:
        text = f"{paper.title or ''} {paper.abstract or ''}"
        word_sets.append(get_words(text))

    if word_sets:
        common_themes = sorted(list(set.intersection(*word_sets)))[:10]
    else:
        common_themes = []

    paper_titles = [
        paper.title or f"Paper {paper.id}"
        for paper in papers
    ]

    return {
        "papers": paper_titles,
        "comparative_summary": comparative_summary,
        "common_themes": common_themes,
        "paper_count": len(papers),
    }