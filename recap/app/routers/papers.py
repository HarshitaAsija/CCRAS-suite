from fastapi import APIRouter, HTTPException, Query
import asyncpg
import json
import os
from dotenv import load_dotenv
from typing import Optional, List, Any
from urllib.parse import unquote

load_dotenv()

router = APIRouter()

DATABASE_URL = os.getenv("DATABASE_URL")


async def get_db_connection() -> asyncpg.Connection:
    """Get asyncpg database connection."""
    return await asyncpg.connect(DATABASE_URL, statement_cache_size=0)


@router.get("/papers")
async def list_papers(
    keyword: Optional[str] = Query(None, description="Filter by keyword (case-insensitive)"),
    journal: Optional[str] = Query(None, description="Filter by journal (case-insensitive partial match)"),
    date_from: Optional[str] = Query(None, description="Filter papers published on or after this date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter papers published on or before this date (YYYY-MM-DD)"),
    language: Optional[str] = Query(None, description="Filter by language"),
    sort_by: str = Query("published_date", description="Sort field: title, published_date, or word_count"),
    order: str = Query("desc", description="Sort order: asc or desc"),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
) -> dict[str, Any]:
    """
    List papers with optional filtering, sorting, and pagination.
    Returns total count, limit, offset, and papers array.
    """
    # Validate sort_by
    valid_sort_fields = {"title", "published_date", "word_count"}
    if sort_by not in valid_sort_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort_by value. Must be one of: {', '.join(valid_sort_fields)}"
        )

    # Validate order
    if order.lower() not in {"asc", "desc"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid order value. Must be 'asc' or 'desc'"
        )

    conn = None
    try:
        conn = await get_db_connection()

        # Build WHERE conditions
        conditions = []
        params: List[Any] = []
        param_idx = 1

        # Keyword filter (case-insensitive JSONB array contains)
        if keyword:
            conditions.append(f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(keywords) AS kw WHERE LOWER(kw) = ${param_idx})")
            params.append(keyword.lower())
            param_idx += 1

        # Journal filter (case-insensitive partial match)
        if journal:
            conditions.append(f"LOWER(journal) LIKE ${param_idx}")
            params.append(f"%{journal.lower()}%")
            param_idx += 1

        # Date range filters (string comparison on YYYY-MM-DD format)
        if date_from:
            conditions.append(f"published_date >= ${param_idx}")
            params.append(date_from)
            param_idx += 1

        if date_to:
            conditions.append(f"published_date <= ${param_idx}")
            params.append(date_to)
            param_idx += 1

        # Language filter
        if language:
            conditions.append(f"language = ${param_idx}")
            params.append(language)
            param_idx += 1

        # Build WHERE clause
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        # Build count query
        count_sql = f"""
            SELECT COUNT(*) as total
            FROM papers
            {where_clause}
        """

        # Execute count query
        total_result = await conn.fetchval(count_sql, *params)

        # Build main query with sorting and pagination
        order_direction = order.upper()
        query_sql = f"""
            SELECT
                id,
                title,
                abstract,
                authors,
                journal,
                doi,
                published_date,
                keywords,
                word_count
            FROM papers
            {where_clause}
            ORDER BY {sort_by} {order_direction}
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params.extend([limit, offset])

        # Execute main query
        rows = await conn.fetch(query_sql, *params)

        # Format results
        papers = [
            {
                "id": str(row["id"]),
                "title": row["title"],
                "abstract": row["abstract"],
                "authors": row["authors"],
                "journal": row["journal"],
                "doi": row["doi"],
                "published_date": row["published_date"],
                "keywords": row["keywords"],
                "word_count": row["word_count"],
            }
            for row in rows
        ]

        return {
            "total": total_result or 0,
            "limit": limit,
            "offset": offset,
            "papers": papers,
        }

    except asyncpg.PostgresError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    finally:
        if conn:
            await conn.close()


@router.get("/papers/{doi:path}")
async def get_paper_by_doi(doi: str) -> dict[str, Any]:
    """
    Get full paper details by DOI.
    DOI is URL-encoded, so we decode it before querying.
    Returns 404 if not found.
    """
    # URL-decode the DOI
    decoded_doi = unquote(doi)

    conn = None
    try:
        conn = await get_db_connection()

        # Fetch paper by DOI
        row = await conn.fetchrow(
            """
            SELECT
                id,
                title,
                abstract,
                authors,
                published_date,
                journal,
                doi,
                pmid,
                source,
                keywords,
                full_text,
                citations,
                paper_references,
                language,
                word_count,
                citation_count,
                status,
                created_at
            FROM papers
            WHERE doi = $1
            """,
            decoded_doi
        )

        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Paper with DOI '{decoded_doi}' not found"
            )

        return {
            "id": str(row["id"]),
            "title": row["title"],
            "abstract": row["abstract"],
            "authors": row["authors"],
            "published_date": row["published_date"],
            "journal": row["journal"],
            "doi": row["doi"],
            "source": row["source"],
            "keywords": row["keywords"],
            "full_text": row["full_text"],
            "citations": row["citations"],
            "paper_references": row["paper_references"],
            "language": row["language"],
            "word_count": row["word_count"],
            "pmid": row["pmid"],
            "citation_count": row["citation_count"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }

    except HTTPException:
        raise
    except asyncpg.PostgresError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    finally:
        if conn:
            await conn.close()


@router.post("/snowball/{doi:path}")
async def snowball(doi: str) -> dict[str, Any]:
    """
    Snowballing endpoint: given a seed paper DOI, return all papers in the database
    that are either cited by (backward) or cite (forward) the seed paper.

    Returns seed paper info, backward matches, forward matches, and counts.
    """
    # URL-decode the DOI
    decoded_doi = unquote(doi)

    conn = None
    try:
        conn = await get_db_connection()

        # 1. Look up the seed paper
        seed_row = await conn.fetchrow(
            """
            SELECT id, title, doi, paper_references, citations
            FROM papers
            WHERE doi = $1
            """,
            decoded_doi
        )

        if seed_row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Seed paper with DOI '{decoded_doi}' not found"
            )

        # 2. Extract DOI lists from seed paper (JSONB comes as string from asyncpg)
        raw_backward = seed_row["paper_references"]
        raw_forward = seed_row["citations"]

        # Handle empty strings and None values
        if isinstance(raw_backward, str) and raw_backward:
            backward_dois = json.loads(raw_backward)
        else:
            backward_dois = raw_backward or []

        if isinstance(raw_forward, str) and raw_forward:
            forward_dois = json.loads(raw_forward)
        else:
            forward_dois = raw_forward or []

        # Store totals before deduplication
        backward_total_refs = len(backward_dois) if backward_dois else 0
        forward_total_citations = len(forward_dois) if forward_dois else 0

        # Combine all DOIs to fetch (with source tracking)
        all_dois = list(set(backward_dois) | set(forward_dois))

        if not all_dois:
            # No references or citations in DB
            return {
                "seed_paper": {
                    "id": str(seed_row["id"]),
                    "title": seed_row["title"],
                    "doi": seed_row["doi"],
                },
                "backward": [],
                "forward": [],
                "backward_count": 0,
                "forward_count": 0,
                "backward_total_refs": 0,
                "forward_total_citations": 0,
                "forward_dois": [],
                "backward_dois": [],
            }

        # 3. Query papers table for all matching DOIs
        rows = await conn.fetch(
            """
            SELECT
                id,
                title,
                abstract,
                doi,
                journal,
                authors,
                published_date,
                source,
                keywords
            FROM papers
            WHERE LOWER(doi) = ANY(SELECT LOWER(unnest($1::text[])))
            """,
            all_dois
        )

        # 4. Build response, distinguishing backward vs forward
        backward_set = set(d.lower() for d in backward_dois) if backward_dois else set()
        forward_set = set(d.lower() for d in forward_dois) if forward_dois else set()

        backward_matches = []
        forward_matches = []

        for row in rows:
            paper_doi = row["doi"]
            paper_data = {
                "id": str(row["id"]),
                "title": row["title"],
                "abstract": row["abstract"],
                "doi": row["doi"],
                "journal": row["journal"],
                "authors": row["authors"],
                "published_date": row["published_date"],
                "source": row["source"],
                "keywords": row["keywords"],
            }

            # Clean up title if wrapped in curly braces like {"Some Title"} or if it's a list
            title = paper_data["title"]
            if isinstance(title, list) and len(title) > 0:
                paper_data["title"] = title[0]
            elif title and isinstance(title, str) and title.startswith('{"') and title.endswith('"}'):
                paper_data["title"] = title[2:-2]

            in_backward = paper_doi.lower() in backward_set
            in_forward = paper_doi.lower() in forward_set

            if in_backward and in_forward:
                # Appears in both - add to backward only (no duplicates)
                backward_matches.append(paper_data)
            elif in_backward:
                backward_matches.append(paper_data)
            elif in_forward:
                forward_matches.append(paper_data)

        return {
            "seed_paper": {
                "id": str(seed_row["id"]),
                "title": seed_row["title"],
                "doi": seed_row["doi"],
            },
            "backward": backward_matches,
            "forward": forward_matches,
            "backward_count": len(backward_matches),
            "forward_count": len(forward_matches),
            "backward_total_refs": backward_total_refs,
            "forward_total_citations": forward_total_citations,
            "forward_dois": forward_dois[:50],
            "backward_dois": backward_dois[:50],
        }

    except HTTPException:
        raise
    except asyncpg.PostgresError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    finally:
        if conn:
            await conn.close()


@router.get("/snowball/{doi:path}/keywords")
async def snowball_keywords(doi: str) -> dict[str, Any]:
    """
    F29 - Keyword expansion: Given a seed paper DOI, find related papers
    that share at least one keyword with the seed paper.
    Returns seed paper info, expanded papers with overlap counts, and total.
    """
    decoded_doi = unquote(doi)

    conn = None
    try:
        conn = await get_db_connection()

        # 1. Fetch seed paper keywords
        seed_row = await conn.fetchrow(
            """
            SELECT id, title, doi, keywords
            FROM papers
            WHERE doi = $1
            """,
            decoded_doi
        )

        if seed_row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Seed paper with DOI '{decoded_doi}' not found"
            )

        # 2. Parse seed keywords (JSONB comes as string from asyncpg)
        raw_seed_keywords = seed_row["keywords"]
        if isinstance(raw_seed_keywords, str) and raw_seed_keywords:
            seed_keywords = json.loads(raw_seed_keywords)
        else:
            seed_keywords = raw_seed_keywords or []

        if not seed_keywords:
            return {
                "seed_doi": decoded_doi,
                "seed_keywords": [],
                "expanded_papers": [],
                "total_found": 0,
            }

        # Normalize seed keywords to lowercase for comparison
        seed_keywords_lower = [kw.lower() for kw in seed_keywords if kw]

        # 3. Find related papers with keywords
        rows = await conn.fetch(
            """
            SELECT id, title, doi, journal, published_date, keywords
            FROM papers
            WHERE doi != $1
              AND keywords IS NOT NULL
              AND keywords != '[]'::jsonb
            """,
            decoded_doi
        )

        # 4. Calculate overlap for each paper
        expanded_papers = []
        for row in rows:
            raw_keywords = row["keywords"]
            if isinstance(raw_keywords, str) and raw_keywords:
                paper_keywords = json.loads(raw_keywords)
            else:
                paper_keywords = raw_keywords or []

            if not paper_keywords:
                continue

            # Case-insensitive overlap count
            paper_keywords_lower = [kw.lower() for kw in paper_keywords if kw]
            matched_keywords = [
                kw for kw in paper_keywords
                if kw and kw.lower() in seed_keywords_lower
            ]
            overlap_count = len(matched_keywords)

            if overlap_count >= 1:
                expanded_papers.append({
                    "id": str(row["id"]),
                    "title": row["title"],
                    "doi": row["doi"],
                    "journal": row["journal"],
                    "published_date": row["published_date"],
                    "keywords": paper_keywords,
                    "overlap_count": overlap_count,
                    "matched_keywords": matched_keywords,
                })

        # 5. Sort by overlap_count descending, limit 20
        expanded_papers.sort(key=lambda x: x["overlap_count"], reverse=True)
        expanded_papers = expanded_papers[:20]

        return {
            "seed_doi": decoded_doi,
            "seed_keywords": seed_keywords,
            "expanded_papers": expanded_papers,
            "total_found": len(expanded_papers),
        }

    except HTTPException:
        raise
    except asyncpg.PostgresError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    finally:
        if conn:
            await conn.close()


@router.get("/snowball/{doi:path}/frontier")
async def snowball_frontier(doi: str) -> dict[str, Any]:
    """
    F30 - Research frontier identification: Given a seed paper DOI,
    identify cutting-edge papers in its snowball network based on recency
    and citation density.
    """
    decoded_doi = unquote(doi)

    conn = None
    try:
        conn = await get_db_connection()

        # 1. Fetch seed paper with paper_references and citations
        seed_row = await conn.fetchrow(
            """
            SELECT id, title, doi, paper_references, citations
            FROM papers
            WHERE doi = $1
            """,
            decoded_doi
        )

        if seed_row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Seed paper with DOI '{decoded_doi}' not found"
            )

        # 2. Parse paper_references and citations (JSONB comes as string)
        raw_references = seed_row["paper_references"]
        raw_citations = seed_row["citations"]

        if isinstance(raw_references, str) and raw_references:
            paper_references = json.loads(raw_references)
        else:
            paper_references = raw_references or []

        if isinstance(raw_citations, str) and raw_citations:
            citations = json.loads(raw_citations)
        else:
            citations = raw_citations or []

        # Combine all DOIs in the snowball network
        network_dois = list(set((paper_references or []) + (citations or [])))

        if not network_dois:
            return {
                "seed_doi": decoded_doi,
                "frontier_papers": [],
            }

        # 3. Fetch all papers in the network
        rows = await conn.fetch(
            """
            SELECT id, title, doi, journal, published_date, citations
            FROM papers
            WHERE doi = ANY($1::text[])
            """,
            network_dois
        )

        # 4. Compute frontier_score for each paper
        frontier_papers = []
        for row in rows:
            # Calculate recency_score
            published_date = row["published_date"]
            if published_date:
                try:
                    pub_year = int(published_date[:4])
                except (ValueError, TypeError):
                    pub_year = 0
            else:
                pub_year = 0

            if pub_year >= 2023:
                recency_score = 1.0
            elif pub_year >= 2020:
                recency_score = 0.7
            elif pub_year >= 2015:
                recency_score = 0.4
            else:
                recency_score = 0.1

            # Calculate citation_density
            raw_citations_count = row["citations"]
            if isinstance(raw_citations_count, str) and raw_citations_count:
                citation_list = json.loads(raw_citations_count)
                citation_count = len(citation_list) if citation_list else 0
            elif isinstance(raw_citations_count, list):
                citation_count = len(raw_citations_count)
            else:
                citation_count = 0

            citation_density = min(citation_count / 100.0, 1.0)

            # Compute frontier_score
            frontier_score = (recency_score * 0.6) + (citation_density * 0.4)

            frontier_papers.append({
                "id": str(row["id"]),
                "title": row["title"],
                "doi": row["doi"],
                "journal": row["journal"],
                "published_date": row["published_date"],
                "frontier_score": round(frontier_score, 4),
                "recency_score": recency_score,
                "citation_density": round(citation_density, 4),
            })

        # 5. Sort by frontier_score descending, return top 10
        frontier_papers.sort(key=lambda x: x["frontier_score"], reverse=True)
        frontier_papers = frontier_papers[:10]

        return {
            "seed_doi": decoded_doi,
            "frontier_papers": frontier_papers,
        }

    except HTTPException:
        raise
    except asyncpg.PostgresError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    finally:
        if conn:
            await conn.close()


@router.get("/snowball/{doi:path}/related")
async def snowball_related(doi: str) -> dict[str, Any]:
    """
    F31 - Related work discovery: Given a seed paper DOI, find related papers
    based on keyword overlap and same journal, excluding papers already
    in the seed's references or citations.
    """
    decoded_doi = unquote(doi)

    conn = None
    try:
        conn = await get_db_connection()

        # 1. Fetch seed paper keywords, title, journal, and references/citations
        seed_row = await conn.fetchrow(
            """
            SELECT id, title, doi, journal, keywords, paper_references, citations
            FROM papers
            WHERE doi = $1
            """,
            decoded_doi
        )

        if seed_row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Seed paper with DOI '{decoded_doi}' not found"
            )

        # 2. Parse seed keywords
        raw_seed_keywords = seed_row["keywords"]
        if isinstance(raw_seed_keywords, str) and raw_seed_keywords:
            seed_keywords = json.loads(raw_seed_keywords)
        else:
            seed_keywords = raw_seed_keywords or []

        # Parse paper_references and citations to exclude
        raw_references = seed_row["paper_references"]
        raw_citations = seed_row["citations"]

        if isinstance(raw_references, str) and raw_references:
            paper_references = json.loads(raw_references)
        else:
            paper_references = raw_references or []

        if isinstance(raw_citations, str) and raw_citations:
            citations = json.loads(raw_citations)
        else:
            citations = raw_citations or []

        # Create exclusion set (papers already in network)
        excluded_dois = set((paper_references or []) + (citations or []))
        excluded_dois.add(decoded_doi.lower())  # Also exclude seed itself

        seed_journal = seed_row["journal"] or ""

        if not seed_keywords:
            seed_keywords_lower = []
        else:
            seed_keywords_lower = [kw.lower() for kw in seed_keywords if kw]

        # 3. Find candidate papers (not excluded)
        rows = await conn.fetch(
            """
            SELECT id, title, doi, journal, published_date, keywords
            FROM papers
            WHERE doi != $1
            """,
            decoded_doi
        )

        # 4. Score each candidate
        related_papers = []
        for row in rows:
            candidate_doi = row["doi"] or ""

            # Skip if in excluded set
            if candidate_doi.lower() in excluded_dois:
                continue

            # Parse candidate keywords
            raw_keywords = row["keywords"]
            if isinstance(raw_keywords, str) and raw_keywords:
                candidate_keywords = json.loads(raw_keywords)
            else:
                candidate_keywords = raw_keywords or []

            if not candidate_keywords:
                continue

            candidate_keywords_lower = [kw.lower() for kw in candidate_keywords if kw]

            # Signal A: keyword overlap
            overlap_count = sum(
                1 for kw in candidate_keywords_lower
                if kw in seed_keywords_lower
            )

            # Signal B: same journal
            candidate_journal = row["journal"] or ""
            same_journal = candidate_journal.lower() == seed_journal.lower() if seed_journal else False

            # Skip papers with no signal
            if overlap_count < 1 and not same_journal:
                continue

            # Compute relevance_score
            relevance_score = (overlap_count * 0.7) + (0.3 if same_journal else 0.0)

            related_papers.append({
                "id": str(row["id"]),
                "title": row["title"],
                "doi": row["doi"],
                "journal": row["journal"],
                "published_date": row["published_date"],
                "keywords": candidate_keywords,
                "relevance_score": round(relevance_score, 4),
                "overlap_count": overlap_count,
                "same_journal": same_journal,
            })

        # 5. Sort by relevance_score descending, limit 15
        related_papers.sort(key=lambda x: x["relevance_score"], reverse=True)
        related_papers = related_papers[:15]

        return {
            "seed_doi": decoded_doi,
            "related_papers": related_papers,
            "total_found": len(related_papers),
        }

    except HTTPException:
        raise
    except asyncpg.PostgresError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    finally:
        if conn:
            await conn.close()


@router.get("/snowball/{doi:path}/graph")
async def snowball_graph(doi: str) -> dict[str, Any]:
    """
    F32 - Citation network visualization data: Given a seed paper DOI,
    build graph data (nodes and edges) for visualizing the citation network.
    """
    decoded_doi = unquote(doi)

    conn = None
    try:
        conn = await get_db_connection()

        # 1. Fetch seed paper with paper_references and citations
        seed_row = await conn.fetchrow(
            """
            SELECT id, title, doi, journal, paper_references, citations
            FROM papers
            WHERE doi = $1
            """,
            decoded_doi
        )

        if seed_row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Seed paper with DOI '{decoded_doi}' not found"
            )

        # 2. Parse paper_references and citations
        raw_references = seed_row["paper_references"]
        raw_citations = seed_row["citations"]

        if isinstance(raw_references, str) and raw_references:
            paper_references = json.loads(raw_references)
        else:
            paper_references = raw_references or []

        if isinstance(raw_citations, str) and raw_citations:
            citations = json.loads(raw_citations)
        else:
            citations = raw_citations or []

        # Create sets for lookup
        backward_set = set(d.lower() for d in paper_references) if paper_references else set()
        forward_set = set(d.lower() for d in citations) if citations else set()

        # Combine all DOIs to fetch from DB
        all_dois = list(backward_set | forward_set)

        # 3. Fetch all papers in the network that exist in DB
        network_papers = {}
        if all_dois:
            rows = await conn.fetch(
                """
                SELECT id, title, doi, journal
                FROM papers
                WHERE LOWER(doi) = ANY(SELECT LOWER(unnest($1::text[])))
                """,
                list(all_dois)
            )
            for row in rows:
                network_papers[row["doi"].lower()] = {
                    "id": str(row["id"]),
                    "title": row["title"],
                    "doi": row["doi"],
                    "journal": row["journal"],
                }

        # 4. Build graph data
        nodes = []
        edges = []

        # Add seed node
        nodes.append({
            "id": str(seed_row["id"]),
            "title": seed_row["title"],
            "doi": seed_row["doi"],
            "journal": seed_row["journal"],
            "node_type": "seed",
        })

        # Add backward papers (papers seed cites)
        for ref_doi_lower in backward_set:
            if ref_doi_lower in network_papers:
                paper = network_papers[ref_doi_lower]
                # Determine node_type
                if ref_doi_lower in forward_set:
                    node_type = "both"
                else:
                    node_type = "backward"

                nodes.append({
                    "id": paper["id"],
                    "title": paper["title"],
                    "doi": paper["doi"],
                    "journal": paper["journal"],
                    "node_type": node_type,
                })

                # Add edge: seed cites this paper
                edges.append({
                    "source_doi": decoded_doi,
                    "target_doi": paper["doi"],
                    "edge_type": "cites",
                })

        # Add forward papers (papers that cite seed) - only those not already added
        for cit_doi_lower in forward_set:
            if cit_doi_lower in backward_set:
                continue  # Already added above
            if cit_doi_lower in network_papers:
                paper = network_papers[cit_doi_lower]
                nodes.append({
                    "id": paper["id"],
                    "title": paper["title"],
                    "doi": paper["doi"],
                    "journal": paper["journal"],
                    "node_type": "forward",
                })

                # Add edge: this paper cites seed
                edges.append({
                    "source_doi": paper["doi"],
                    "target_doi": decoded_doi,
                    "edge_type": "cited_by",
                })

        return {
            "seed_doi": decoded_doi,
            "nodes": nodes,
            "edges": edges,
            "node_count": len(nodes),
            "edge_count": len(edges),
        }

    except HTTPException:
        raise
    except asyncpg.PostgresError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    finally:
        if conn:
            await conn.close()