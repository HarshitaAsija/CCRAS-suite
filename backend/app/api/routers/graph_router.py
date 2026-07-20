from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.knowledge_graph import KnowledgeGraphPipeline

router = APIRouter(
    prefix="/graph",
    tags=["Knowledge Graph"]
)

pipeline = KnowledgeGraphPipeline()


class GraphRequest(BaseModel):
    query: str
    user_id: str = "default"


class ExpandRequest(BaseModel):
    concept: str
    user_id: str = "default"


@router.post("/")
async def build_graph(request: GraphRequest):
    try:
        return pipeline.run(
            query=request.query,
            user_id=request.user_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/expand")
async def expand_graph(request: ExpandRequest):
    try:
        return pipeline.expand(
            concept=request.concept,
            user_id=request.user_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))