import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from .models import Base

load_dotenv()

# Get database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{os.getenv('POSTGRES_USER', 'postgres')}:{os.getenv('POSTGRES_PASSWORD', 'postgres')}@{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'krita_db')}"
)

# Create synchronous engine for auth (your auth uses sync)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create async engine for other operations
async_engine = create_async_engine(DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"), echo=False)
AsyncSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=async_engine, class_=AsyncSession
)

# Sync database session (for auth)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Async database session (for other operations)
async def get_async_db():
    async with AsyncSessionLocal() as session:
        yield session

# Create tables - DISABLED because tables already exist
# The tables are already created in the database
# This function is kept as a no-op to prevent errors
def create_tables():
    """Skip table creation - tables already exist in the database."""
    print("ℹ️ Tables already exist in database. Skipping creation.")
    # The tables are already created - do nothing
    # If you need to create missing tables, uncomment this:
    # Base.metadata.create_all(bind=engine, checkfirst=True)

# Ensure extensions exist
def ensure_extensions():
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

# Alias for backward compatibility (singular form)
ensure_extension = ensure_extensions

# Async version of create tables (disabled)
async def create_tables_async():
    """Skip async table creation - tables already exist."""
    print("ℹ️ Tables already exist in database. Skipping async creation.")
    # async with async_engine.begin() as conn:
    #     await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    #     await conn.run_sync(Base.metadata.create_all)
