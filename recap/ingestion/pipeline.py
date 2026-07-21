import logging
from datetime import datetime
from sqlalchemy.orm import Session
from rapidfuzz import fuzz
from keybert import KeyBERT
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.database import get_db
from app.models_uploaded import UploadedPaper, UploadedPaperKeyword
from ingestion.models import RawPaper

logger = logging.getLogger(__name__)
kw_model = KeyBERT()

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


def process_and_store(paper: RawPaper, db: Session):

    # Step 1 - Check DOI duplicate
    if paper.doi:
        exists = db.query(UploadedPaper).filter(UploadedPaper.doi == paper.doi).first()
        if exists:
            logger.info(f"Skipping duplicate DOI: {paper.doi}")
            return None

    # Step 2 - Check title similarity
    all_titles = db.query(UploadedPaper.title).all()
    for (existing_title,) in all_titles:
        similarity = fuzz.ratio(paper.title, existing_title) / 100
        if similarity > 0.95:
            logger.info(f"Skipping similar title: {paper.title}")
            return None

    # Step 3 - Extract keywords
    text = f"{paper.title} {paper.abstract}"
    keywords = kw_model.extract_keywords(text, top_n=10)

    # Step 4 - Store paper
    pub_date = paper.published_date
    if pub_date is not None and not isinstance(pub_date, str):
        pub_date = str(pub_date)

    db_paper = UploadedPaper(
        doi=paper.doi,
        title=paper.title,
        abstract=paper.abstract,
        full_text=paper.full_text,
        source=paper.source,
        published_date=pub_date,
        pmid=getattr(paper, 'pmid', None),
        arxiv_id=getattr(paper, 'arxiv_id', None),
        pdf_url=getattr(paper, 'pdf_url', None),
        authors=paper.authors,
        status='uploaded'
    )
    db.add(db_paper)
    db.flush()

    # Step 5 - Store keywords
    for kw, score in keywords:
        try:
            keyword = UploadedPaperKeyword(
                paper_id=db_paper.id,
                keyword=kw,
                score=score
            )
            db.add(keyword)
            db.flush()
        except Exception as e:
            if "duplicate key value violates unique constraint" in str(e):
                logger.debug(f"Duplicate keyword '{kw}' for paper {db_paper.id}, skipping")
                db.rollback()
                continue
            else:
                raise

    db.commit()
    logger.info(f"Stored paper: {paper.title}")
    return db_paper.id


def save_papers(papers: list, db: Session) -> int:
    """
    Save a list of paper dictionaries from Khushi's scraper to the database.
    """
    saved_count = 0

    def _parse_published_at(date_str: Optional[str]) -> Optional[datetime]:
        if not date_str:
            return None
        try:
            parts = date_str.split('-')
            if len(parts) == 2:
                year_str, month_str = parts
                year = int(year_str)
                try:
                    month = int(month_str)
                except ValueError:
                    month = datetime.strptime(month_str, '%b').month
                return datetime(year, month, 1)
            elif len(parts) == 3:
                return datetime.strptime(date_str, '%Y-%m-%d')
            else:
                return None
        except Exception:
            return None

    for paper_dict in papers:
        try:
            title = paper_dict.get('title', '')
            abstract = paper_dict.get('abstract', '')
            authors = paper_dict.get('authors', [])
            source = paper_dict.get('source', '')
            published_at = paper_dict.get('published_at')
            published_date = _parse_published_at(published_at)
            doi = paper_dict.get('doi')
            if doi == "":
                doi = None
            full_text = paper_dict.get('full_text')
            keywords = paper_dict.get('keywords', [])
            journal = None
            references = paper_dict.get('paper_references', [])
            citations = paper_dict.get('citations', [])

            raw_paper = RawPaper(
                title=title,
                abstract=abstract,
                authors=authors,
                source=source,
                published_date=published_date,
                doi=doi,
                pmid=None,
                arxiv_id=None,
                full_text=full_text,
                pdf_url=None,
                keywords=keywords,
                journal=journal,
                references=references,
                citations=citations
            )

            result = process_and_store(raw_paper, db)
            if result is not None:
                saved_count += 1
        except Exception as e:
            logger.error(f"Error processing paper from scraper: {e}")
            continue

    return saved_count


@router.post("/batch")
async def trigger_batch_ingest(
    background_tasks: BackgroundTasks,
    query: str = "ayurvedic medicine",
    sources: List[str] = ["pubmed", "arxiv"],
    max_per_source: int = 10,
    db: Session = Depends(get_db)
):
    from ingestion.batch_ingestion import batch_ingest
    """
    Trigger a batch ingestion process.
    """
    background_tasks.add_task(batch_ingest, query, sources, max_per_source, db)
    return {"message": "Batch ingestion started in background"}
