import logging
from app.routers.entities import router as entities_router
from app.routers.study import router as study_router
from app.routers.study_design_ai import router as study_design_ai_router
from app.routers.evidence_adapter import router as evidence_adapter_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

@app.on_event("startup")
def startup_event():
    try:
        from app.db.base import Base
        from app.db.session import engine
        import app.models  # Load all models to ensure registration
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized/verified.")
    except Exception as e:
        logger.error(f"Failed to auto-initialize database tables: {e}")

app.include_router(entities_router, prefix="/api/v1")
app.include_router(study_router, prefix=settings.API_V1_STR)
app.include_router(study_design_ai_router, prefix=settings.API_V1_STR)
app.include_router(evidence_adapter_router, prefix=settings.API_V1_STR)
# CORS

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ingestion router
from app.api.routers.ingestion_router import router as ingestion_router

app.include_router(ingestion_router, prefix=settings.API_V1_STR)

# Paper router
try:
    from app.api.routers.paper_router import router as paper_router

    app.include_router(paper_router, prefix=settings.API_V1_STR)
    logger.info("paper_router loaded (DB available)")
except Exception as e:
    logger.warning(f"paper_router skipped (DB not available): {e}")


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")
