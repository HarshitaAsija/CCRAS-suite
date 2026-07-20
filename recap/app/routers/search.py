from fastapi import APIRouter, HTTPException, Query, Body, Request
import asyncpg
import os
import json
import asyncio
import time
from dotenv import load_dotenv
from typing import Optional, List, Any, Dict
from sentence_transformers import SentenceTransformer

load_dotenv()

router = APIRouter()

DATABASE_URL = os.getenv("DATABASE_URL")

# Load embedding model once at module level for reuse across requests
_embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# NOTE: asyncpg.connect() / register_vector() are no longer called here.
# The pool is created once at app startup (see main app file) with an
# `init` callback that registers pgvector on every pooled connection,
# so routes below just do `async with request.app.state.pool.acquire() as conn:`.


async def _log_search(
    pool: asyncpg.Pool,
    query: str,
    search_type: str,
    filters: dict,
    result_count: int,
    response_time_ms: int
):
    """Log search analytics to search_logs table."""
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO search_logs
                   (query, search_type, filters, result_count, response_time_ms)
                   VALUES ($1, $2, $3, $4, $5)""",
                query, search_type, json.dumps(filters),
                result_count, response_time_ms
            )
    except Exception:
        pass  # never let logging break search


@router.get("/papers/search")
async def search_papers(
    request: Request,
    q: Optional[str] = Query(None, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    journal: Optional[str] = Query(None, description="Filter by journal name"),
    language: Optional[str] = Query(None, description="Filter by language"),
    date_from: Optional[str] = Query(None, description="Filter published_date >= date_from (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter published_date <= date_to (YYYY-MM-DD)"),
    author: Optional[str] = Query(None, description="Filter authors by name (partial match)"),
) -> dict[str, Any]:
    """
    Search papers using BM25 full-text search on title and abstract.
    Uses PostgreSQL tsvector/tsquery with tf-idf ranking.
    """
    _start_time = time.time()

    if not q or not q.strip():
        raise HTTPException(
            status_code=400,
            detail="Query parameter 'q' is required and cannot be empty"
        )

    query_text = q.strip()
    pool = request.app.state.pool

    try:
        async with pool.acquire() as conn:
            query_sql = """
                SELECT
                    id,
                    title,
                    abstract,
                    authors,
                    journal,
                    doi,
                    published_date,
                    keywords,
                    ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank_score
                FROM papers
                WHERE search_vector @@ plainto_tsquery('english', $1)
            """

            params: List[Any] = [query_text]
            conditions = []
            param_idx = 2

            if journal:
                conditions.append(f"journal = ${param_idx}")
                params.append(journal)
                param_idx += 1

            if language:
                conditions.append(f"language = ${param_idx}")
                params.append(language)
                param_idx += 1

            if date_from:
                conditions.append(f"published_date >= ${param_idx}")
                params.append(date_from)
                param_idx += 1

            if date_to:
                conditions.append(f"published_date <= ${param_idx}")
                params.append(date_to)
                param_idx += 1

            if author:
                conditions.append(f"authors::text ILIKE ${param_idx}")
                params.append(f"%{author}%")
                param_idx += 1

            if conditions:
                query_sql += " AND " + " AND ".join(conditions)

            query_sql += f" ORDER BY rank_score DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
            params.append(limit)
            params.append(offset)

            rows = await conn.fetch(query_sql, *params)

            # Count query — fixed version: conditions and params built together
            count_sql = """
                SELECT COUNT(*) as total
                FROM papers
                WHERE search_vector @@ plainto_tsquery('english', $1)
            """
            count_params: List[Any] = [query_text]
            count_conditions = []
            count_param_idx = 2

            if journal:
                count_conditions.append(f"journal = ${count_param_idx}")
                count_params.append(journal)
                count_param_idx += 1

            if language:
                count_conditions.append(f"language = ${count_param_idx}")
                count_params.append(language)
                count_param_idx += 1

            if date_from:
                count_conditions.append(f"published_date >= ${count_param_idx}")
                count_params.append(date_from)
                count_param_idx += 1

            if date_to:
                count_conditions.append(f"published_date <= ${count_param_idx}")
                count_params.append(date_to)
                count_param_idx += 1

            if author:
                count_conditions.append(f"authors::text ILIKE ${count_param_idx}")
                count_params.append(f"%{author}%")
                count_param_idx += 1

            if count_conditions:
                count_sql += " AND " + " AND ".join(count_conditions)

            total_result = await conn.fetchval(count_sql, *count_params)

        results = [
            {
                "id": str(row["id"]),
                "title": row["title"],
                "abstract": row["abstract"],
                "authors": row["authors"],
                "journal": row["journal"],
                "doi": row["doi"],
                "published_date": row["published_date"],
                "keywords": row["keywords"],
                "rank_score": float(row["rank_score"]),
            }
            for row in rows
        ]

        _ms = int((time.time() - _start_time) * 1000)
        asyncio.create_task(_log_search(
            pool,
            query_text,
            'bm25',
            {"journal": journal, "language": language, "date_from": date_from, "date_to": date_to, "author": author},
            len(results),
            _ms
        ))

        return {
            "total": total_result,
            "results": results,
        }

    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/papers/search/semantic")
async def search_papers_semantic(
    request: Request,
    q: Optional[str] = Query(None, description="Search query for semantic search"),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    journal: Optional[str] = Query(None, description="Filter by journal name (case-insensitive partial match)"),
    language: Optional[str] = Query(None, description="Filter by language"),
    date_from: Optional[str] = Query(None, description="Filter published_date >= date_from (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter published_date <= date_to (YYYY-MM-DD)"),
    author: Optional[str] = Query(None, description="Filter authors by name (partial match)"),
) -> dict[str, Any]:
    """
    Search papers using semantic similarity on paper chunk embeddings.
    Uses pgvector HNSW index with cosine distance (<=>) for fast approximate nearest neighbor search.
    """
    _start_time = time.time()

    if not q or not q.strip():
        raise HTTPException(
            status_code=400,
            detail="Query parameter 'q' is required and cannot be empty"
        )

    query_text = q.strip()
    pool = request.app.state.pool

    try:
        query_embedding = await asyncio.to_thread(_embedding_model.encode, query_text, convert_to_numpy=True)
        embedding_list = query_embedding.tolist()

        subquery_conditions = []
        params: List[Any] = [embedding_list]
        param_idx = 2

        if journal:
            subquery_conditions.append(f"p.journal ILIKE ${param_idx}")
            params.append(f"%{journal}%")
            param_idx += 1

        if language:
            subquery_conditions.append(f"p.language = ${param_idx}")
            params.append(language)
            param_idx += 1

        if date_from:
            subquery_conditions.append(f"p.published_date >= ${param_idx}")
            params.append(date_from)
            param_idx += 1

        if date_to:
            subquery_conditions.append(f"p.published_date <= ${param_idx}")
            params.append(date_to)
            param_idx += 1

        if author:
            subquery_conditions.append(f"p.authors::text ILIKE ${param_idx}")
            params.append(f"%{author}%")
            param_idx += 1

        where_clause = ""
        if subquery_conditions:
            where_clause = " AND " + " AND ".join(subquery_conditions)

        sql = f"""
            SELECT
                id, title, abstract, authors, journal, doi, published_date,
                keywords, source, chunk_text, chunk_index, similarity_score
            FROM (
                SELECT DISTINCT ON (p.id)
                    p.id, p.title, p.abstract, p.authors, p.journal, p.doi,
                    p.published_date, p.keywords, p.source,
                    pc.chunk_text, pc.chunk_index,
                    1 - (pc.embedding <=> $1::vector) AS similarity_score
                FROM paper_chunks pc
                JOIN papers p ON pc.paper_id = p.id
                WHERE TRUE{where_clause}
                ORDER BY p.id, pc.embedding <=> $1::vector
            ) AS deduplicated
            ORDER BY similarity_score DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params.append(limit)
        params.append(offset)

        count_conditions = []
        count_params: List[Any] = []
        count_param_idx = 1

        if journal:
            count_conditions.append(f"p.journal ILIKE ${count_param_idx}")
            count_params.append(f"%{journal}%")
            count_param_idx += 1

        if language:
            count_conditions.append(f"p.language = ${count_param_idx}")
            count_params.append(language)
            count_param_idx += 1

        if date_from:
            count_conditions.append(f"p.published_date >= ${count_param_idx}")
            count_params.append(date_from)
            count_param_idx += 1

        if date_to:
            count_conditions.append(f"p.published_date <= ${count_param_idx}")
            count_params.append(date_to)
            count_param_idx += 1

        if author:
            count_conditions.append(f"p.authors::text ILIKE ${count_param_idx}")
            count_params.append(f"%{author}%")
            count_param_idx += 1

        count_where_clause = ""
        if count_conditions:
            count_where_clause = " AND " + " AND ".join(count_conditions)

        count_sql = f"""
            SELECT COUNT(DISTINCT p.id) AS total
            FROM paper_chunks pc
            JOIN papers p ON pc.paper_id = p.id
            WHERE TRUE{count_where_clause}
        """

        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)
            total_result = await conn.fetchval(count_sql, *count_params)

        results = [
            {
                "id": str(row["id"]),
                "title": row["title"] or "",
                "abstract": row["abstract"] or "",
                "authors": row["authors"],
                "journal": row["journal"],
                "doi": row["doi"] or "",
                "published_date": row["published_date"],
                "keywords": row["keywords"],
                "source": row["source"] or "",
                "similarity_score": round(float(row["similarity_score"]), 4),
                "matched_chunk_preview": row["chunk_text"][:200] if row["chunk_text"] else ""
            }
            for row in rows
        ]

        _ms = int((time.time() - _start_time) * 1000)
        asyncio.create_task(_log_search(
            pool,
            query_text,
            'semantic',
            {"journal": journal, "language": language, "date_from": date_from, "date_to": date_to, "author": author},
            len(results),
            _ms
        ))

        return {"total": total_result or 0, "results": results}

    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/papers/similar/{doi:path}")
