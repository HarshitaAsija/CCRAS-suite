from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from uuid import UUID

from app.database import get_db
from app.models import Keyword, Paper, Collection, User
from app.models_uploaded import UploadedPaper, UploadedPaperKeyword
from ingestion.pipeline import save_papers
from ingestion.batch_ingestion import batch_ingest
from core.auth import get_current_user


class BatchIngestRequest(BaseModel):
    query: str
    sources: List[str]
    max_per_source: int


router = APIRouter(
    prefix="/api",
    tags=["ingestion"],
    responses={404: {"description": "Not found"}},
)


@router.get("/papers/{paper_id}/keywords")
def get_paper_keywords(paper_id: str, db: Session = Depends(get_db)):
    """
    Get all keywords for a specific paper.
    """
    try:
        paper_uuid = UUID(paper_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid paper ID format")

    # First check uploaded papers
    uploaded_paper = (
        db.query(UploadedPaper)
        .filter(UploadedPaper.id == paper_uuid)
        .first()
    )

    if uploaded_paper:
        keywords = (
            db.query(UploadedPaperKeyword)
            .filter(UploadedPaperKeyword.paper_id == paper_uuid)
            .all()
        )

        return [
            {
                "keyword": kw.keyword,
                "score": kw.score
            }
            for kw in keywords
        ]

    # Otherwise check existing papers
    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_uuid)
        .first()
    )

    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    keywords = (
        db.query(Keyword)
        .filter(Keyword.paper_id == paper_uuid)
        .all()
    )

    return [
        {
            "keyword": kw.keyword,
            "score": kw.score
        }
        for kw in keywords
    ]


@router.post("/ingest/save-papers")
def ingest_save_papers(
    papers: List[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save a list of papers from Khushi's scraper JSON.
    """
    try:
        saved_count = save_papers(papers, db)
        return {"saved_count": saved_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest/batch")
async def ingest_batch(
    request: BatchIngestRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Start a batch ingestion process from multiple sources.
    """
    background_tasks.add_task(
        batch_ingest,
        request.query,
        request.sources,
        request.max_per_source,
        db
    )

    return {"message": "Batch ingestion started in the background"}