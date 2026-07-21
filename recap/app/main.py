from fastapi import FastAPI
from app.database import create_tables
from api.auth import router as auth_router
from app.routers.search import router as search_router
from api.upload import router as upload_router
from api.ingestion import router as ingestion_router
from app.routers.papers import router as papers_router
from api.rag import router as rag_router
from app.routers import library 
from api.dashboard import router as dashboard_router
from api.analytics import router as analytics_router
from fastapi.middleware.cors import CORSMiddleware
from pgvector.asyncpg import register_vector
import asyncpg
from neo4j import GraphDatabase
import os
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

async def _init_pooled_connection(conn):
    await register_vector(conn)

DATABASE_URL = os.getenv("DATABASE_URL")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers - NOTE: dashboard and analytics already have /api in their router definitions
app.include_router(auth_router)
app.include_router(search_router, prefix="/api")
app.include_router(upload_router)
app.include_router(ingestion_router)
app.include_router(papers_router, prefix="/api")
app.include_router(rag_router, prefix="/api")
app.include_router(library.router, prefix="/api")

# ✅ CORRECT - Don't add prefix here since they already have /api
app.include_router(dashboard_router)  # Already has /api/dashboard
app.include_router(analytics_router)  # Already has /api/analytics

# Log all registered routes for debugging
logger.info("📋 Registered Routes:")
for route in app.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        methods = list(route.methods) if route.methods else []
        if methods:
            logger.info(f"  {methods} {route.path}")

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}

@app.get("/api/health")
async def health_check():
    result = {"status": "ok"}

    try:
        conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
        await conn.fetchval("SELECT 1")
        await conn.close()
        result["postgres"] = "connected"
    except Exception as e:
        result["postgres"] = f"error: {str(e)}"

    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            session.run("RETURN 1")
        driver.close()
        result["neo4j"] = "connected"
    except Exception as e:
        result["neo4j"] = f"error: {str(e)}"

    return result

@app.on_event("startup")
async def startup_event():
    try:
        create_tables()
    except Exception as e:
        pass

# second startup handler
@app.on_event("startup")
async def startup_db_pool():
    app.state.pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=5,
        max_size=20,
        statement_cache_size=0,
        init=_init_pooled_connection,
    )

# a shutdown handler
@app.on_event("shutdown")
async def shutdown_db_pool():
    await app.state.pool.close()