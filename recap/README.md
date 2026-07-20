# Krita Backend

FastAPI-based service providing:

- REST API for paper management, search, and RAG
- Authentication (JWT-based)
- Document ingestion pipeline (PDF processing, chunking, embedding)
- Integration with PostgreSQL (vector storage) and Neo4j (knowledge graph)
- Background tasks for external data fetching (PubMed, arXiv, scrapers)

## Setup

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Ensure PostgreSQL is running with the `pgvector` extension enabled.
   The `database.py` module will automatically create the extension on startup.

3. Set environment variables in `.env` (see `.env.example` or the existing `.env`):
   - `DATABASE_URL`: PostgreSQL connection string (asyncpg)
   - Optional: Neo4j, Redis, Ollama settings

4. Initialize the database:
   ```bash
   python -c "from app.database import create_tables; import asyncio; asyncio.run(create_tables())"
   ```
   (Or simply start the server; startup event handles it.)

5. Run the development server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Key Modules

- `app/api`: REST routers (`auth`, `rag`, `search`, `upload`, `ingestion`)
- `app/services`: Business logic (`embedding_service`, `rag_service`)
- `app/models`: SQLAlchemy ORM models
- `app/database`: Async engine and session management
- `ingestion/*`: External fetchers (PubMed, arXiv, Grobid, custom scrapers)
- `scripts/*`: Utility scripts for data seeding and migrations

## Testing

Run the test suite with pytest:
```bash
pytest
```

## Docker

The backend is containerized via `dockerized in `infra/docker-compose.yml`.
To build and run:
```bash
cd ../infra
docker compose up --build
```
