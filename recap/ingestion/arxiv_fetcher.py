import asyncio
import logging
from datetime import datetime
from typing import List, Optional
import httpx
import urllib.parse
from lxml import etree
import logging
from ingestion.models import RawPaper
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from core.auth import get_current_user
from ingestion.pipeline import process_and_store
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)



class ArxivFetcher:
    def __init__(self):
        self.base_url = "http://export.arxiv.org/api/query"
        self.last_request_time = 0
        self.min_request_interval = 0.34  # ~3 requests per second (1/3 seconds ≈ 0.33)

    def search_arxiv(self, query: str, category: str = "cs.AI", max_results: int = 500) -> List[str]:
        """
        Search arXiv by query string and category
        Returns a list of arXiv IDs
        """
        try:
            # Build search query
            search_query = f"cat:{category} AND {query}" if query else f"cat:{category}"

            # arXiv API parameters
            params = {
                "search_query": search_query,
                "start": 0,
                "max_results": min(max_results, 500)  # Limit to 500 as per API limits
            }

            # URL encode the parameters
            query_string = f"search_query={urllib.parse.quote(search_query)}&start=0&max_results={min(max_results, 500)}"

            url = f"{self.base_url}?{query_string}"
            logger.info(f"arXiv API URL: {url}")

            # Make request to arXiv API
            response = httpx.get(url)
            response.raise_for_status()

            # Parse XML response
            root = etree.fromstring(response.content)
            return self._parse_papers_xml(root)

        except Exception as e:
            logger.error(f"Error searching arXiv: {e}")
            return []

    def _parse_papers_xml(self, root) -> List[RawPaper]:
        """
        Parse the arXiv Atom XML feed into a list of RawPaper objects
        """
        papers = []

        # Parse the XML entries
        for entry in root.xpath('//{http://www.w3.org/2005/Atom}entry'):
            try:
                # Extract arxiv_id
                arxiv_id = ""
                id_elem = entry.xpath('.//{http://www.w3.org/2005/Atom}id/text()')
                if id_elem:
                    # Extract the arXiv ID from the URL
                    arxiv_id = id_elem[0].split('/abs/')[-1] if '/abs/' in id_elem[0] else id_elem[0]

                # Extract title
                title = ""
                title_elem = entry.xpath('.//{http://www.w3.org/2005/Atom}title/text()')
                if title_elem:
                    title = title_elem[0]

                # Extract abstract
                abstract = ""
                summary_elem = entry.xpath('.//{http://www.w3.org/2005/Atom}summary/text()')
                if summary_elem:
                    abstract = summary_elem[0].strip()

                # Extract authors
                authors = []
                for author_elem in entry.xpath('.//{http://www.w3.org/2005/Atom}author/{http://www.w3.org/2005/Atom}name'):
                    if author_elem.text:
                        authors.append(author_elem.text)

                # Extract published date
                publish_date = None
                published_elem = entry.xpath('.//{http://www.w3.org/2005/Atom}published/text()')
                if published_elem:
                    publish_date = published_elem[0]

                # Extract PDF URL
                pdf_url = None
                for link in entry.xpath('.//{http://www.w3.org/2005/Atom}link'):
                    if 'type' in link.attrib and link.attrib['type'] == 'application/pdf':
                        pdf_url = link.attrib.get('href')
                        break

                paper = RawPaper(
                    arxiv_id=arxiv_id,
                    title=title,
                    abstract=abstract,
                    authors=authors,
                    doi=None,  # arXiv doesn't have DOIs in the same format
                    publish_date=publish_date,
                    journal="arXiv"
                )
                papers.append(paper)
            except Exception as e:
                logger.warning(f"Skipping paper due to parsing error: {e}")
                continue

        return papers

# FastAPI endpoint
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

class ArxivQuery(BaseModel):
    query: str
    category: str = "cs.AI"
    max_results: int = 200

router = APIRouter()

@router.post("/api/ingest/arxiv")
async def ingest_arxiv(query: ArxivQuery, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        fetcher = ArxivFetcher()
        papers = fetcher.search_arxiv(query.query, query.category, query.max_results)
        saved = 0
        for paper in papers:
            result = process_and_store(paper, db)
            if result:
                saved += 1
        return {"message": f"Ingested {saved} papers", "total_fetched": len(papers)}
    except Exception as e:
        logger.error(f"Error in arXiv ingestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))