async def get_similar_papers(
    request: Request,
    doi: str,
    limit: int = Query(10, ge=1, le=50, description="Max results to return"),
    journal: Optional[str] = Query(None, description="Filter by journal name (case-insensitive partial match)"),
    language: Optional[str] = Query(None, description="Filter by language"),
    date_from: Optional[str] = Query(None, description="Filter published_date >= date_from (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter published_date <= date_to (YYYY-MM-DD)"),
    author: Optional[str] = Query(None, description="Filter authors by name (partial match)"),
) -> dict[str, Any]:
    """
    Find papers semantically similar to a given paper (by DOI),
    using that paper's own average chunk embedding as the query vector.
    """
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            seed_paper = await conn.fetchrow(
                "SELECT id, title FROM papers WHERE doi = $1", doi
            )
            if not seed_paper:
                raise HTTPException(status_code=404, detail=f"Paper with DOI '{doi}' not found")

            seed_id = seed_paper["id"]
            seed_title = seed_paper["title"]

            avg_embedding_result = await conn.fetchval(
                "SELECT AVG(embedding) as avg_embedding FROM paper_chunks WHERE paper_id = $1",
                seed_id
            )
            if avg_embedding_result is None:
                raise HTTPException(status_code=404, detail="Paper has no embeddings yet")

            query_embedding = avg_embedding_result

            conditions = []
            params: List[Any] = [query_embedding, seed_id]
            param_idx = 3

            if journal:
                conditions.append(f"p.journal ILIKE ${param_idx}")
                params.append(f"%{journal}%")
                param_idx += 1

            if language:
                conditions.append(f"p.language = ${param_idx}")
                params.append(language)
                param_idx += 1

            if date_from:
                conditions.append(f"p.published_date >= ${param_idx}")
                params.append(date_from)
                param_idx += 1

            if date_to:
                conditions.append(f"p.published_date <= ${param_idx}")
                params.append(date_to)
                param_idx += 1

            if author:
                conditions.append(f"p.authors::text ILIKE ${param_idx}")
                params.append(f"%{author}%")
                param_idx += 1

            where_clause = ""
            if conditions:
                where_clause = " AND " + " AND ".join(conditions)

            sql = f"""
                SELECT id, title, abstract, authors, journal, doi, published_date, keywords, source, similarity_score
                FROM (
                    SELECT DISTINCT ON (p.id)
                        p.id, p.title, p.abstract, p.authors, p.journal, p.doi,
                        p.published_date, p.keywords, p.source,
                        1 - (pc.embedding <=> $1::vector) AS similarity_score
                    FROM paper_chunks pc
                    JOIN papers p ON pc.paper_id = p.id
                    WHERE p.id != $2{where_clause}
                    ORDER BY p.id, pc.embedding <=> $1::vector
                ) AS deduplicated
                ORDER BY similarity_score DESC
                LIMIT ${param_idx}
            """
            params.append(limit)

            rows = await conn.fetch(sql, *params)

        results = [
            {
                "id": str(row["id"]),
                "title": row["title"] or "",
                "abstract": row["abstract"] or "",
                "authors": row["authors"],
                "journal": row["journal"],
                "doi": row["doi"] or "",
                "published_date": row["published_date"],
                "keywords": row["keywords"],
                "source": row["source"] or "",
                "similarity_score": round(float(row["similarity_score"]), 4),
            }
            for row in rows
        ]

        return {
            "seed_paper": {"id": str(seed_id), "title": seed_title or "", "doi": doi},
            "total": len(results),
            "results": results,
        }

    except HTTPException:
        raise
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/papers/search/hybrid")
async def search_papers_hybrid(
    request: Request,
    q: Optional[str] = Query(None, description="Search query for hybrid search"),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    journal: Optional[str] = Query(None, description="Filter by journal name (case-insensitive partial match)"),
    language: Optional[str] = Query(None, description="Filter by language"),
    date_from: Optional[str] = Query(None, description="Filter published_date >= date_from (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter published_date <= date_to (YYYY-MM-DD)"),
    author: Optional[str] = Query(None, description="Filter authors by name (partial match)"),
) -> dict[str, Any]:
    """
    Search papers using Reciprocal Rank Fusion (RRF) to combine BM25 and vector search results.
    RRF score = 1/(k + bm25_rank) + 1/(k + vector_rank), where k=60.
    """
    _start_time = time.time()

    if not q or not q.strip():
        raise HTTPException(
            status_code=400,
            detail="Query parameter 'q' is required and cannot be empty"
        )

    query_text = q.strip()
    pool = request.app.state.pool

    try:
        query_embedding = await asyncio.to_thread(_embedding_model.encode, query_text, convert_to_numpy=True)
        embedding_list = query_embedding.tolist()

        # ---- BM25 candidate list ----
        bm25_conditions = []
        bm25_params: List[Any] = [query_text]
        bm25_param_idx = 2

        if journal:
            bm25_conditions.append(f"journal ILIKE ${bm25_param_idx}")
            bm25_params.append(f"%{journal}%")
            bm25_param_idx += 1
        if language:
            bm25_conditions.append(f"language = ${bm25_param_idx}")
            bm25_params.append(language)
            bm25_param_idx += 1
        if date_from:
            bm25_conditions.append(f"published_date >= ${bm25_param_idx}")
            bm25_params.append(date_from)
            bm25_param_idx += 1
        if date_to:
            bm25_conditions.append(f"published_date <= ${bm25_param_idx}")
            bm25_params.append(date_to)
            bm25_param_idx += 1
        if author:
            bm25_conditions.append(f"authors::text ILIKE ${bm25_param_idx}")
            bm25_params.append(f"%{author}%")
            bm25_param_idx += 1

        bm25_where = " AND " + " AND ".join(bm25_conditions) if bm25_conditions else ""
        bm25_sql = f"""
            SELECT id
            FROM papers
            WHERE search_vector @@ plainto_tsquery('english', $1){bm25_where}
            ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
            LIMIT 60
        """

        # ---- Vector candidate list ----
        vector_conditions = []
        vector_params: List[Any] = [embedding_list]
        vector_param_idx = 2

        if journal:
            vector_conditions.append(f"p.journal ILIKE ${vector_param_idx}")
            vector_params.append(f"%{journal}%")
            vector_param_idx += 1
        if language:
            vector_conditions.append(f"p.language = ${vector_param_idx}")
            vector_params.append(language)
            vector_param_idx += 1
        if date_from:
            vector_conditions.append(f"p.published_date >= ${vector_param_idx}")
            vector_params.append(date_from)
            vector_param_idx += 1
        if date_to:
            vector_conditions.append(f"p.published_date <= ${vector_param_idx}")
            vector_params.append(date_to)
            vector_param_idx += 1
        if author:
            vector_conditions.append(f"p.authors::text ILIKE ${vector_param_idx}")
            vector_params.append(f"%{author}%")
            vector_param_idx += 1

        vector_where = " AND " + " AND ".join(vector_conditions) if vector_conditions else ""
        vector_sql = f"""
            SELECT id FROM (
                SELECT DISTINCT ON (p.id) p.id AS id, pc.embedding <=> $1::vector AS distance
                FROM paper_chunks pc
                JOIN papers p ON pc.paper_id = p.id
                WHERE TRUE{vector_where}
                ORDER BY p.id, pc.embedding <=> $1::vector
            ) AS deduplicated
            ORDER BY distance ASC
            LIMIT 60
        """

        # Two acquires running concurrently — the pool hands out two
        # separate physical connections, so this is safe (unlike the
        # old single-connection asyncio.gather pattern in /suggest).
        async with pool.acquire() as conn_a, pool.acquire() as conn_b:
            bm25_rows, vector_rows = await asyncio.gather(
                conn_a.fetch(bm25_sql, *bm25_params),
                conn_b.fetch(vector_sql, *vector_params),
            )

        bm25_ids = [str(row["id"]) for row in bm25_rows]
        bm25_rank_map = {pid: rank + 1 for rank, pid in enumerate(bm25_ids)}
        vector_ids = [str(row["id"]) for row in vector_rows]
        vector_rank_map = {pid: rank + 1 for rank, pid in enumerate(vector_ids)}

        k = 60
        all_paper_ids = set(bm25_ids) | set(vector_ids)
        bm25_len = len(bm25_ids)
        vector_len = len(vector_ids)

        rrf_scores = {}
        for pid in all_paper_ids:
            bm25_rank = bm25_rank_map.get(pid)
            vector_rank = vector_rank_map.get(pid)
            bm25_score_rank = bm25_rank if bm25_rank is not None else (k + 1)
            vector_score_rank = vector_rank if vector_rank is not None else (k + 1)
            rrf_score = 1 / (k + bm25_score_rank) + 1 / (k + vector_score_rank)
            rrf_scores[pid] = {
                "bm25_rank": bm25_rank,
                "vector_rank": vector_rank,
                "rrf_score": rrf_score
            }

        sorted_papers = sorted(all_paper_ids, key=lambda pid: rrf_scores[pid]["rrf_score"], reverse=True)
        total = len(sorted_papers)
        paginated_ids = sorted_papers[offset:offset + limit]

        if not paginated_ids:
            return {"total": 0, "results": []}

        detail_conditions = []
        detail_params: List[Any] = [paginated_ids]
        detail_param_idx = 2

        if journal:
            detail_conditions.append(f"journal ILIKE ${detail_param_idx}")
            detail_params.append(f"%{journal}%")
            detail_param_idx += 1
        if language:
            detail_conditions.append(f"language = ${detail_param_idx}")
            detail_params.append(language)
            detail_param_idx += 1
        if date_from:
            detail_conditions.append(f"published_date >= ${detail_param_idx}")
            detail_params.append(date_from)
            detail_param_idx += 1
        if date_to:
            detail_conditions.append(f"published_date <= ${detail_param_idx}")
            detail_params.append(date_to)
            detail_param_idx += 1
        if author:
            detail_conditions.append(f"authors::text ILIKE ${detail_param_idx}")
            detail_params.append(f"%{author}%")
            detail_param_idx += 1

        detail_where = " AND " + " AND ".join(detail_conditions) if detail_conditions else ""
        detail_sql = f"""
            SELECT id, title, abstract, authors, journal, doi, published_date, keywords, source
            FROM papers
            WHERE id = ANY($1::uuid[]){detail_where}
        """

        async with pool.acquire() as conn:
            detail_rows = await conn.fetch(detail_sql, *detail_params)

        rank_lookup = {pid: rrf_scores[pid] for pid in paginated_ids}
        results = [
            {
                "id": str(row["id"]),
                "title": row["title"] or "",
                "abstract": row["abstract"] or "",
                "authors": row["authors"],
                "journal": row["journal"],
                "doi": row["doi"] or "",
                "published_date": row["published_date"],
                "keywords": row["keywords"],
                "source": row["source"] or "",
                "rrf_score": round(rank_lookup[str(row["id"])]["rrf_score"], 4),
                "bm25_rank": rank_lookup[str(row["id"])]["bm25_rank"],
                "vector_rank": rank_lookup[str(row["id"])]["vector_rank"]
            }
            for row in detail_rows
        ]

        _ms = int((time.time() - _start_time) * 1000)
        asyncio.create_task(_log_search(
            pool,
            query_text,
            'hybrid',
            {"journal": journal, "language": language, "date_from": date_from, "date_to": date_to, "author": author},
            len(results),
            _ms
        ))

        return {"total": total, "results": results}

    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/papers/search/suggest")
