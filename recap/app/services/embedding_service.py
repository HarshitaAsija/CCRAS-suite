from sentence_transformers import SentenceTransformer
from sqlalchemy import select, delete
from sqlalchemy.exc import SQLAlchemyError
from app.models import Paper, PaperChunk
from app.database import SessionLocal
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

model = None

def get_model():
    global model
    if model is None:
        model = SentenceTransformer('all-MiniLM-L6-v2')
    return model

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks

def embed_text(text: str) -> list[float]:
    return get_model().encode(text).tolist()

def embed_all_papers():
    """
    Updated to use full_text when available, falls back to abstract.
    Uses synchronous SQLAlchemy session.
    """
    with SessionLocal() as db:
        try:
            # Fetch papers with id, abstract, title, full_text
            result = db.execute(select(Paper.id, Paper.abstract, Paper.title, Paper.full_text))
            papers = result.all()
            print(f"Found {len(papers)} papers to embed")

            for paper_id, abstract, title, full_text in papers:
                # Use full_text if available, otherwise fall back to abstract, then title
                text = (full_text or "").strip()
                if not text:
                    text = (abstract or "").strip()
                if not text:
                    text = (title or "").strip()

                if not text:
                    print(f"Skipping {paper_id} — no text")
                    continue

                # Delete old chunks for this paper
                delete_stmt = delete(PaperChunk).where(PaperChunk.paper_id == paper_id)
                db.execute(delete_stmt)
                db.commit()

                # Chunk and embed
                chunks = chunk_text(text)
                for idx, chunk in enumerate(chunks):
                    embedding = embed_text(chunk)
                    chunk_obj = PaperChunk(
                        paper_id=paper_id,
                        chunk_text=chunk,
                        chunk_index=idx,
                        embedding=embedding
                    )
                    db.add(chunk_obj)
                db.commit()

                source = "full_text" if (full_text and full_text.strip()) else "abstract" if (abstract and abstract.strip()) else "title"
                print(f"✓ {title[:50] if title else 'Untitled'} → {len(chunks)} chunks [{source}]")

            print("\n✅ All papers re-embedded with full text!")
        except SQLAlchemyError as e:
            db.rollback()
            print(f"Error during embedding: {e}")
            raise

def embed_new_papers():
    """Process ONLY papers that don't have chunks (for auto-watcher)"""
    with SessionLocal() as db:
        try:
            # Find papers WITHOUT chunks
            papers = db.query(Paper).filter(~Paper.chunks.any()).all()

            if not papers:
                print("No new papers to embed")
                return

            print(f"Found {len(papers)} new papers to embed")

            for paper in papers:
                try:
                    # Use full_text if available, otherwise fall back to abstract, then title
                    text = (paper.full_text or "").strip()
                    if not text:
                        text = (paper.abstract or "").strip()
                    if not text:
                        text = (paper.title or "").strip()

                    if not text:
                        # No usable content at all — mark as failed so this paper
                        # stops being picked up by the "papers without chunks" query
                        # on every watcher cycle (was previously causing an infinite retry loop).
                        print(f"⚠️  Skipping {paper.id} — no text found, marking as failed")
                        paper.processing_status = "failed"
                        paper.processing_error = "No usable text (full_text, abstract, and title all empty)"
                        paper.processed_at = datetime.now(timezone.utc)
                        db.commit()
                        continue

                    # Delete old chunks for this paper (if any)
                    delete_stmt = delete(PaperChunk).where(PaperChunk.paper_id == paper.id)
                    db.execute(delete_stmt)
                    db.commit()

                    # Chunk and embed
                    chunks = chunk_text(text)
                    paper.chunked_at = datetime.now(timezone.utc)

                    for idx, chunk in enumerate(chunks):
                        embedding = embed_text(chunk)
                        chunk_obj = PaperChunk(
                            paper_id=paper.id,
                            chunk_text=chunk,
                            chunk_index=idx,
                            embedding=embedding
                        )
                        db.add(chunk_obj)

                    now = datetime.now(timezone.utc)
                    paper.embedded_at = now
                    paper.processed_at = now
                    paper.processing_status = "embedded"
                    paper.processing_error = None
                    db.commit()

                    source = "full_text" if (paper.full_text and paper.full_text.strip()) else "abstract" if (paper.abstract and paper.abstract.strip()) else "title"
                    print(f"✓ {paper.title[:50] if paper.title else 'Untitled'} → {len(chunks)} chunks [{source}]")

                except Exception as paper_error:
                    # Isolate per-paper failures so ONE bad paper (malformed data,
                    # embedding error, etc.) can't kill the whole batch or block
                    # papers that come after it in this loop.
                    db.rollback()
                    print(f"❌ Error embedding paper {paper.id}: {paper_error}")
                    try:
                        paper.processing_status = "failed"
                        paper.processing_error = str(paper_error)[:500]
                        paper.processed_at = datetime.now(timezone.utc)
                        db.commit()
                    except SQLAlchemyError:
                        db.rollback()
                    continue

            print(f"\n✅ Finished processing batch of {len(papers)} papers!")
        except SQLAlchemyError as e:
            db.rollback()
            print(f"Error during embedding: {e}")
            raise

if __name__ == "__main__":
    embed_all_papers()