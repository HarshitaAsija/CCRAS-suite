from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ontology_graph import OntologyGraphPipeline

router = APIRouter(
    prefix="/ontology",
    tags=["Ontology Graph"]
)

onto_pipeline = OntologyGraphPipeline()


class OntologyExpandRequest(BaseModel):
    code: str


@router.get("/")
async def get_ontology_graph():
    try:
        result = onto_pipeline.neo4j.get_ontology_graph_for_viz()
        if result["nodes"]:
            return result
        # Nothing written to Neo4j yet — build it once, then serve from Neo4j
        # on subsequent calls.
        return onto_pipeline.run()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/build")
async def build_ontology():
    try:
        return onto_pipeline.run()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/expand")
async def expand_ontology(request: OntologyExpandRequest):
    try:
        return onto_pipeline.expand_ontology(request.code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))