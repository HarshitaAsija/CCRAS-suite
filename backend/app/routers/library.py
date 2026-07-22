import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/library",
    tags=["Library & Collections"]
)

# ----------------------------
# In-Memory Storage & Fallbacks
# ----------------------------
# Default initial collections so the user always sees initial sample collections
IN_MEMORY_COLLECTIONS: Dict[int, Dict[str, Any]] = {
    1: {
        "id": 1,
        "user_id": "11111111-1111-1111-1111-111111111111",
        "name": "Ayurveda & Respiratory Care",
        "description": "Curated research papers on traditional formulations for asthma, bronchitis, and respiratory health.",
        "is_public": True,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "paper_count": 3
    },
    2: {
        "id": 2,
        "user_id": "11111111-1111-1111-1111-111111111111",
        "name": "Immunomodulators & Rasayana",
        "description": "Studies on Ashwagandha, Guduchi, and Tulsi in clinical immunomodulation.",
        "is_public": False,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "paper_count": 2
    }
}

IN_MEMORY_PAPERS: Dict[str, Dict[str, Any]] = {}
IN_MEMORY_COLLECTION_PAPERS: Dict[int, List[Dict[str, Any]]] = {
    1: [
        {
            "id": "paper-101",
            "user_id": "11111111-1111-1111-1111-111111111111",
            "paper_id": "10.1016/j.jep.2023.116542",
            "title": "Clinical Efficacy of Vasa (Adhatoda vasica) in Chronic Bronchitis: A Systematic Review",
            "authors": ["Sharma, R.", "Patel, K."],
            "abstract": "Evaluation of bronchodilator and mucolytic actions of vasicine alkaloids.",
            "source": "Journal of Ethnopharmacology",
            "saved_at": datetime.now().isoformat()
        }
    ]
}

# ----------------------------
# Schemas
# ----------------------------
class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class PaperSaveRequest(BaseModel):
    paper_id: str
    title: str
    authors: Optional[List[str]] = []
    abstract: Optional[str] = None
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}

class AnnotationsUpdate(BaseModel):
    annotations: str

class AddPaperToCollectionRequest(BaseModel):
    library_paper_id: str

# ----------------------------
# Collections Endpoints
# ----------------------------
@router.get("/collections")
async def list_collections(user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    cols = [c for c in IN_MEMORY_COLLECTIONS.values() if c["user_id"] == user_id or c["is_public"]]
    return cols

@router.post("/collections")
async def create_collection(data: CollectionCreate, user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    new_id = max(IN_MEMORY_COLLECTIONS.keys(), default=0) + 1
    col = {
        "id": new_id,
        "user_id": user_id,
        "name": data.name,
        "description": data.description or "",
        "is_public": data.is_public,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "paper_count": 0
    }
    IN_MEMORY_COLLECTIONS[new_id] = col
    IN_MEMORY_COLLECTION_PAPERS[new_id] = []
    return col

@router.get("/collections/{collection_id}")
async def get_collection(collection_id: int, user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    col = IN_MEMORY_COLLECTIONS.get(collection_id)
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    return col

@router.patch("/collections/{collection_id}")
async def update_collection(collection_id: int, data: CollectionUpdate, user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    col = IN_MEMORY_COLLECTIONS.get(collection_id)
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    if data.name is not None:
        col["name"] = data.name
    if data.description is not None:
        col["description"] = data.description
    col["updated_at"] = datetime.now().isoformat()
    return col

@router.delete("/collections/{collection_id}")
async def delete_collection(collection_id: int, user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    if collection_id in IN_MEMORY_COLLECTIONS:
        del IN_MEMORY_COLLECTIONS[collection_id]
    if collection_id in IN_MEMORY_COLLECTION_PAPERS:
        del IN_MEMORY_COLLECTION_PAPERS[collection_id]
    return {"success": True}

@router.get("/collections/{collection_id}/papers")
async def list_collection_papers(collection_id: int, user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    return IN_MEMORY_COLLECTION_PAPERS.get(collection_id, [])

@router.post("/collections/{collection_id}/papers")
async def add_paper_to_collection(collection_id: int, data: AddPaperToCollectionRequest, user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    papers_list = IN_MEMORY_COLLECTION_PAPERS.setdefault(collection_id, [])
    # Find paper in library
    paper = IN_MEMORY_PAPERS.get(data.library_paper_id)
    if not paper:
        paper = {
            "id": data.library_paper_id,
            "user_id": user_id,
            "paper_id": data.library_paper_id,
            "title": f"Paper {data.library_paper_id}",
            "saved_at": datetime.now().isoformat()
        }
    papers_list.append(paper)
    if collection_id in IN_MEMORY_COLLECTIONS:
        IN_MEMORY_COLLECTIONS[collection_id]["paper_count"] = len(papers_list)
    return {"success": True}

@router.delete("/collections/{collection_id}/papers/{paper_id}")
async def remove_paper_from_collection(collection_id: int, paper_id: str, user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    if collection_id in IN_MEMORY_COLLECTION_PAPERS:
        IN_MEMORY_COLLECTION_PAPERS[collection_id] = [p for p in IN_MEMORY_COLLECTION_PAPERS[collection_id] if p.get("id") != paper_id and p.get("paper_id") != paper_id]
        if collection_id in IN_MEMORY_COLLECTIONS:
            IN_MEMORY_COLLECTIONS[collection_id]["paper_count"] = len(IN_MEMORY_COLLECTION_PAPERS[collection_id])
    return {"success": True}

@router.get("/collections/{collection_id}/export")
async def export_collection(collection_id: int, format: str = Query("bibtex"), user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    col = IN_MEMORY_COLLECTIONS.get(collection_id, {"name": f"Collection_{collection_id}"})
    papers = IN_MEMORY_COLLECTION_PAPERS.get(collection_id, [])
    if format == "bibtex":
        lines = []
        for idx, p in enumerate(papers):
            lines.append(f"@article{{paper_{idx+1},\n  title={{{p.get('title')}}},\n  journal={{{p.get('source', 'Journal')}}},\n  year={{2024}}\n}}")
        return Response(content="\n\n".join(lines) or "@article{empty,\n  title={No papers}\n}", media_type="text/plain")
    return Response(content=f"Export format {format} generated for {col.get('name')}", media_type="text/plain")

# ----------------------------
# Papers Library Endpoints
# ----------------------------
@router.get("/papers")
async def list_library_papers(user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    return list(IN_MEMORY_PAPERS.values())

@router.post("/papers")
async def save_library_paper(data: PaperSaveRequest, user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    paper_obj = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "paper_id": data.paper_id,
        "title": data.title,
        "authors": data.authors,
        "abstract": data.abstract,
        "source": data.source,
        "paper_metadata": data.metadata,
        "annotations": "",
        "saved_at": datetime.now().isoformat()
    }
    IN_MEMORY_PAPERS[paper_obj["id"]] = paper_obj
    return paper_obj

@router.patch("/papers/{library_paper_id}/annotations")
async def update_paper_annotations(library_paper_id: str, data: AnnotationsUpdate, user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    paper = IN_MEMORY_PAPERS.get(library_paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found in library")
    paper["annotations"] = data.annotations
    return paper

@router.delete("/papers/{library_paper_id}")
async def remove_library_paper(library_paper_id: str, user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    if library_paper_id in IN_MEMORY_PAPERS:
        del IN_MEMORY_PAPERS[library_paper_id]
    return {"success": True}

@router.get("/papers/duplicates")
async def get_duplicate_papers(user_id: str = Query("11111111-1111-1111-1111-111111111111")):
    return {"duplicates": []}
