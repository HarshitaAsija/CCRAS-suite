from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.db.base import Base

class Study(Base):
    __tablename__ = "studies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    research_question = Column(Text, nullable=True)
    pico = Column(JSON, nullable=True)
    hypothesis = Column(JSON, nullable=True)
    study_type = Column(JSON, nullable=True)
    sample_size = Column(JSON, nullable=True)
    statistical_plan = Column(JSON, nullable=True)
    eligibility = Column(JSON, nullable=True)
    confounders = Column(JSON, nullable=True)
    ayush_protocol = Column(JSON, nullable=True)
    timeline = Column(JSON, nullable=True)
    ethics = Column(JSON, nullable=True)
    quality_score = Column(Integer, default=0)
    completeness = Column(Integer, default=0)
    risks = Column(JSON, default=list)
    compliance = Column(JSON, default=list)
    snapshots = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
