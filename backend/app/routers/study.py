from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.db.session import get_db
from app.models.study import Study
from app.schemas.study import StudyCreate, StudyUpdate, StudyOut, StudyListResponse

router = APIRouter(prefix="/studies", tags=["studies"])

@router.post("/", response_model=StudyOut, status_code=status.HTTP_201_CREATED)
def create_study(study_in: StudyCreate, db: Session = Depends(get_db)):
    study = Study(**study_in.model_dump())
    db.add(study)
    db.commit()
    db.refresh(study)
    return study

@router.get("/", response_model=StudyListResponse)
def list_studies(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search term for title or question"),
    study_type: Optional[str] = Query(None, description="Filter by study design type"),
    completeness_min: Optional[int] = Query(None),
    quality_score_min: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Study)

    if search:
        query = query.filter(
            or_(
                Study.title.ilike(f"%{search}%"),
                Study.research_question.ilike(f"%{search}%")
            )
        )
    
    if study_type:
        # Since study_type is stored as a JSON column, we filter based on key matching or value containments
        # For simplicity of both SQL databases and SQLite/PG compat, we can search the text cast
        query = query.filter(Study.study_type.cast(String).ilike(f"%{study_type}%"))

    if completeness_min is not None:
        query = query.filter(Study.completeness >= completeness_min)

    if quality_score_min is not None:
        query = query.filter(Study.quality_score >= quality_score_min)

    total = query.count()
    offset = (page - 1) * page_size
    results = query.order_by(Study.updated_at.desc()).offset(offset).limit(page_size).all()

    return StudyListResponse(
        total=total,
        page=page,
        page_size=page_size,
        results=results
    )

@router.get("/{study_id}", response_model=StudyOut)
def get_study(study_id: int, db: Session = Depends(get_db)):
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study protocol not found")
    return study

@router.put("/{study_id}", response_model=StudyOut)
def update_study(study_id: int, study_in: StudyUpdate, db: Session = Depends(get_db)):
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study protocol not found")
    
    update_data = study_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(study, field, value)
        
    db.commit()
    db.refresh(study)
    return study

@router.delete("/{study_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_study(study_id: int, db: Session = Depends(get_db)):
    study = db.query(Study).filter(Study.id == study_id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study protocol not found")
    db.delete(study)
    db.commit()
    return None

# Import String for JSON casting support across engines
from sqlalchemy import String
