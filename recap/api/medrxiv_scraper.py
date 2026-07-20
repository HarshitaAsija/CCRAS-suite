import asyncio
import json
import logging
import re
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

import aiohttp
import httpx
from bs4 import BeautifulSoup
from sqlalchemy import delete, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models import Paper, PaperChunk
from backend.app.services.embedding_service import chunk_text, embed_text

logger = logging.getLogger(__name__)

class MedRxivScraper:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.base_url = "https://api.medrxiv.org"
        # Rate limit: 1 request per second for metadata
        self.metadata_rate_limit_delay = 1.0
        # Rate limit: 1 request per second for full text
        self.fulltext_rate_limit_delay = 1.0

    async def scrape(
        self, start_date: str, end_date: str, search_term: Optional[str] = None
    ) -> int:
        """
        Scrape medRxiv papers for a date range and optional search term.

        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            search_term: Optional search term to filter results

        Returns:
            Number of papers processed
        """
        cursor = 0
        batch_size = 100
        total_processed = 0

        while True:
            # Construct API endpoint
            if search_term:
                endpoint = f"/search/medrxiv/{search_term}/{start_date}/{end_date}/{cursor}/{batch_size}/json"
            else:
                endpoint = f"/details/medrxiv/{start_date}/{end_date}/{cursor}/{batch_size}/{cursor}/{batch_size}/json"
            url = f"{self.base_url}{endpoint}"

            logger.info(f"Fetching medRxiv papers: {url}")

            try:
                async with aiohttp.ClientSession() as http_session:
                    async with http_session.get(url) as response:
                        if response.status != 200:
                            logger.error(
                                f"Failed to fetch medRxiv papers: {response.status} {await response.text()}"
                            )
                            break

                        data = await response.json()
                        papers_data = data.get("collection", [])

                        if not papers_data:
                            logger.info("No more papers found")
                            break

                        logger.info(f"Fetched {len(papers_data)} papers from medRxiv")

                        # Process each paper
                        for paper_dict in papers_data:
                            await self._process_paper(paper_dict)
                            total_processed += 1

                        # If we got less than batch_size, we're done
                        if len(papers_data) < batch_size:
                            break

                        cursor += batch_size
                        # Respect rate limit for metadata requests
                        await asyncio.sleep(self.metadata_rate_limit_delay)

            except Exception as e:
                logger.error(f"Error fetching medRxiv papers: {e}")
                break

        logger.info(f"Finished scraping medRxiv. Total papers processed: {total_processed}")
        return total_processed

    async def _process_paper(self, paper_dict: dict) -> None:
        """
        Process a single paper dictionary from medRxiv API and upsert to database.
        Also fetches full text, chunks it, and stores embeddings.

        Args:
            paper_dict: Paper data from medRxiv API
        """
        try:
            # Extract and map fields
            doi = paper_dict.get("doi")
            if not doi:
                logger.warning("Skipping paper without DOI")
                return

            title = paper_dict.get("title", "").strip()
            abstract = paper_dict.get("abstract", "").strip() or None

            # Authors: extract author names
            authors_list = []
            for author in paper_dict.get("authors", []):
                if author_name := author.get("author"):
                    authors_list.append(author_name)
            authors = json.dumps(authors_list) if authors_list else None

            # Publication date (medRxiv post date)
            pub_date_str = paper_dict.get("date")
            publication_date = None
            if pub_date_str:
                try:
                    publication_date = datetime.strptime(pub_date_str, "%Y-%m-%d")
                except ValueError:
                    logger.warning(f"Invalid publication date: {pub_date_str}")

            # Journal/server
            journal = paper_dict.get("server", "medrxiv").capitalize()
            if journal == "Medrxiv":
                journal = "medRxiv"

            # External ID (medRxiv DOI)
            external_id = doi

            # Keywords: not available in medRxiv API
            keywords = None

            # Language: assume English
            language = "en"

            # URL: construct from DOI
            url = f"https://doi.org/{doi}" if doi else None

            # Status: indexed
            status = "indexed"

            # Upsert paper and get its ID
            stmt = (
                pg_insert(Paper)
                .values(
                    doi=doi,
                    title=title,
                    abstract=abstract,
                    authors=authors,
                    publication_date=publication_date,
                    journal=journal,
                    external_id=external_id,
                    source="medrxiv",
                    keywords=keywords,
                    language=language,
                    url=url,
                    status=status,
                )
                .on_conflict_do_update(
                    index_elements=["doi"],
                    set_={
                        "title": title,
                        "abstract": abstract,
                        "authors": authors,
                        "publication_date": publication_date,
                        "journal": journal,
                        "keywords": keywords,
                        "language": language,
                        "url": url,
                        "status": status,
                        "updated_at": datetime.now(),
                    },
                )
                .returning(Paper.id)
            )
            result = await self.session.execute(stmt)
            paper_id = result.scalar_one()
            await self.session.flush()

            # Fetch full text
            full_text = await self._fetch_full_text(doi, abstract)
            # Update paper with full text
            stmt_update = (
                update(Paper)
                .where(Paper.id == paper_id)
                .values(full_text=full_text, updated_at=datetime.now())
            )
            await self.session.execute(stmt_update)
            await self.session.flush()

            # Chunk and embed full text
            await self._chunk_and_embed(paper_id, full_text or abstract or "")

            await self.session.commit()
            logger.debug(f"Processed paper: {doi}")

        except Exception as e:
            logger.error(f"Error processing medRxiv paper {paper_dict.get('doi', 'unknown')}: {e}")
            await self.session.rollback()

    async def _fetch_full_text(self, doi: str, abstract: Optional[str]) -> Optional[str]:
        """
        Fetch full text from medRxiv using DOI.
        Tries versions v1, v2, v3 until success or all fail.
        Returns cleaned text or None if all fail.
        """
        # Try versions 1 through 3
        for version in range(1, 4):
            url = f"https://www.medrxiv.org/content/{doi}v{version}.full"
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(url, follow_redirects=True)
                    if resp.status_code == 200:
                        html = resp.text
                        soup = BeautifulSoup(html, "html.parser")
                        # Try multiple selectors for article content
                        selectors = [
                            "div.article",
                            "section.article-body",
                            "div#article-body",
                            "div.article-content",
                            "div.content",
                        ]
                        text = None
                        for selector in selectors:
                            el = soup.select_one(selector)
                            if el:
                                text = el.get_text(separator=" ", strip=True)
                                break
                        if not text:
                            # Fallback to body text
                            text = soup.get_text(separator=" ", strip=True)
                        # Clean text: remove reference numbers like [1][2], collapse whitespace
                        text = re.sub(r'\[\d+\]', ' ', text)
                        text = re.sub(r'\s+', ' ', text).strip()
                        if text:
                            logger.info(f"Fetched full text for {doi} (v{version})")
                            await asyncio.sleep(self.fulltext_rate_limit_delay)
                            return text
                    else:
                        logger.debug(f"Full text not found for {doi} v{version} (status {resp.status_code})")
            except Exception as e:
                logger.debug(f"Error fetching full text for {doi} v{version}: {e}")
            # Wait before trying next version
            await asyncio.sleep(self.fulltext_rate_limit_delay)

        # If all attempts fail, fallback to abstract
        logger.warning(f"Could not retrieve full text for {doi}; using abstract as fallback.")
        return abstract

    async def _chunk_and_embed(self, paper_id: str, text: str) -> None:
        """
        Chunk text and create embeddings, storing them in paper_chunks table.
        First delete any existing chunks for this paper (to avoid duplicates on update).
        """
        # Delete existing chunks for this paper
        stmt_delete = delete(PaperChunk).where(PaperChunk.paper_id == paper_id)
        await self.session.execute(stmt_delete)
        await self.session.flush()

        # Chunk text
        chunks = chunk_text(text)
        if not chunks:
            logger.warning(f"No chunks generated for paper {paper_id}")
            return

        # Create chunk objects
        for idx, chunk in enumerate(chunks):
            embedding = embed_text(chunk)
            chunk_obj = PaperChunk(
                paper_id=paper_id,
                chunk_text=chunk,
                chunk_index=idx,
                embedding=embedding,
            )
            self.session.add(chunk_obj)

        logger.debug(f"Created {len(chunks)} chunks for paper {paper_id}")