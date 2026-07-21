"""
app/routers/library.py
Owner: Aakriti — KRITA Library & Collections (Task 5)

DB pattern: matches papers.py — asyncpg.connect() per request, no shared pool.

Schema:
- collections:       id=INTEGER, user_id=UUID, name=VARCHAR, description=TEXT, is_public=BOOL
- library_papers:    id=UUID, user_id=UUID, paper_id=UUID, authors=JSONB, paper_metadata=JSONB
- collection_papers: collection_id=INTEGER, paper_id=UUID (→ library_papers.id)
- export_log:        id=SERIAL, user_id=UUID, collection_id=INTEGER, format=TEXT
"""

import asyncpg
import difflib
import json
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

router = APIRouter(prefix="/library", tags=["Library"])


async def get_db_connection() -> asyncpg.Connection:
    return await asyncpg.connect(DATABASE_URL, statement_cache_size=0)


# ─── Pydantic Models ─────────────────────────────────────────────────────────

class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

class PaperSave(BaseModel):
    paper_id: str        # UUID of the paper in papers table
    title: str
    authors: list = []
    abstract: Optional[str] = None
    source: Optional[str] = None
    metadata: dict = {}

class AnnotationUpdate(BaseModel):
    annotations: str

class AddPaperToCollection(BaseModel):
    library_paper_id: str   # UUID of library_papers.id

class CollectionRagRequest(BaseModel):
    user_id: str
    query: str
    chat_session_id: Optional[str] = None


# ─── Collections CRUD ─────────────────────────────────────────────────────────

@router.post("/collections")
async def create_collection(body: CollectionCreate, user_id: str = Query(...)):
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO collections (user_id, name, description, is_public)
            VALUES ($1::uuid, $2, $3, $4)
            RETURNING id, user_id::text, name, description, is_public, created_at, updated_at
            """,
            user_id, body.name, body.description, body.is_public
        )
        return dict(row)
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await conn.close()


@router.get("/collections")
async def list_collections(user_id: str = Query(...)):
    """List all collections for a user with paper count."""
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """
            SELECT c.id, c.user_id::text, c.name, c.description, c.is_public, c.created_at, c.updated_at,
                   COUNT(cp.paper_id) AS paper_count
            FROM collections c
            LEFT JOIN collection_papers cp ON cp.collection_id = c.id
            WHERE c.user_id = $1::uuid
            GROUP BY c.id, c.user_id, c.name, c.description, c.is_public, c.created_at, c.updated_at
            ORDER BY c.created_at DESC
            """,
            user_id
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


@router.get("/collections/{collection_id}")
async def get_collection(collection_id: int, user_id: str = Query(...)):
    """Get a single collection with paper count."""
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """
            SELECT c.id, c.user_id::text, c.name, c.description, c.is_public, c.created_at, c.updated_at,
                   COUNT(cp.paper_id) AS paper_count
            FROM collections c
            LEFT JOIN collection_papers cp ON cp.collection_id = c.id
            WHERE c.id = $1 AND c.user_id = $2::uuid
            GROUP BY c.id, c.user_id, c.name, c.description, c.is_public, c.created_at, c.updated_at
            """,
            collection_id, user_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Collection not found")
        return dict(row)
    finally:
        await conn.close()


@router.patch("/collections/{collection_id}")
async def update_collection(collection_id: int, body: CollectionUpdate, user_id: str = Query(...)):
    """Update a collection's name, description, or public status."""
    conn = await get_db_connection()
    try:
        existing = await conn.fetchrow(
            "SELECT * FROM collections WHERE id=$1 AND user_id=$2::uuid",
            collection_id, user_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Collection not found")

        new_name = body.name        if body.name        is not None else existing["name"]
        new_desc = body.description if body.description is not None else existing["description"]
        new_pub  = body.is_public   if body.is_public   is not None else existing["is_public"]

        row = await conn.fetchrow(
            """
            UPDATE collections
            SET name=$1, description=$2, is_public=$3, updated_at=NOW()
            WHERE id=$4 AND user_id=$5::uuid
            RETURNING id, user_id::text, name, description, is_public, created_at, updated_at
            """,
            new_name, new_desc, new_pub, collection_id, user_id
        )
        return dict(row)
    finally:
        await conn.close()


@router.delete("/collections/{collection_id}")
async def delete_collection(collection_id: int, user_id: str = Query(...)):
    """Delete a collection and its membership associations."""
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "DELETE FROM collections WHERE id=$1 AND user_id=$2::uuid",
            collection_id, user_id
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Collection not found")
        return {"deleted": True, "collection_id": collection_id}
    finally:
        await conn.close()


# ─── Library Papers ───────────────────────────────────────────────────────────

@router.post("/papers")
async def save_paper(body: PaperSave, user_id: str = Query(...)):
    """Save a paper to the user's library."""
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO library_papers
              (user_id, paper_id, title, authors, abstract, source, paper_metadata)
            VALUES
              ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7::jsonb)
            RETURNING id, user_id::text, paper_id, title, authors, abstract, source, paper_metadata, annotations, saved_at
            """,
            user_id,
            body.paper_id,
            body.title,
            json.dumps(body.authors),
            body.abstract,
            body.source,
            json.dumps(body.metadata),
        )
        return dict(row)
    except asyncpg.PostgresError as e:
        if "uq_user_paper" in str(e) or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Paper already saved to library")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await conn.close()


@router.get("/papers/duplicates")
async def find_duplicates(user_id: str = Query(...)):
    """Find potential duplicate papers in the user's library based on title similarity."""
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            "SELECT id, title FROM library_papers WHERE user_id=$1::uuid",
            user_id
        )
        papers = [{"id": str(r["id"]), "title": r["title"]} for r in rows]
        pairs = []
        for i in range(len(papers)):
            for j in range(i + 1, len(papers)):
                score = difflib.SequenceMatcher(
                    None,
                    papers[i]["title"].lower(),
                    papers[j]["title"].lower()
                ).ratio()
                if score >= 0.85:
                    pairs.append({
                        "paper_a": papers[i],
                        "paper_b": papers[j],
                        "similarity_score": round(score, 3)
                    })
        return {"duplicate_pairs": pairs, "total_pairs": len(pairs)}
    finally:
        await conn.close()


