# api/analytics.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from sqlalchemy import text
from datetime import datetime, timedelta
from app.database import get_db
from app.models import Paper, Keyword

# ADD THE PREFIX HERE - same as dashboard
router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/overview")
async def get_analytics_overview(db: Session = Depends(get_db)):
    """
    Get overview statistics of papers.
    """
    # Total papers
    total_papers = db.query(Paper).count()

    # Total distinct keywords (unpacked from the JSON keywords column on papers)
    total_keywords = db.execute(text("""
        SELECT COUNT(DISTINCT value)
        FROM papers, jsonb_array_elements_text(papers.keywords) AS value
        WHERE papers.keywords IS NOT NULL
    """)).scalar()


    # Papers by source
    source_counts = db.query(
        Paper.source,
        func.count(Paper.id)
    ).group_by(Paper.source).all()
    sources = {source: count for source, count in source_counts}

   # Papers with and without DOI
    papers_with_doi = db.query(Paper).filter(Paper.doi.isnot(None)).count()
    papers_without_doi = total_papers - papers_with_doi

    # Full-text vs abstract-only
    papers_with_fulltext = db.query(Paper).filter(
        Paper.full_text.isnot(None), Paper.full_text != ""
    ).count()
    papers_abstract_only = total_papers - papers_with_fulltext

    return {
        "total_papers": total_papers,
        "total_keywords": total_keywords,
        "sources": sources,
        "papers_with_doi": papers_with_doi,
        "papers_without_doi": papers_without_doi,
        "papers_with_fulltext": papers_with_fulltext,
        "papers_abstract_only": papers_abstract_only
    }


@router.get("/papers/by-source")
async def get_papers_by_source(db: Session = Depends(get_db)):
    """
    Get paper count grouped by source.
    """
    try:
        source_counts = db.query(
            Paper.source,
            func.count(Paper.id)
        ).group_by(Paper.source).all()

        return {source or "unknown": count for source, count in source_counts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/papers/recent")
async def get_papers_recent(db: Session = Depends(get_db)):
    """
    Get papers added in the last 30 days grouped by date.
    """
    try:
        thirty_days_ago = datetime.now() - timedelta(days=30)

        recent_papers = db.query(
            cast(Paper.created_at, Date).label('date'),
            func.count(Paper.id).label('count')
        ).filter(
            Paper.created_at >= thirty_days_ago
        ).group_by(
            cast(Paper.created_at, Date)
        ).order_by(
            cast(Paper.created_at, Date)
        ).all()

        result = [{"date": str(row.date), "count": row.count} for row in recent_papers]
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/keywords/top")
async def get_top_keywords(db: Session = Depends(get_db)):
    """
    Get top 20 most frequent keywords with their counts, unpacked from
    the JSON keywords column on papers.
    """
    try:
        rows = db.execute(text("""
            SELECT value AS keyword, COUNT(*) AS count
            FROM papers, jsonb_array_elements_text(papers.keywords) AS value
            WHERE papers.keywords IS NOT NULL
              AND lower(value) NOT IN (
                'a','an','the','and','or','but','for','with','its','of','in','on',
                'to','is','are','was','were','be','been','this','that','these','those',
                'as','at','by','from','it','we','our','their','has','have','had',
                'based','patients','study','results','using','all'
              )
              AND length(value) > 2
            GROUP BY value
            ORDER BY count DESC
            LIMIT 20
        """)).fetchall()

        result = [{"keyword": row.keyword, "count": row.count} for row in rows]
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
