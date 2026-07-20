import asyncio
import aiohttp
import httpx
import fitz  # PyMuPDF
from bs4 import BeautifulSoup
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert, update, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func
import logging
import re

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OpenAlexScraper:
    def __init__(self, session: AsyncSession, email: str = "your@email.com"):
        """
        Initialize the OpenAlex scraper.

        Args:
            session: SQLAlchemy AsyncSession for database operations
            email: Email for User-Agent header (for polite usage)
        """
        self.session = session
        self.email = email
        self.base_url = "https://api.openalex.org/works"
        self.semaphore = asyncio.Semaphore(5)  # Reduced to 5 for PDF/HTML requests
        self.user_agent = f"CCRAS Research Suite (mailto:{email})"

    def reconstruct_abstract(self, abstract_inverted_index: Optional[Dict[str, List[int]]]) -> Optional[str]:
        """
        Reconstruct abstract string from inverted index.

        Args:
            abstract_inverted_index: Dictionary mapping words to list of positions

        Returns:
            Reconstructed abstract string or None if input is None/empty
        """
        if not abstract_inverted_index:
            return None

        # Find maximum position
        max_pos = max(max(positions) for positions in abstract_inverted_index.values())

        # Create array of words
        words = [None] * (max_pos + 1)

        # Place each word at its positions
        for word, positions in abstract_inverted_index.items():
            for pos in positions:
                if pos < len(words):
                    words[pos] = word

        # Join words and return
        return " ".join(word for word in words if word is not None)

    async def fetch_page(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fetch a single page of results from OpenAlex API with rate limiting.

        Args:
            params: Query parameters for the API request

        Returns:
            JSON response from OpenAlex API
        """
        async with self.semaphore:
            headers = {
                "User-Agent": self.user_agent,
                "Accept": "application/json"
            }

            async with aiohttp.ClientSession() as http_session:
                try:
                    async with http_session.get(
                        self.base_url,
                        params=params,
                        headers=headers
                    ) as response:
                        if response.status != 200:
                            logger.error(f"OpenAlex API error: {response.status}")
                            response.raise_for_status()

                        return await response.json()
                except Exception as e:
                    logger.error(f"Error fetching from OpenAlex: {e}")
                    raise

    def map_work_to_paper(self, work: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map OpenAlex work fields to papers table schema.

        Args:
            work: OpenAlex work object

        Returns:
            Dictionary mapped to papers table columns
        """
        # Extract authors
        authors = []
        for authorship in work.get("authorships", []):
            author_info = {
                "name": authorship.get("author", {}).get("display_name"),
                "institution": None
            }

            # Get institution from last_known_institution
            institutions = authorship.get("institutions", [])
            if institutions:
                # Take the first institution's display_name
                author_info["institution"] = institutions[0].get("display_name")

            authors.append(author_info)

        # Extract keywords from concepts
        keywords = []
        for concept in work.get("concepts", []):
            if concept.get("display_name"):
                keywords.append(concept["display_name"])

        # Extract journal from primary_location
        journal = None
        primary_location = work.get("primary_location")
        if primary_location and primary_location.get("source"):
            journal = primary_location["source"].get("display_name")

        # Extract DOI (strip https://doi.org/ prefix)
        doi = work.get("doi")
        if doi and doi.startswith("https://doi.org/"):
            doi = doi[len("https://doi.org/"):]

        # Extract URL from primary_location
        url = None
        if primary_location:
            url = primary_location.get("landing_page_url")

        return {
            "title": work.get("title"),
            "abstract": self.reconstruct_abstract(work.get("abstract_inverted_index")),
            "authors": authors,  # Will be stored as JSONB
            "publication_date": work.get("publication_date"),
            "journal": journal,
            "doi": doi,
            "external_id": work.get("id"),  # OpenAlex ID like W2741809807
            "source": "openalex",
            "keywords": keywords,  # Will be stored as JSONB
            "url": url,
            "citation_count": work.get("cited_by_count", 0)
        }

    async def upsert_paper(self, paper_data: Dict[str, Any], paper_table) -> Optional[int]:
        """
        Upsert paper into the database with conflict handling.

        Args:
            paper_data: Dictionary containing paper data to insert/update
            paper_table: SQLAlchemy Table object for the papers table

        Returns:
            Paper ID if inserted/updated, None if skipped due to existing external_id
        """
        # Check if external_id already exists - skip if it does
        external_id = paper_data.get("external_id")
        if external_id:
            stmt = select(paper_table.c.external_id).where(
                paper_table.c.external_id == external_id
            ).limit(1)

            result = await self.session.execute(stmt)
            if result.scalar_one_or_none():
                logger.info(f"Skipping paper with existing external_id: {external_id}")
                return None

        # Prepare insert statement
        stmt = insert(paper_table).values(**paper_data)

        try:
            result = await self.session.execute(stmt.returning(paper_table.c.id))
            paper_id = result.scalar_one()
            await self.session.commit()
            logger.info(f"Inserted paper: {paper_data.get('title', 'Unknown')[:50]}... with ID {paper_id}")
            return paper_id
        except IntegrityError as e:
            await self.session.rollback()

            # Check if it's a doi conflict
            if "doi" in str(e).lower() and "unique" in str(e).lower():
                # Update existing paper by doi
                doi = paper_data.get("doi")
                if doi:
                    stmt = (
                        update(paper_table)
                        .where(paper_table.c.doi == doi)
                        .values(
                            citation_count=paper_data["citation_count"],
                            updated_at=func.now()
                        )
                        .returning(paper_table.c.id)
                    )
                    result = await self.session.execute(stmt)
                    paper_id = result.scalar_one()
                    await self.session.commit()
                    logger.info(f"Updated paper by doi: {doi} with ID {paper_id}")
                    return paper_id
                else:
                    logger.warning(f"Could not update paper - no doi available: {e}")
                    return None
            else:
                # Re-raise if it's a different integrity error
                logger.error(f"Integrity error during paper upsert: {e}")
                raise
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error upserting paper: {e}")
            raise

    async def fetch_full_text(self, work: Dict[str, Any]) -> Tuple[Optional[str], str]:
        """
        Fetch full text for an open access work.

        Args:
            work: OpenAlex work object

        Returns:
            Tuple of (full_text, chunk_type) where chunk_type is 'full_text' or 'abstract'
        """
        # Check if open access
        open_access = work.get("open_access", {})
        if not open_access.get("is_oa", False):
            abstract = self.reconstruct_abstract(work.get("abstract_inverted_index"))
            return (abstract or "", "abstract")

        # Try PDF first
        best_oa_location = work.get("best_oa_location", {})
        pdf_url = best_oa_location.get("pdf_url")
        if pdf_url and pdf_url.lower().endswith('.pdf'):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(pdf_url, timeout=30.0, follow_redirects=True)
                    if response.status_code == 200:
                        pdf_bytes = response.content
                        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                        text = ""
                        for page in doc:
                            text += page.get_text()
                        doc.close()
                        if text.strip():
                            return (text.strip(), 'full_text')
            except Exception as e:
                logger.warning(f"Failed to download/extract PDF from {pdf_url}: {e}")

        # Try HTML from oa_url
        oa_url = open_access.get("oa_url")
        if oa_url:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(oa_url, timeout=30.0, follow_redirects=True)
                    if response.status_code == 200:
                        soup = BeautifulSoup(response.text, 'html.parser')
                        # Try to find main content
                        main_content = soup.find('article') or soup.find('main') or soup.find('body')
                        if main_content:
                            # Remove script and style elements
                            for script in main_content(["script", "style"]):
                                script.decompose()
                            text = main_content.get_text(separator=' ', strip=True)
                            # Clean up extra whitespace
                            text = re.sub(r'\s+', ' ', text).strip()
                            if text:
                                return (text, 'full_text')
            except Exception as e:
                logger.warning(f"Failed to download/parse HTML from {oa_url}: {e}")

        # Fallback to abstract
        abstract = self.reconstruct_abstract(work.get("abstract_inverted_index"))
        logger.warning(f"Failed to get full text for OA work {work.get('id')}, falling back to abstract")
        return (abstract or "", "abstract")

    async def process_paper_chunks(self, paper_id: int, full_text: str, chunk_type: str, paper_chunks_table, chunking_func, embedding_func):
        """
        Process text into chunks, generate embeddings, and store in paper_chunks table.

        Args:
            paper_id: ID of the paper
            full_text: Full text or abstract to chunk
            chunk_type: Either 'full_text' or 'abstract'
            paper_chunks_table: SQLAlchemy Table object for paper_chunks
            chunking_func: Function to chunk text (text, chunk_size, overlap) -> list of strings
            embedding_func: Function to generate embeddings (text) -> list of floats
        """
        if not full_text or not full_text.strip():
            logger.warning(f"No text to chunk for paper ID {paper_id}")
            return

        # Chunk text (500 tokens with 50 token overlap)
        chunks = chunking_func(full_text, chunk_size=500, overlap=50)
        if not chunks:
            logger.warning(f"No chunks generated for paper ID {paper_id}")
            return

        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue

            try:
                # Generate embedding
                embedding = embedding_func(chunk)

                # Insert chunk
                stmt = insert(paper_chunks_table).values(
                    paper_id=paper_id,
                    chunk_index=i,
                    chunk_text=chunk,
                    chunk_type=chunk_type,
                    embedding=embedding
                )
                await self.session.execute(stmt)
                await self.session.commit()
                logger.debug(f"Stored chunk {i} for paper ID {paper_id}")
            except Exception as e:
                await self.session.rollback()
                logger.error(f"Error storing chunk {i} for paper ID {paper_id}: {e}")

    async def scrape_works(
        self,
        query: str,
        from_publication_date: Optional[str] = None,
        paper_table=None,
        paper_chunks_table=None,
        chunking_func=None,
        embedding_func=None
    ) -> None:
        """
        Scrape works from OpenAlex based on query and date filter.

        Args:
            query: Search query string
            from_publication_date: Optional date filter (YYYY-MM-DD)
            paper_table: SQLAlchemy Table object for the papers table
            paper_chunks_table: SQLAlchemy Table object for the paper_chunks table
            chunking_func: Function to chunk text
            embedding_func: Function to generate embeddings
        """
        if not all([paper_table, paper_chunks_table, chunking_func, embedding_func]):
            raise ValueError("Missing required arguments: paper_table, paper_chunks_table, chunking_func, embedding_func")

        params = {
            "search": query,
            "per_page": 200,  # Maximum allowed by OpenAlex
            "cursor": "*"     # Start with first page
        }

        if from_publication_date:
            params["from_publication_date"] = from_publication_date

        page_count = 0
        total_works = 0

        try:
            while True:
                page_count += 1
                logger.info(f"Fetching page {page_count}...")

                # Fetch page from OpenAlex
                response = await self.fetch_page(params)

                # Extract works from response
                works = response.get("results", [])
                if not works:
                    logger.info("No more works found.")
                    break

                total_works += len(works)
                logger.info(f"Found {len(works)} works on page {page_count}")

                # Process each work
                for work in works:
                    try:
                        # Map work to paper data
                        paper_data = self.map_work_to_paper(work)

                        # Upsert paper and get ID
                        paper_id = await self.upsert_paper(paper_data, paper_table)
                        if paper_id is None:
                            # Skipped due to existing external_id
                            continue

                        # Get full text and chunk type
                        full_text, chunk_type = await self.fetch_full_text(work)

                        # Process chunks
                        await self.process_paper_chunks(
                            paper_id,
                            full_text,
                            chunk_type,
                            paper_chunks_table,
                            chunking_func,
                            embedding_func
                        )
                    except Exception as e:
                        logger.error(f"Error processing work: {e}")
                        continue

                # Check for next cursor
                next_cursor = response.get("meta", {}).get("next_cursor")
                if not next_cursor:
                    logger.info("No next cursor - reached end of results.")
                    break

                params["cursor"] = next_cursor

                # Small delay to be extra polite (in addition to rate limiting)
                await asyncio.sleep(0.1)

            logger.info(f"Scraping completed. Processed {total_works} works from {page_count} pages.")

        except Exception as e:
            logger.error(f"Error during scraping: {e}")
            raise