from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import sys
import os

app = FastAPI(title="Krita RAG")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    import subprocess, shutil
    # Start ollama if available
    if shutil.which("ollama"):
        subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # Initialize database: create tables and ensure pgvector extension
    from app.database import create_tables, ensure_extension
    import asyncio
    # Create tables
    if asyncio.iscoroutinefunction(create_tables):
        await create_tables()
    else:
        create_tables()
    # Ensure pgvector extension exists
    if asyncio.iscoroutinefunction(ensure_extension):
        await ensure_extension()
    else:
        ensure_extension()

# Include routers
from ingestion.pubmed_fetcher import router as pubmed_router
from ingestion.arxiv_fetcher import router as arxiv_router
from ingestion.grobid_client import router as grobid_router
from api.upload import router as upload_router
from api.ingestion import router as ingestion_router
from app.routers.search import router as search_router
from api.summarization import router as summarization_router
from api.dashboard import router as dashboard_router
from api.analytics import router as analytics_router


app.include_router(pubmed_router)
app.include_router(arxiv_router)
app.include_router(grobid_router)
app.include_router(upload_router)
app.include_router(ingestion_router)
app.include_router(search_router)
app.include_router(summarization_router)
app.include_router(dashboard_router)
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])


@app.get("/")
async def root():
    return {"status": "Krita Backend is running!", "loaded_routers": []}

@app.get("/health")
async def health():
    return {"status": "healthy", "routers": []}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)