async def search_suggestions(
    request: Request,
    q: Optional[str] = Query(None, description="Search query for suggestions"),
    limit: int = Query(5, ge=1, le=10, description="Max suggestions to return"),
) -> dict[str, Any]:
    """
    Search-as-you-type suggestions: returns matching papers and keywords,
    run concurrently on two separate pooled connections.
    """
    if not q or len(q.strip()) < 2:
        raise HTTPException(
            status_code=400,
            detail="Query parameter 'q' is required and must be at least 2 characters"
        )

    query_text = q.strip()
    pool = request.app.state.pool
    pattern = f"%{query_text}%"

    try:
        async def get_title_matches(conn):
            rows = await conn.fetch(
                """SELECT id, title, doi, journal
                   FROM papers
                   WHERE title ILIKE $1
                   ORDER BY title
                   LIMIT $2""",
                pattern, limit
            )
            return [
                {"type": "paper", "id": str(row["id"]), "title": row["title"],
                 "doi": row["doi"], "journal": row["journal"]}
                for row in rows
            ]

        async def get_keyword_matches(conn):
            rows = await conn.fetch(
                """SELECT DISTINCT kw as keyword
                   FROM papers,
                   jsonb_array_elements_text(
                       CASE WHEN jsonb_typeof(keywords) = 'string'
                            THEN (keywords #>> '{}')::jsonb
                            ELSE keywords
                       END
                   ) as kw
                   WHERE kw ILIKE $1
                   LIMIT $2""",
                pattern, limit
            )
            return [{"type": "keyword", "keyword": row["keyword"]} for row in rows]

        async with pool.acquire() as conn_a, pool.acquire() as conn_b:
            title_results, keyword_results = await asyncio.gather(
                get_title_matches(conn_a),
                get_keyword_matches(conn_b),
            )

        seen_keywords = set()
        unique_keywords = []
        for kw in keyword_results:
            kw_lower = kw["keyword"].lower()
            if kw_lower not in seen_keywords:
                seen_keywords.add(kw_lower)
                unique_keywords.append(kw)

        suggestions = title_results[:limit]
        remaining = limit - len(suggestions)
        if remaining > 0:
            suggestions.extend(unique_keywords[:remaining])

        return {"query": query_text, "suggestions": suggestions}

    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/search/analytics")