@router.get("/papers")
async def list_papers(
    user_id: str = Query(...),
    query: Optional[str] = None,
    author: Optional[str] = None,
    source: Optional[str] = None,
):
    """List all papers in the user's library with optional filters."""
    conn = await get_db_connection()
    try:
        sql = "SELECT * FROM library_papers WHERE user_id = $1::uuid"
        args: list = [user_id]

        if query:
            args.append(f"%{query}%")
            sql += f" AND (title ILIKE ${len(args)} OR abstract ILIKE ${len(args)})"
        if source:
            args.append(source)
            sql += f" AND source = ${len(args)}"
        if author:
            args.append(f"%{author}%")
            sql += f" AND authors::text ILIKE ${len(args)}"

        sql += " ORDER BY saved_at DESC"
        rows = await conn.fetch(sql, *args)

        result = []
        for r in rows:
            d = dict(r)
            if isinstance(d.get("authors"), str):
                try:
                    d["authors"] = json.loads(d["authors"])
                except Exception:
                    pass
            result.append(d)
        return result
    finally:
        await conn.close()


@router.delete("/papers/{library_paper_id}")
async def remove_paper(library_paper_id: str, user_id: str = Query(...)):
    """Remove a paper from the user's library."""
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "DELETE FROM library_papers WHERE id=$1::uuid AND user_id=$2::uuid",
            library_paper_id, user_id
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Paper not found")
        return {"deleted": True, "library_paper_id": library_paper_id}
    finally:
        await conn.close()


@router.patch("/papers/{library_paper_id}/annotations")
async def update_annotations(
    library_paper_id: str,
    body: AnnotationUpdate,
    user_id: str = Query(...)
):
    """Update annotations for a paper in the user's library."""
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """
            UPDATE library_papers SET annotations=$1
            WHERE id=$2::uuid AND user_id=$3::uuid
            RETURNING id, user_id::text, paper_id, title, authors, abstract, source, paper_metadata, annotations, saved_at
            """,
            body.annotations, library_paper_id, user_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Paper not found")
        return dict(row)
    finally:
        await conn.close()


