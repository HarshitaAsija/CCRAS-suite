from sqlalchemy import Column, Integer, String, Text, Date, DateTime, JSON, func
from pgvector.sqlalchemy import Vector
from app.db.base import Base


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(Text, nullable=False)
    abstract = Column(Text, nullable=False)  # Required for downstream NLP
    full_text = Column(Text)                 # Optional – full article body
    authors = Column(JSON, nullable=False)    # List of author strings
    journal = Column(String(255), nullable=False)
    publication_date = Column(Date, nullable=False)
    doi = Column(String(255), unique=True, index=True)
    pmid = Column(String(255), unique=True, index=True)   # PubMed ID
    # open_access column removed because it doesn't exist in the remote DB
    source = Column(String(100), default="pubmed")
    @property
    def open_access(self) -> str:
        return "false"
    # 1536‑dimensional embedding (e.g., BioBERT or SciBERT) to match remote DB
    embedding = Column(Vector(1536))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
