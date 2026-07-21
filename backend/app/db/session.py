from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from typing import Generator
import os

# Create SQLAlchemy engine for PostgreSQL (default)
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Enable connection health checks
    echo=settings.DEBUG  # Log SQL queries in debug mode
)

# Create local SQLite engine for fallbacks (studies, paper_entities, entities)
sqlite_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "brahma.db")
sqlite_engine = create_engine(
    f"sqlite:///{sqlite_db_path}",
    connect_args={"check_same_thread": False}
)

# Auto-create tables in SQLite to ensure schema compliance for local fallbacks
from app.db.base import Base
import app.models.study
import app.models.paper_entity
import app.models.entity
Base.metadata.create_all(bind=sqlite_engine)

# Configure Multiple Binds
# - Study, PaperEntity, and Entity are routed to the local SQLite database
# - All other queries (including Paper search) default to the remote PostgreSQL database
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    binds={
        app.models.study.Study: sqlite_engine,
        app.models.paper_entity.PaperEntity: sqlite_engine,
        app.models.entity.Entity: sqlite_engine,
    }
)

# Dependency to get DB session
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()