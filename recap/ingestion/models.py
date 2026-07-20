from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

@dataclass
class Author:
    name: str
    orcid: Optional[str] = None

@dataclass
class RawPaper:
    title: str
    abstract: str
    authors: list
    source: str
    published_date: Optional[datetime] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None
    arxiv_id: Optional[str] = None
    full_text: Optional[str] = None
    pdf_url: Optional[str] = None
    keywords: list = field(default_factory=list)
    journal: Optional[str] = None
    references: list = field(default_factory=list)
    citations: list = field(default_factory=list)