@router.get("/papers/{library_paper_id}/snowball")
async def snowball(library_paper_id: str):
    """Coming soon: Citation snowballing."""
    return {
        "status": "coming_soon",
        "paper_id": library_paper_id,
        "message": "Citation snowballing will be available once Namrata's ingestion pipeline is connected."
    }


# ─── Collection Membership ────────────────────────────────────────────────────

@router.post("/collections/{collection_id}/papers")
async def add_paper_to_collection(
    collection_id: int,
    body: AddPaperToCollection,
    user_id: str = Query(...)
):
    """Add a library paper to a collection."""
    conn = await get_db_connection()
    try:
        paper = await conn.fetchrow(
            "SELECT id FROM library_papers WHERE id=$1::uuid AND user_id=$2::uuid",
            body.library_paper_id, user_id
        )
        if not paper:
            raise HTTPException(
                status_code=404,
                detail="Paper not in your library. Save it first via POST /library/papers"
            )
        row = await conn.fetchrow(
            """
            INSERT INTO collection_papers (collection_id, paper_id)
            VALUES ($1, $2::uuid)
            RETURNING collection_id, paper_id
            """,
            collection_id, body.library_paper_id
        )
        return dict(row)
    except HTTPException:
        raise
    except asyncpg.PostgresError as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Paper already in this collection")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await conn.close()


@router.delete("/collections/{collection_id}/papers/{library_paper_id}")
async def remove_paper_from_collection(
    collection_id: int,
    library_paper_id: str,
    user_id: str = Query(...)
):
    """Remove a paper from a collection."""
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "DELETE FROM collection_papers WHERE collection_id=$1 AND paper_id=$2::uuid",
            collection_id, library_paper_id
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Paper not in collection")
        return {"removed": True}
    finally:
        await conn.close()


@router.get("/collections/{collection_id}/papers")
async def list_collection_papers(collection_id: int, user_id: str = Query(...)):
    """List all papers in a collection."""
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """
            SELECT lp.*
            FROM library_papers lp
            JOIN collection_papers cp ON cp.paper_id = lp.id
            WHERE cp.collection_id = $1 AND lp.user_id = $2::uuid
            ORDER BY lp.saved_at DESC
            """,
            collection_id, user_id
        )
        result = []
        for r in rows:
            d = dict(r)
            if isinstance(d.get("authors"), str):
                try:
                    d["authors"] = json.loads(d["authors"])
                except Exception:
                    pass
            result.append(d)
        return result
    finally:
        await conn.close()


# ─── Bibliographic Export ─────────────────────────────────────────────────────

def _authors_list(authors_field) -> list:
    """Convert authors field to a list of strings."""
    if isinstance(authors_field, list):
        return authors_field
    if isinstance(authors_field, str):
        try:
            return json.loads(authors_field)
        except Exception:
            return [authors_field]
    return []


def _to_bibtex(papers: list) -> str:
    """Convert papers to BibTeX format."""
    lines = []
    for p in papers:
        meta = p.get("paper_metadata") or {}
        if isinstance(meta, str):
            try: meta = json.loads(meta)
            except Exception: meta = {}
        authors = _authors_list(p.get("authors", []))
        year    = meta.get("year", p.get("published_date", "n.d."))
        journal = meta.get("journal", p.get("journal", ""))
        doi     = meta.get("doi", p.get("doi", ""))
        first   = authors[0].split()[-1].lower() if authors else "unknown"
        key     = f"{first}{year}{p['title'].split()[0].lower()}"
        lines.append(f"@article{{{key},")
        lines.append(f'  title={{{p["title"]}}},')
        lines.append(f'  author={{{" and ".join(authors)}}},')
        if journal: lines.append(f'  journal={{{journal}}},')
        lines.append(f'  year={{{year}}},')
        if doi: lines.append(f'  doi={{{doi}}}')
        lines.append("}\n")
    return "\n".join(lines)


