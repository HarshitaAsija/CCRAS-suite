import asyncio
import logging
from dataclasses import dataclass
from typing import List, Optional
import httpx
from lxml import etree
import os
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from app.models import User
from core.auth import get_current_user

@dataclass
class Reference:
    title: Optional[str]
    authors: List[str]
    doi: Optional[str]
    year: Optional[str]

@dataclass
class GrobidPaper:
    title: str
    abstract: str
    body: str
    references: List[Reference]
    section_headings: List[str]

class GrobidClient:
    def __init__(self, grobid_url: Optional[str] = None):
        # Use environment variable GROBID_URL, default to http://localhost:8070 as per instruction
        self.grobid_url = grobid_url or os.getenv("GROBID_URL", "http://localhost:8070")
        self.timeout = 30.0  # 30 second timeout for GROBID processing

    async def process_pdf(self, pdf_content: bytes) -> GrobidPaper:
        """
        Send PDF to GROBID service and parse the TEI XML response
        """
        try:
            # Send PDF to GROBID for processing
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                files = {'input': ('document.pdf', pdf_content, 'application/pdf')}
                response = await client.post(
                    f"{self.grobid_url}/api/processFulltextDocument",
                    files=files,
                    data={'generateIDs': 'true'}
                )
                response.raise_for_status()

                # Parse the TEI XML response
                return self._parse_tei_xml(response.text)
        except Exception as e:
            logger.error(f"Error processing PDF with GROBID: {e}")
            raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

    def _parse_tei_xml(self, xml_content: str) -> GrobidPaper:
        """
        Parse the TEI XML response from GROBID to extract structured data
        """
        try:
            root = etree.fromstring(xml_content.encode('utf-8'))

            # Extract title
            title = ""
            title_elem = root.xpath('//tei:titleStmt/tei:title', namespaces={'tei': 'http://www.tei-c.org/ns/1.0'})
            if title_elem:
                title = ''.join(title_elem[0].itertext()).strip()

            # Extract abstract
            abstract = ""
            abstract_elem = root.xpath('//tei:abstract//tei:p', namespaces={'tei': 'http://www.tei-c.org/ns/1.0'})
            if abstract_elem:
                abstract = ''.join(abstract_elem[0].itertext()).strip()

            # Extract body text
            body = ""
            body_elem = root.xpath('//tei:text//tei:body', namespaces={'tei': 'http://www.tei-c.org/ns/1.0'})
            if body_elem:
                # Get all text from body
                body_texts = body_elem[0].xpath('.//text()', namespaces={'tei': 'http://www.tei-c.org/ns/1.0'})
                body = ' '.join([text.strip() for text in body_texts if text.strip()]).strip()

            # Extract section headings
            section_headings = []
            heading_elems = root.xpath('//tei:head', namespaces={'tei': 'http://www.tei-c.org/ns/1.0'})
            for heading in heading_elems:
                heading_text = ''.join(heading.itertext()).strip()
                if heading_text:
                    section_headings.append(heading_text)

            # Extract references
            references = []
            bibl_structs = root.xpath('//tei:back//tei:listBibl/tei:biblStruct', namespaces={'tei': 'http://www.tei-c.org/ns/1.0'})
            for bibl in bibl_structs:
                # Extract reference title
                ref_title = ""
                ref_title_elem = bibl.xpath('.//tei:title', namespaces={'tei': 'http://www.tei-c.org/ns/1.0'})
                if ref_title_elem:
                    ref_title = ''.join(ref_title_elem[0].itertext()).strip()

                # Extract authors
                ref_authors = []
                author_elems = bibl.xpath('.//tei:author/tei:persName', namespaces={'tei': 'http://www.tei-c.org/ns/1.0'})
                for author in author_elems:
                    author_name = ''.join(author.itertext()).strip()
                    if author_name:
                        ref_authors.append(author_name)

                # Extract DOI
                ref_doi = None
                doi_elem = bibl.xpath('.//tei:idno[@type="DOI"]', namespaces={'tei': 'http://www.tei-c.org/ns/1.0'})
                if doi_elem:
                    ref_doi = ''.join(doi_elem[0].itertext()).strip()

                # Extract year
                ref_year = None
                date_elem = bibl.xpath('.//tei:date[@type="published"]', namespaces={'tei': 'http://www.tei-c.org/ns/1.0'})
                if date_elem and 'when' in date_elem[0].attrib:
                    ref_year = date_elem[0].attrib['when'][:4]  # Extract year from YYYY-MM-DD format

                reference = Reference(
                    title=ref_title if ref_title else None,
                    authors=ref_authors,
                    doi=ref_doi,
                    year=ref_year
                )
                references.append(reference)

            return GrobidPaper(
                title=title,
                abstract=abstract,
                body=body,
                references=references,
                section_headings=section_headings
            )
        except Exception as e:
            logger.error(f"Error parsing TEI XML: {e}")
            raise HTTPException(status_code=500, detail=f"Error parsing document: {str(e)}")

# FastAPI endpoint
router = APIRouter()
grobid_client = GrobidClient()

@router.post("/api/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    try:
        # Read the PDF file
        pdf_content = await file.read()

        # Process with GROBID
        paper = await grobid_client.process_pdf(pdf_content)

        return {
            "title": paper.title,
            "abstract": paper.abstract,
            "body_length": len(paper.body),
            "references_count": len(paper.references),
            "section_headings_count": len(paper.section_headings)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))