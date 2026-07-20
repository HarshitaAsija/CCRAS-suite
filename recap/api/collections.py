from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models import User, Collection, Paper
from core.auth import get_current_user
import uuid
from datetime import datetime

router = APIRouter(
    prefix="/collections",
    tags=["collections"],
    responses={404: {"description": "Not found"}},
)


# Pydantic models
class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False
    hypothesis_seed: Optional[str] = None


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    hypothesis_seed: Optional[str] = None


class CollectionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_public: bool
    hypothesis_seed: Optional[str]
    user_id: str
    created_at: str
    updated_at: str
    paper_count: int = 0

    class Config:
        orm_mode = True


class CollectionPaperAdd(BaseModel):
    paper_id: str
    notes: Optional[str] = None


class CollectionPaperResponse(BaseModel):
    paper_id: str
    title: str
    abstract: Optional[str]
    authors: List[str]
    doi: Optional[str]
    keywords: List[str]
    ayush_entities: Optional[str]
    notes: Optional[str]
    added_at: str

    class Config:
        orm_mode = True


class CollectionExportResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_public: bool
    hypothesis_seed: Optional[str]
    user_id: str
    created_at: str
    updated_at: str
    papers: List[CollectionPaperResponse]

    class Config:
        orm_mode = True


@router.post("/", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    collection: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_collection = Collection(
        **collection.dict(),
        user_id=current_user.id,
    )
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)

    # Get paper count for response
    paper_count = len(db_collection.papers)

    return CollectionResponse(
        id=str(db_collection.id),
        name=db_collection.name,
        description=db_collection.description,
        is_public=db_collection.is_public,
        hypothesis_seed=db_collection.hypothesis_seed,
        user_id=str(db_collection.user_id),
        created_at=db_collection.created_at.isoformat(),
        updated_at=db_collection.updated_at.isoformat(),
        paper_count=paper_count,
    )


@router.get("/", response_model=List[CollectionResponse])
async def list_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collections = db.query(Collection).filter(Collection.user_id == current_user.id).all()

    result = []
    for collection in collections:
        paper_count = len(collection.papers)
        result.append(CollectionResponse(
            id=str(collection.id),
            name=collection.name,
            description=collection.description,
            is_public=collection.is_public,
            hypothesis_seed=collection.hypothesis_seed,
            user_id=str(collection.user_id),
            created_at=collection.created_at.isoformat(),
            updated_at=collection.updated_at.isoformat(),
            paper_count=paper_count,
        ))

    return result


@router.get("/{collection_id}", response_model=CollectionResponse)
async def get_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Check access rules: public or owned by user
    if not collection.is_public and collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this collection")

    paper_count = len(collection.papers)

    return CollectionResponse(
        id=str(collection.id),
        name=collection.name,
        description=collection.description,
        is_public=collection.is_public,
        hypothesis_seed=collection.hypothesis_seed,
        user_id=str(collection.user_id),
        created_at=collection.created_at.isoformat(),
        updated_at=collection.updated_at.isoformat(),
        paper_count=paper_count,
    )


@router.post("/{collection_id}/papers", response_model=CollectionPaperResponse)
async def add_paper_to_collection(
    collection_id: str,
    paper_data: CollectionPaperAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify collection exists and user owns it
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this collection")

    # Verify paper exists
    paper = db.query(Paper).filter(Paper.id == paper_data.paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Check if paper is already in collection (idempotent - don't add again)
    existing_association = db.execute(
        """
        SELECT notes, added_at FROM collection_papers
        WHERE collection_id = :collection_id AND paper_id = :paper_id
        """,
        {"collection_id": collection_id, "paper_id": paper_data.paper_id}
    ).fetchone()

    if existing_association:
        # Paper already in collection, update notes if provided (idempotent behavior)
        notes_to_use = paper_data.notes if paper_data.notes is not None else existing_association[0]
        added_at = existing_association[1]

        # Update notes if they were provided in the request
        if paper_data.notes is not None:
            db.execute(
                """
                UPDATE collection_papers
                SET notes = :notes, added_at = now()
                WHERE collection_id = :collection_id AND paper_id = :paper_id
                """,
                {"collection_id": collection_id, "paper_id": paper_data.paper_id, "notes": paper_data.notes}
            )
            db.commit()
            # Fetch updated added_at
            updated_result = db.execute(
                """
                SELECT added_at FROM collection_papers
                WHERE collection_id = :collection_id AND paper_id = :paper_id
                """,
                {"collection_id": collection_id, "paper_id": paper_data.paper_id}
            ).fetchone()
            added_at = updated_result[0] if updated_result else added_at
    else:
        # Insert the association
        db.execute(
            """
            INSERT INTO collection_papers (collection_id, paper_id, notes)
            VALUES (:collection_id, :paper_id, :notes)
            """,
            {
                "collection_id": collection_id,
                "paper_id": paper_data.paper_id,
                "notes": paper_data.notes
            }
        )
        db.commit()

        # Get the added_at timestamp
        added_at_result = db.execute(
            """
            SELECT added_at FROM collection_papers
            WHERE collection_id = :collection_id AND paper_id = :paper_id
            """,
            {"collection_id": collection_id, "paper_id": paper_data.paper_id}
        ).fetchone()
        added_at = added_at_result[0] if added_at_result else None
        notes_to_use = paper_data.notes

    # Return paper information with notes
    return CollectionPaperResponse(
        paper_id=str(paper.id),
        title=paper.title,
        abstract=paper.abstract,
        authors=[author.name for author in paper.authors],
        doi=paper.doi,
        keywords=[keyword.keyword for keyword in paper.keywords],
        ayush_entities=paper.ayush_entities,
        notes=notes_to_use,
        added_at=added_at.isoformat() if added_at else datetime.utcnow().isoformat()
    )


@router.delete("/{collection_id}/papers/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_paper_from_collection(
    collection_id: str,
    paper_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify collection exists and user owns it
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this collection")

    # Remove the association
    result = db.execute(
        """
        DELETE FROM collection_papers
        WHERE collection_id = :collection_id AND paper_id = :paper_id
        """,
        {"collection_id": collection_id, "paper_id": paper_id}
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Paper not found in collection")


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify collection exists and user owns it
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this collection")

    # Delete collection (cascade will remove collection_papers entries)
    db.delete(collection)
    db.commit()


@router.get("/{collection_id}/export", response_model=CollectionExportResponse)
async def export_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify collection exists and user has access (public or owned)
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if not collection.is_public and collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this collection")

    # Get papers with their details and collection-specific data (notes, added_at)
    papers_query = db.query(
        Paper,
        collection_papers.c.notes,
        collection_papers.c.added_at
    ).join(
        collection_papers, Paper.id == collection_papers.c.paper_id
    ).filter(collection_papers.c.collection_id == collection_id)

    papers = []
    for paper, notes, added_at in papers_query:
        papers.append(CollectionPaperResponse(
            paper_id=str(paper.id),
            title=paper.title,
            abstract=paper.abstract,
            authors=[author.name for author in paper.authors],
            doi=paper.doi,
            keywords=[keyword.keyword for keyword in paper.keywords],
            ayush_entities=paper.ayush_entities,
            notes=notes,
            added_at=added_at.isoformat() if added_at else datetime.utcnow().isoformat()
        ))

    return CollectionExportResponse(
        id=str(collection.id),
        name=collection.name,
        description=collection.description,
        is_public=collection.is_public,
        hypothesis_seed=collection.hypothesis_seed,
        user_id=str(collection.user_id),
        created_at=collection.created_at.isoformat(),
        updated_at=collection.updated_at.isoformat(),
        papers=papers,
    )