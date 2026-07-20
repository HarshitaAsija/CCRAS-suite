from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, text, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID

Base = declarative_base()


class UploadedPaper(Base):
    __tablename__ = 'uploaded_papers'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    title = Column(Text, nullable=False)
    abstract = Column(Text)
    authors = Column(JSON)
    journal = Column(Text)
    published_date = Column(Text)
    doi = Column(String, unique=True, index=True, nullable=True)
    pmid = Column(String)
    arxiv_id = Column(String)
    full_text = Column(Text)
    pdf_url = Column(Text)
    source = Column(String, nullable=False)
    status = Column(String, nullable=False, server_default='uploaded')
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    keywords = relationship("UploadedPaperKeyword", back_populates="paper", cascade="all, delete-orphan")


class UploadedPaperKeyword(Base):
    __tablename__ = 'uploaded_paper_keywords'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    paper_id = Column(UUID(as_uuid=True), ForeignKey('uploaded_papers.id'), nullable=False)
    keyword = Column(Text, nullable=False)
    score = Column(Float)
    created_at = Column(DateTime(timezone=True), default=func.now())

    paper = relationship("UploadedPaper", back_populates="keywords")
