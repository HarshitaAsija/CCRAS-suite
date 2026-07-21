from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class StudyBase(BaseModel):
    title: str
    research_question: Optional[str] = None
    pico: Optional[Dict[str, Any]] = None
    hypothesis: Optional[Dict[str, Any]] = None
    study_type: Optional[Dict[str, Any]] = None
    sample_size: Optional[Dict[str, Any]] = None
    statistical_plan: Optional[Dict[str, Any]] = None
    eligibility: Optional[Dict[str, Any]] = None
    confounders: Optional[List[Dict[str, Any]]] = None
    ayush_protocol: Optional[Dict[str, Any]] = None
    timeline: Optional[List[Dict[str, Any]]] = None
    ethics: Optional[List[Dict[str, Any]]] = None
    quality_score: Optional[int] = 0
    completeness: Optional[int] = 0
    risks: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    compliance: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    snapshots: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

class StudyCreate(StudyBase):
    pass

class StudyUpdate(BaseModel):
    title: Optional[str] = None
    research_question: Optional[str] = None
    pico: Optional[Dict[str, Any]] = None
    hypothesis: Optional[Dict[str, Any]] = None
    study_type: Optional[Dict[str, Any]] = None
    sample_size: Optional[Dict[str, Any]] = None
    statistical_plan: Optional[Dict[str, Any]] = None
    eligibility: Optional[Dict[str, Any]] = None
    confounders: Optional[List[Dict[str, Any]]] = None
    ayush_protocol: Optional[Dict[str, Any]] = None
    timeline: Optional[List[Dict[str, Any]]] = None
    ethics: Optional[List[Dict[str, Any]]] = None
    quality_score: Optional[int] = None
    completeness: Optional[int] = None
    risks: Optional[List[Dict[str, Any]]] = None
    compliance: Optional[List[Dict[str, Any]]] = None
    snapshots: Optional[List[Dict[str, Any]]] = None

class StudyOut(StudyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class StudyListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: List[StudyOut]