def _to_apa(papers: list) -> str:
    """Convert papers to APA format."""
    entries = []
    for p in papers:
        meta = p.get("paper_metadata") or {}
        if isinstance(meta, str):
            try: meta = json.loads(meta)
            except Exception: meta = {}
        authors = _authors_list(p.get("authors", []))
        year    = meta.get("year", p.get("published_date", "n.d."))
        journal = meta.get("journal", p.get("journal", ""))
        doi     = meta.get("doi", p.get("doi", ""))
        line = f"{', '.join(authors) or 'Unknown'} ({year}). {p['title']}."
        if journal: line += f" {journal}."
        if doi:     line += f" https://doi.org/{doi}"
        entries.append(line)
    return "\n\n".join(entries)


def _to_ris(papers: list) -> str:
    """Convert papers to RIS format."""
    lines = []
    for p in papers:
        meta = p.get("paper_metadata") or {}
        if isinstance(meta, str):
            try: meta = json.loads(meta)
            except Exception: meta = {}
        authors = _authors_list(p.get("authors", []))
        year    = meta.get("year", p.get("published_date", ""))
        journal = meta.get("journal", p.get("journal", ""))
        doi     = meta.get("doi", p.get("doi", ""))
        lines.append("TY  - JOUR")
        lines.append(f"TI  - {p['title']}")
        for a in authors: lines.append(f"AU  - {a}")
        if year:    lines.append(f"PY  - {year}")
        if journal: lines.append(f"JO  - {journal}")
        if doi:     lines.append(f"DO  - {doi}")
        lines.append("ER  -\n")
    return "\n".join(lines)


@router.get("/collections/{collection_id}/export", response_class=PlainTextResponse)
async def export_collection(
    collection_id: int,
    user_id: str = Query(...),
    format: str = Query("bibtex")
):
    """Export collection citations in BibTeX, RIS, or APA format."""
    if format not in ("bibtex", "ris", "apa"):
        raise HTTPException(status_code=400, detail="format must be bibtex, ris, or apa")

    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """
            SELECT lp.title, lp.authors, lp.paper_metadata,
                   p.journal, p.doi, p.published_date
            FROM library_papers lp
            JOIN collection_papers cp ON cp.paper_id = lp.id
            LEFT JOIN papers p ON p.id = lp.paper_id
            WHERE cp.collection_id = $1 AND lp.user_id = $2::uuid
            """,
            collection_id, user_id
        )
        if not rows:
            raise HTTPException(status_code=404, detail="No papers in this collection")

        papers = [dict(r) for r in rows]
        await conn.execute(
            "INSERT INTO export_log (user_id, collection_id, format) VALUES ($1::uuid, $2, $3)",
            user_id, collection_id, format
        )

        if format == "bibtex": return _to_bibtex(papers)
        if format == "apa":    return _to_apa(papers)
        return _to_ris(papers)
    finally:
        await conn.close()


# ─── Collection-Scoped RAG ────────────────────────────────────────────────────

@router.post("/collections/{collection_id}/rag")
async def collection_rag(collection_id: int, body: CollectionRagRequest):
    """RAG query scoped to a specific collection."""
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """
            SELECT lp.paper_id::text
            FROM library_papers lp
            JOIN collection_papers cp ON cp.paper_id = lp.id
            WHERE cp.collection_id = $1 AND lp.user_id = $2::uuid
            """,
            collection_id, body.user_id
        )
        paper_ids = [r["paper_id"] for r in rows]
        if not paper_ids:
            raise HTTPException(status_code=404, detail="No papers in this collection")
    finally:
        await conn.close()

    try:
        from app.services.rag_service import run_rag_query
        result = await run_rag_query(
            query=body.query,
            user_id=body.user_id,
            chat_session_id=body.chat_session_id,
            paper_ids_filter=paper_ids
        )
    except (ImportError, AttributeError):
        result = {
            "answer": "Collection-scoped RAG not yet wired. Add run_rag_query to rag_service.py.",
            "citations": [],
            "chat_session_id": body.chat_session_id,
        }

    result["collection_id"] = collection_id
    result["scoped"] = True
    return result