from sqlalchemy import Column, Integer, Text, DateTime, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models import Base


class PaperCategory(Base):
    __tablename__ = 'paper_categories'

    id = Column(Integer, primary_key=True)
    paper_id = Column(UUID(as_uuid=True), ForeignKey('papers.id'))
    domain = Column(Text)
    intervention_type = Column(Text)
    condition_area = Column(Text)
    study_type = Column(Text)
    evidence_tier = Column(Text)
    confidence = Column(Float)
    taxonomy_version = Column(Text)
    categorized_at = Column(DateTime, default=func.now())
    model_used = Column(Text)
    research_phase = Column(Text)
    population = Column(Text)
    data_source = Column(Text)
    publication_status = Column(Text)
