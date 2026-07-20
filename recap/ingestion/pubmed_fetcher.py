import asyncio
import logging
from datetime import datetime
from typing import List, Optional
import httpx
from lxml import etree
import time
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from ingestion.models import RawPaper
from sqlalchemy.orm import Session
from app.models import User
from core.auth import get_current_user
from app.database import get_db
from ingestion.pipeline import process_and_store
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)



class PubMedFetcher:
    def __init__(self):
        self.base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
        self.last_request_time = 0
        self.min_request_interval = 0.34  # ~3 requests per second (1/3 seconds ≈ 0.33)

    async def _rate_limited_request(self):
        """Enforce rate limiting of 3 requests per second"""
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        if elapsed < self.min_request_interval:
            # Wait to maintain rate limit
            await asyncio.sleep(self.min_request_interval - elapsed)
        self.last_request_time = time.time()

    async def search_pubmed(self, query: str, max_results: int = 1000) -> List[str]:
        """
        Search PubMed by keyword query and return up to max_results PMIDs
        """
        try:
            # First, get the total count of results
            search_params = {
                "db": "pubmed",
                "term": query,
                "retmax": 0,
                "retmode": "json"
            }

            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/esearch.fcgi", params=search_params)
                response.raise_for_status()

                data = response.json()
                if "esearchresult" in data and "count" in data["esearchresult"]:
                    total_count = int(data["esearchresult"]["count"])
                    logger.info(f"Total results found: {total_count}")

            # Now fetch the actual PMIDs
            fetch_count = min(total_count, max_results, 1000)  # Limit to 1000 as per API limits
            search_params["retmax"] = fetch_count
            search_params["retstart"] = 0

            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/esearch.fcgi", params=search_params)
                response.raise_for_status()

                data = response.json()
                if "esearchresult" in data and "idlist" in data["esearchresult"]:
                    pmids = data["esearchresult"]["idlist"]
                    logger.info(f"Retrieved {len(pmids)} PMIDs for query: {query}")
                    return pmids
                else:
                    logger.warning("No PMIDs found in search results")
                    return []
        except Exception as e:
            logger.error(f"Error searching PubMed: {e}")
            return []

    async def fetch_papers(self, pmids: List[str]) -> List[RawPaper]:
        """
        Fetch full metadata for a list of PMIDs using efetch in XML format
        """
        if not pmids:
            return []

        # Limit to 200 PMIDs per request as per API limits for XML returns
        batch_size = 200
        all_papers = []
        failed_papers = []

        for i in range(0, len(pmids), batch_size):
            batch_pmids = pmids[i:i + batch_size]
            try:
                await self._rate_limited_request()
                fetch_params = {
                    "db": "pubmed",
                    "id": ",".join(batch_pmids),
                    "retmode": "xml",
                    "rettype": "null"
                }

                async with httpx.AsyncClient() as client:
                    response = await client.get(f"{self.base_url}/efetch.fcgi", params=fetch_params)
                    response.raise_for_status()

                    # Parse XML response
                    root = etree.fromstring(response.content)
                    batch_papers = self._parse_papers_xml(root)
                    all_papers.extend(batch_papers)

                    # Log any papers that failed to parse
                    parsed_pmids = [paper.pmid for paper in batch_papers]
                    failed_pmids = set(batch_pmids) - set(parsed_pmids)
                    if failed_pmids:
                        failed_papers.extend(list(failed_pmids))
                        logger.warning(f"Failed to parse {len(failed_pmids)} papers from batch: {list(failed_pmids)}")
            except Exception as e:
                logger.error(f"Error fetching papers batch: {e}")
                failed_papers.extend(batch_pmids)

        if failed_papers:
            logger.warning(f"Total failed papers: {len(failed_papers)}")

        return all_papers

    def _parse_papers_xml(self, root) -> List[RawPaper]:
        """
        Parse the XML response into a list of RawPaper objects
        """
        papers = []
        skipped_papers = []

        for article in root.xpath('//PubmedArticle'):
            try:
                # Extract PMID
                pmid = "Unknown"
                pmid_elem = article.xpath('.//PMID/text()')
                if pmid_elem:
                    pmid = pmid_elem[0]

                # Extract title
                title = ""
                title_elem = article.xpath('.//ArticleTitle/text()')
                if title_elem:
                    title = title_elem[0]

                # Extract abstract
                abstract = ""
                abstract_elem = article.xpath('.//Abstract/AbstractText')
                if abstract_elem:
                    abstract = ''.join(abstract_elem[0].itertext()) if abstract_elem[0].getchildren() else abstract_elem[0].text
                    if abstract is None:
                        abstract = ""

                # Extract authors
                authors = []
                for author in article.xpath('.//Author'):
                    # Get author names
                    last_name = author.xpath('LastName/text()')
                    fore_name = author.xpath('ForeName/text()')
                    if last_name and fore_name:
                        authors.append(f"{fore_name[0]} {last_name[0]}")
                    elif fore_name:
                        authors.append(fore_name[0])
                    elif last_name:
                        authors.append(last_name[0])
                    else:
                        # Try collective names for organizations
                        collective_name = author.xpath('CollectiveName/text()')
                        if collective_name:
                            authors.append(collective_name[0])
                        else:
                            authors.append("Unknown Author")

                # Extract DOI
                doi = None
                doi_elem = article.xpath('.//ArticleId[@IdType="doi"]/text()')
                if doi_elem:
                    doi = doi_elem[0]

                # Extract publish date
                pub_date = None
                # Try different date formats
                pubmed_date = article.xpath('.//PubDate')
                if pubmed_date:
                    year = article.xpath('.//PubDate/Year/text()')
                    month = article.xpath('.//PubDate/Month/text()')
                    day = article.xpath('.//PubDate/Day/text()')
                    medline_date = article.xpath('.//PubDate/MedlineDate/text()')

                    if year:
                        pub_date = year[0]
                        if month:
                            pub_date += f"-{month[0]}"
                            if day:
                                pub_date += f"-{day[0]}"
                    elif medline_date:
                        pub_date = medline_date[0]

                # Extract journal
                journal = None
                journal_elem = article.xpath('.//Journal/Title/text()')
                if journal_elem:
                    journal = journal_elem[0]

                paper = RawPaper(
                    pmid=pmid,
                    title=title,
                    abstract=abstract,
                    authors=authors,
                    doi=doi,
                    published_date=pub_date,
                    source = "pubmed",
                    journal=journal
                )
                papers.append(paper)
            except Exception as e:
                logger.warning(f"Skipping paper due to parsing error: {e}")
                skipped_papers.append(pmid)
                continue

        if skipped_papers:
            logger.warning(f"Skipped {len(skipped_papers)} papers due to parsing errors: {', '.join(skipped_papers[:10])}...")

        return papers


# Create a global instance
pubmed_fetcher = PubMedFetcher()


async def search_and_fetch_pubmed(query: str, max_results: int = 500):
    """
    Search PubMed and return up to max_results papers
    """
    # Search for PMIDs
    pmids = await pubmed_fetcher.search_pubmed(query, max_results)
    logger.info(f"Found {len(pmids)} PMIDs for query: {query}")

    # Fetch full metadata for the papers
    papers = await pubmed_fetcher.fetch_papers(pmids)
    return papers


# FastAPI endpoint
class PubMedQuery(BaseModel):
    query: str
    max_results: int = 500

router = APIRouter()


@router.post("/api/ingest/pubmed")
async def ingest_pubmed(query: PubMedQuery, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        papers = await search_and_fetch_pubmed(query.query, query.max_results)
        saved = 0
        for paper in papers:
            result = process_and_store(paper, db)
            if result:
                saved += 1
        return {"message": f"Ingested {saved} papers", "total_fetched": len(papers)}
    except Exception as e:
        logger.error(f"Error in PubMed ingestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))