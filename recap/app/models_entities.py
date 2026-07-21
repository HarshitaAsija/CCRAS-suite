from sqlalchemy import Column, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models import Base


class AyurvedaEntityTag(Base):
    __tablename__ = 'ayurveda_entity_tags'

    id = Column(Integer, primary_key=True)
    paper_id = Column(UUID(as_uuid=True))
    source_table = Column(Text, nullable=False, default='papers')
    entity_type = Column(Text, nullable=False)
    entity_value = Column(Text, nullable=False)
    tagged_at = Column(DateTime, default=func.now())
