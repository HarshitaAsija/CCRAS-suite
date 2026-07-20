from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from sqlalchemy import text
from app.database import get_db
from app.models import Paper, Author, Keyword, paper_author

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Get dashboard statistics.
    """
    # growing: total count of papers
    growing = db.query(func.count(Paper.id)).scalar()

    # expanding: count of papers where full_text IS NOT NULL
    expanding = db.query(func.count(Paper.id)).filter(Paper.full_text.isnot(None)).scalar()

    # diverse: count of DISTINCT authors (via authors table / paper_authors join)
    diverse = db.query(func.count(distinct(Author.id))).select_from(
        paper_author.join(Author, paper_author.c.author_id == Author.id)
    ).scalar()

    # curated: count of DISTINCT non-null journal values in papers
    curated = db.query(func.count(distinct(Paper.journal))).filter(Paper.journal.isnot(None)).scalar()

    # verified: count of papers where doi IS NOT NULL
    verified = db.query(func.count(Paper.id)).filter(Paper.doi.isnot(None)).scalar()

    return {
        "growing": growing,
        "expanding": expanding,
        "diverse": diverse,
        "curated": curated,
        "verified": verified,
    }

@router.get("/trending-topics")
def get_trending_topics(db: Session = Depends(get_db)):
    """
    Get top 5 keywords by paper count, unpacked from the JSON keywords
    column on papers, excluding common stopwords.
    """
    rows = db.execute(text("""
        SELECT value AS topic, COUNT(*) AS paper_count
        FROM papers, jsonb_array_elements_text(papers.keywords) AS value
        WHERE papers.keywords IS NOT NULL
          AND lower(value) NOT IN (
            'a','an','the','and','or','but','for','with','its','of','in','on',
            'to','is','are','was','were','be','been','this','that','these','those',
            'as','at','by','from','it','we','our','their','has','have','had','based','patients','study','results','using'
          )
          AND length(value) > 2
        GROUP BY value
        ORDER BY paper_count DESC
        LIMIT 5
    """)).fetchall()

    trending_topics = [
        {"topic": row.topic, "paper_count": row.paper_count}
        for row in rows
    ]

    return trending_topics

   