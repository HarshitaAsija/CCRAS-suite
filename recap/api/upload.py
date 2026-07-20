from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
import logging
import io

from app.database import get_db
from ingestion.pipeline import process_and_store
from ingestion.models import RawPaper

router = APIRouter(
    prefix="/papers",
    tags=["paper upload"],
    responses={404: {"description": "Not found"}},
)

logger = logging.getLogger(__name__)


def extract_with_pdfplumber(pdf_content: bytes, filename: str) -> RawPaper:
    """Extract text directly from PDF using pdfplumber."""
    import pdfplumber

    text = ""
    with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

    text = text.strip()

    # Use filename as title (strip .pdf)
    title = filename
    if title.lower().endswith(".pdf"):
        title = title[:-4]
    title = title.replace("_", " ").replace("-", " ")

    # First 500 chars as abstract
    abstract = text[:500] if text else ""

    return RawPaper(
        title=title,
        abstract=abstract,
        authors=[],
        source="FALLBACK",
        published_date=None,
        doi=None,
        full_text=text,
        keywords=[],
        journal=None,
        references=[],
        citations=[],
    )


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    pdf_content = await file.read()
    raw_paper = None

    # Try GROBID first
    try:
        from ingestion.grobid_client import GrobidClient
        grobid_client = GrobidClient()
        grobid_paper = await grobid_client.process_pdf(pdf_content)

        raw_paper = RawPaper(
            title=grobid_paper.title,
            abstract=grobid_paper.abstract,
            authors=[],
            source="GROBID",
            published_date=None,
            doi=None,
            full_text=grobid_paper.body,
            keywords=[],
            journal=None,
            references=[
                {
                    "title": ref.title,
                    "authors": ref.authors,
                    "doi": ref.doi,
                    "year": ref.year,
                }
                for ref in grobid_paper.references
            ],
            citations=[],
        )
        logger.info(f"GROBID processed: {raw_paper.title}")

    except Exception as grobid_error:
        logger.warning(f"GROBID failed: {grobid_error}. Using pdfplumber fallback.")

        # Fallback to pdfplumber
        try:
            raw_paper = extract_with_pdfplumber(pdf_content, file.filename)
            logger.info(f"Fallback processed: {raw_paper.title}")
        except Exception as fallback_error:
            logger.error(f"Fallback also failed: {fallback_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not process PDF: {str(fallback_error)}",
            )

    # Store in database
    try:
        paper_id = process_and_store(raw_paper, db)
    except Exception as store_error:
        logger.error(f"Failed to store paper: {store_error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store paper: {str(store_error)}",
        )

    if paper_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Paper already exists (duplicate title)",
        )

    # Return stored paper details
    from app.models_uploaded import UploadedPaper
    stored_paper = db.query(UploadedPaper).filter(UploadedPaper.id == paper_id).first()

    return {
        "id": stored_paper.id,
        "title": stored_paper.title,
        "doi": stored_paper.doi,
        "message": "Paper uploaded and processed successfully",
    }