async def get_search_analytics(request: Request) -> dict[str, Any]:
    """Get search analytics for the last 7 days."""
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            type_counts = await conn.fetch(
                """SELECT search_type, COUNT(*) as count
                   FROM search_logs
                   WHERE created_at >= NOW() - INTERVAL '7 days'
                   GROUP BY search_type"""
            )
            by_type = {row["search_type"]: row["count"] for row in type_counts}
            total_searches = sum(by_type.values())

            top_queries_rows = await conn.fetch(
                """SELECT query, COUNT(*) as count
                   FROM search_logs
                   WHERE created_at >= NOW() - INTERVAL '7 days'
                   GROUP BY query
                   ORDER BY count DESC
                   LIMIT 10"""
            )
            top_queries = [{"query": row["query"], "count": row["count"]} for row in top_queries_rows]

            avg_result = await conn.fetchval(
                """SELECT AVG(response_time_ms) as avg_time
                   FROM search_logs
                   WHERE created_at >= NOW() - INTERVAL '7 days'"""
            )
            avg_response_time_ms = float(avg_result) if avg_result else 0.0

            daily_rows = await conn.fetch(
                """SELECT DATE(created_at) as date, COUNT(*) as count
                   FROM search_logs
                   WHERE created_at >= NOW() - INTERVAL '7 days'
                   GROUP BY DATE(created_at)
                   ORDER BY date"""
            )
            searches_per_day = [
                {"date": row["date"].strftime("%Y-%m-%d"), "count": row["count"]}
                for row in daily_rows
            ]

        return {
            "total_searches": total_searches,
            "by_type": by_type,
            "top_queries": top_queries,
            "avg_response_time_ms": avg_response_time_ms,
            "searches_per_day": searches_per_day
        }

    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/search/saved")
