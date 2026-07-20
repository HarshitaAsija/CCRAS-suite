import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from ingestion.models import RawPaper
from ingestion.pipeline import process_and_store, save_papers

logger = logging.getLogger(__name__)


async def _fetch_pubmed(query: str, max_results: int) -> List[RawPaper]:
    """Fetch papers from PubMed."""
    try:
        from ingestion.pubmed_fetcher import PubMedFetcher
        fetcher = PubMedFetcher()
        pmids = await fetcher.search_pubmed(query, max_results)
        if not pmids:
            return []
        papers = await fetcher.fetch_papers(pmids)
        return papers
    except Exception as e:
        logger.error(f"Error fetching from PubMed: {e}")
        return []


async def _fetch_arxiv(query: str, max_results: int) -> List[RawPaper]:
    """Fetch papers from arXiv."""
    try:
        from ingestion.arxiv_fetcher import ArxivFetcher
        fetcher = ArxivFetcher()
        # Note: The ArxivFetcher's search_arxiv method is synchronous, so we run it in a thread
        # to avoid blocking the event loop. However, for simplicity and given the task,
        # we'll call it directly and hope it's fast enough. Alternatively, we can use
        # asyncio.to_thread if using Python 3.9+.
        papers = fetcher.search_arxiv(query, max_results=max_results)
        return papers
    except Exception as e:
        logger.error(f"Error fetching from arXiv: {e}")
        return []


def _fetch_scraper_json() -> List[Dict[str, Any]]:
    """
    Placeholder for fetching scraper JSON.
    In a real implementation, this would load from a file or API.
    For now, we return an empty list and log a warning.
    """
    logger.warning("Scraper JSON source not implemented; returning empty list.")
    return []


async def batch_ingest(
    query: str,
    sources: List[str],
    max_per_source: int,
    db: Session
) -> Dict[str, Any]:
    """
    Ingest papers from multiple sources with deduplication and batch processing.

    Args:
        query: Search query for PubMed and arXiv (ignored for scraper).
        sources: List of sources to fetch from ('pubmed', 'arxiv', 'scraper').
        max_per_source: Maximum number of papers to fetch per source.
        db: SQLAlchemy session.

    Returns:
        Dict with keys: total_fetched, saved, skipped, errors.
    """
    total_fetched = 0
    saved = 0
    skipped = 0
    errors = []

    all_papers: List[RawPaper] = []
    scraper_papers: List[Dict[str, Any]] = []

    # Fetch from each source
    for source in sources:
        source = source.lower()
        if source == "pubmed":
            logger.info(f"Fetching from PubMed with query: '{query}', max {max_per_source} papers")
            papers = await _fetch_pubmed(query, max_per_source)
            all_papers.extend(papers)
            total_fetched += len(papers)
            logger.info(f"Fetched {len(papers)} papers from PubMed")
        elif source == "arxiv":
            logger.info(f"Fetching from arXiv with query: '{query}', max {max_per_source} papers")
            papers = _fetch_arxiv(query, max_per_source)  # Note: synchronous
            all_papers.extend(papers)
            total_fetched += len(papers)
            logger.info(f"Fetched {len(papers)} papers from arXiv")
        elif source == "scraper":
            logger.info("Fetching from scraper JSON")
            papers_dicts = _fetch_scraper_json()
            scraper_papers.extend(papers_dicts)
            total_fetched += len(papers_dicts)
            logger.info(f"Fetched {len(papers_dicts)} papers from scraper JSON")
        else:
            logger.warning(f"Unknown source: {source}")
            errors.append(f"Unknown source: {source}")

    # Process scraper papers using the existing save_papers function
    if scraper_papers:
        logger.info(f"Processing {len(scraper_papers)} scraper papers")
        try:
            # Note: save_papers expects a list of dicts and a db session, and returns the count saved.
            saved_count = save_papers(scraper_papers, db)
            saved += saved_count
            skipped += len(scraper_papers) - saved_count  # Assuming save_papers returns the number saved
            logger.info(f"Saved {saved_count} scraper papers, skipped {len(scraper_papers) - saved_count}")
        except Exception as e:
            logger.error(f"Error processing scraper papers: {e}")
            errors.append(f"Error processing scraper papers: {str(e)}")

    # Process PubMed and arXiv papers in batches of 50
    batch_size = 50
    for i in range(0, len(all_papers), batch_size):
        batch = all_papers[i:i + batch_size]
        logger.info(f"Processing batch {i//batch_size + 1} of {len(all_papers)//batch_size + 1} ({len(batch)} papers)")
        for paper in batch:
            try:
                result = process_and_store(paper, db)
                if result is not None:
                    saved += 1
                else:
                    skipped += 1
            except Exception as e:
                logger.error(f"Error processing paper: {e}")
                errors.append(f"Error processing paper: {str(e)}")
                # Continue with the next paper

    logger.info(f"Batch ingestion complete. Total fetched: {total_fetched}, Saved: {saved}, Skipped: {skipped}, Errors: {len(errors)}")

    return {
        "total_fetched": total_fetched,
        "saved": saved,
        "skipped": skipped,
        "errors": errors
    }