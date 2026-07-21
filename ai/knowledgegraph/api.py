import os
import json
import hashlib
import logging
from contextlib import asynccontextmanager

import redis
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from knowledge_graph import KnowledgeGraphPipeline
from ontology_graph import OntologyGraphPipeline

load_dotenv()
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# GLOBALS
# ─────────────────────────────────────────────
pipeline: KnowledgeGraphPipeline | None = None
onto_pipeline: OntologyGraphPipeline | None = None
_redis_client = None

REDIS_TTL = int(os.getenv("REDIS_TTL", "86400"))  # 24 hours default


# ─────────────────────────────────────────────
# REDIS
# ─────────────────────────────────────────────
def get_redis():
    global _redis_client
    if _redis_client is None:
        try:
            client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
            client.ping()
            _redis_client = client
            logger.info("Connected to Redis ✓")
        except Exception as e:
            logger.warning(f"Redis not available: {e} — caching disabled")
            _redis_client = False
    return _redis_client if _redis_client else None


def cache_key_graph(query: str, user_id: str) -> str:
    raw = f"{query.lower().strip()}:{user_id}"
    return f"kg:{hashlib.md5(raw.encode()).hexdigest()}"


def cache_get(key: str):
    r = get_redis()
    if not r:
        return None
    try:
        data = r.get(key)
        if data:
            logger.info(f"Cache HIT → {key}")
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Redis GET failed: {e}")
    return None


def cache_set(key: str, value: dict, ttl: int = REDIS_TTL):
    r = get_redis()
    if not r:
        return
    try:
        r.setex(key, ttl, json.dumps(value))
        logger.info(f"Cached → {key} (TTL={ttl}s)")
    except Exception as e:
        logger.warning(f"Redis SET failed: {e}")


def cache_delete(pattern: str):
    r = get_redis()
    if not r:
        return 0
    try:
        keys = r.keys(pattern)
        if keys:
            r.delete(*keys)
        return len(keys)
    except Exception as e:
        logger.warning(f"Redis DELETE failed: {e}")
        return 0


# ─────────────────────────────────────────────
# APP LIFESPAN
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline, onto_pipeline
    pipeline = KnowledgeGraphPipeline()
    onto_pipeline = OntologyGraphPipeline()
    get_redis()  # init Redis on startup
    yield
    if pipeline:    pipeline.close()
    if onto_pipeline: onto_pipeline.close()


app = FastAPI(title="RishiAI Knowledge Graph API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────
class GraphRequest(BaseModel):
    query: str
    user_id: str = "anonymous"

class ExpandRequest(BaseModel):
    concept: str
    user_id: str = "anonymous"


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────
@app.get("/healthz")
def health():
    r = get_redis()
    return {
        "status": "ok",
        "redis": "connected" if r else "unavailable",
    }


@app.post("/graph")
def build_graph(req: GraphRequest):
    """
    Build knowledge graph for a query.
    Returns cached result if available (Redis), else runs full pipeline.
    """
    if not req.query.strip():
        raise HTTPException(400, "query must not be empty")

    key = cache_key_graph(req.query, req.user_id)

    # ── Check Redis cache ────────────────────────────────────────────
    cached = cache_get(key)
    if cached:
        logger.info(f"Returning cached graph for '{req.query}'")
        return cached

    # ── Cache miss — run full pipeline ───────────────────────────────
    logger.info(f"Cache MISS for '{req.query}' — running pipeline")
    try:
        result = pipeline.run(req.query.strip(), user_id=req.user_id)
        cache_set(key, result)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/graph/expand")
def expand_node(req: ExpandRequest):
    """Expand a clicked concept node — returns its neighbours."""
    try:
        return pipeline.expand(req.concept, user_id=req.user_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/ontology")
def get_ontology_graph():
    """
    Returns ontology graph.
    Priority: Redis cache → Neo4j → full rebuild.
    """
    key = "ontology:full"

    # ── Check Redis cache ────────────────────────────────────────────
    cached = cache_get(key)
    if cached:
        return cached

    # ── Try Neo4j ────────────────────────────────────────────────────
    try:
        result = onto_pipeline.neo4j.get_ontology_graph_for_viz()
        if result["nodes"]:
            cache_set(key, result, ttl=86400)
            return result
        # Not built yet — run pipeline
        result = onto_pipeline.run()
        cache_set(key, result, ttl=86400)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/ontology/build")
def build_ontology():
    """Force rebuild ontology graph and refresh cache."""
    try:
        result = onto_pipeline.run()
        cache_set("ontology:full", result, ttl=86400)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@app.delete("/cache")
def clear_cache(query: str | None = None):
    """
    Clear Redis cache.
    - /cache           → clears everything
    - /cache?query=tb  → clears only that query's cache
    """
    if query:
        # Clear specific query for all users
        pattern = f"kg:{hashlib.md5(query.lower().strip().encode()).hexdigest()}"
        deleted = cache_delete(pattern)
        return {"cleared": deleted, "query": query}
    else:
        kg_deleted   = cache_delete("kg:*")
        onto_deleted = cache_delete("ontology:*")
        return {"cleared": kg_deleted + onto_deleted, "kg": kg_deleted, "ontology": onto_deleted}


@app.get("/cache/stats")
def cache_stats():
    """Show what's currently in Redis cache."""
    r = get_redis()
    if not r:
        return {"status": "Redis unavailable"}
    try:
        kg_keys   = r.keys("kg:*")
        onto_keys = r.keys("ontology:*")
        return {
            "status":          "connected",
            "cached_queries":  len(kg_keys),
            "cached_ontology": len(onto_keys),
            "total_keys":      len(kg_keys) + len(onto_keys),
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)