async def save_search(
    request: Request,
    user_id: str = Query(..., description="User ID"),
    name: str = Body(..., description="Name for the saved search"),
    query: str = Body(..., description="Search query"),
    search_type: str = Body("hybrid", description="Search type (bm25, semantic, hybrid, similar)"),
    filters: Optional[Dict[str, Any]] = Body(default_factory=dict, description="Search filters"),
    alert_enabled: bool = Body(False, description="Whether to enable alerts for this search"),
) -> dict[str, Any]:
    """Save a search for later retrieval."""
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """INSERT INTO saved_searches (user_id, name, query, search_type, filters, alert_enabled)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   RETURNING id, user_id, name, query, search_type, filters, alert_enabled, created_at""",
                user_id, name, query, search_type, json.dumps(filters), alert_enabled
            )

        return {
            "id": str(row["id"]),
            "user_id": str(row["user_id"]),
            "name": row["name"],
            "query": row["query"],
            "search_type": row["search_type"],
            "filters": json.loads(row["filters"]) if row["filters"] else {},
            "alert_enabled": row["alert_enabled"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None
        }

    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/search/saved")
async def get_saved_searches(
    request: Request,
    user_id: str = Query(..., description="User ID")
) -> dict[str, Any]:
    """Get all saved searches for a user."""
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, user_id, name, query, search_type, filters, alert_enabled, created_at, updated_at
                   FROM saved_searches
                   WHERE user_id = $1
                   ORDER BY created_at DESC""",
                user_id
            )

        searches = [
            {
                "id": str(row["id"]),
                "user_id": str(row["user_id"]),
                "name": row["name"],
                "query": row["query"],
                "search_type": row["search_type"],
                "filters": json.loads(row["filters"]) if row["filters"] else {},
                "alert_enabled": row["alert_enabled"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
            }
            for row in rows
        ]

        return {"searches": searches}

    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/search/saved/{search_id}")
async def delete_saved_search(
    request: Request,
    search_id: str,
    user_id: str = Query(..., description="User ID")
) -> dict[str, Any]:
    """Delete a saved search. User ID must match."""
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id FROM saved_searches WHERE id = $1 AND user_id = $2",
                search_id, user_id
            )

            if not row:
                raise HTTPException(status_code=404, detail="Saved search not found or user_id mismatch")

            await conn.execute("DELETE FROM saved_searches WHERE id = $1", search_id)

        return {"success": True, "deleted_id": search_id}

    except HTTPException:
        raise
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.patch("/search/saved/{search_id}/alert")
async def toggle_search_alert(
    request: Request,
    search_id: str,
    user_id: str = Query(..., description="User ID"),
    alert_enabled: bool = Body(..., embed=True, description="New alert_enabled value"),
) -> dict[str, Any]:
    """Toggle alert on/off for a saved search. Body: {"alert_enabled": true|false}"""
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """UPDATE saved_searches
                   SET alert_enabled = $1, updated_at = NOW()
                   WHERE id = $2 AND user_id = $3
                   RETURNING id, user_id, name, query, search_type, filters, alert_enabled, created_at, updated_at""",
                alert_enabled, search_id, user_id
            )

            if not row:
                raise HTTPException(status_code=404, detail="Saved search not found or user_id mismatch")

        return {
            "id": str(row["id"]),
            "user_id": str(row["user_id"]),
            "name": row["name"],
            "query": row["query"],
            "search_type": row["search_type"],
            "filters": json.loads(row["filters"]) if row["filters"] else {},
            "alert_enabled": row["alert_enabled"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
        }

    except HTTPException:
        raise
    except asyncpg.PostgresError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")