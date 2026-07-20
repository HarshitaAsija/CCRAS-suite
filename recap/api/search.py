from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from app.services.embedding_service import embed_text
from app.models import User, Paper
from core.auth import get_current_user
from app.database import get_db
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

class SemanticSearchRequest(BaseModel):
    query: str
    top_k: int = 5

@router.post("/semantic")
async def semantic_search(request: SemanticSearchRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    query_embedding = await embed_text(request.query)
    # Ensure it's a list of floats
    if hasattr(query_embedding, 'tolist'):
        query_embedding = query_embedding.tolist()
    elif isinstance(query_embedding, str):
        import json
        query_embedding = json.loads(query_embedding)

    # Compute cosine distance and order by it
    distance_expr = Paper.embedding.op('<=>')(query_embedding)
    stmt = select(Paper, distance_expr.label("distance")).order_by("distance").limit(request.top_k * 3)
    result = await db.execute(stmt)
    rows = result.all()

    # Deduplicate by paper id (should be unique anyway)
    seen = {}
    papers = []
    for paper, distance in rows:
        pid = str(paper.id)
        if pid not in seen or distance < seen[pid]:
            seen[pid] = distance
            papers.append((paper, distance))

    # Build response
    paper_list = []
    for paper, distance in papers:
        # Convert distance to similarity score (1 - distance for cosine distance where 0 identical, 2 opposite)
        similarity = max(0.0, 1.0 - distance)  # cosine distance range [0,2]
        paper_list.append({
            "id": str(paper.id),
            "title": paper.title,
            "abstract": paper.abstract,
            "authors": [author.name for author in paper.authors] if paper.authors else [],
            "journal": getattr(paper, 'journal', None),
            "doi": paper.doi,
            "published_date": paper.published_date.isoformat() if paper.published_date else None,
            "keywords": [kw.keyword for kw in paper.keywords] if paper.keywords else [],
            "similarity_score": round(similarity, 4)
        })

    return {
        "query": request.query,
        "total_found": len(paper_list),
        "papers": paper_list
    }

class HybridSearchRequest(BaseModel):
    query: str
    top_k: int = 5

def compute_text_score(query: str, title: str, abstract: str) -> float:
    import re
    """
    Compute a simple text match score based on query word presence in title and abstract.
    Returns a score between 0 and 1.
    """
    query_words = re.findall(r'\b\w+\b', query.lower())
    if not query_words:
        return 0.0
    title_lower = title.lower()
    abstract_lower = abstract.lower()
    title_matches = sum(1 for word in query_words if word in title_lower)
    abstract_matches = sum(1 for word in query_words if word in abstract_lower)
    max_possible = len(query_words) * 2  # each word can match in title (weight 2) and abstract (weight 1)
    score = (title_matches * 2 + abstract_matches) / max_possible if max_possible > 0 else 0.0
    return min(score, 1.0)  # cap at 1.0

@router.post("/hybrid")
async def hybrid_search(request: HybridSearchRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # Get more candidates for re-ranking
    candidate_count = max(20, request.top_k * 3)

    query_embedding = await embed_text(request.query)
    if hasattr(query_embedding, 'tolist'):
        query_embedding = query_embedding.tolist()
    elif isinstance(query_embedding, str):
        import json
        query_embedding = json.loads(query_embedding)

    # Semantic search with distance
    distance_expr = Paper.embedding.op('<=>')(query_embedding)
    stmt = select(Paper, distance_expr.label("distance")).order_by("distance").limit(candidate_count)
    result = await db.execute(stmt)
    rows = result.all()

    candidate_papers = []
    for paper, distance in rows:
        similarity = max(0.0, 1.0 - distance)
        candidate_papers.append({
            "paper_id": paper.id,
            "semantic_score": similarity,
            "title": paper.title,
            "abstract": paper.abstract,
            "authors": [author.name for author in paper.authors] if paper.authors else [],
            "journal": getattr(paper, 'journal', None),
            "doi": paper.doi,
            "published_date": paper.published_date,
            "keywords": [kw.keyword for kw in paper.keywords] if paper.keywords else [],
        })

    # Compute text scores and combine
    for paper in candidate_papers:
        text_score = compute_text_score(request.query, paper["title"], paper["abstract"])
        # Weighted combination: 70% semantic, 30% text
        paper["hybrid_score"] = 0.7 * paper["semantic_score"] + 0.3 * text_score

    # Sort by hybrid score descending
    candidate_papers.sort(key=lambda x: x["hybrid_score"], reverse=True)

    # Take top_k
    top_papers = candidate_papers[:request.top_k]

    # Format response
    papers = []
    for paper in top_papers:
        papers.append({
            "id": str(paper["paper_id"]),
            "title": paper["title"],
            "abstract": paper["abstract"],
            "authors": paper["authors"],
            "journal": paper["journal"],
            "doi": paper["doi"],
            "published_date": paper["published_date"].isoformat() if paper["published_date"] else None,
            "keywords": paper["keywords"],
            "similarity_score": round(paper["hybrid_score"], 4),
            "semantic_score": round(paper["semantic_score"], 4),
            "text_score": round(compute_text_score(request.query, paper["title"], paper["abstract"]), 4)
        })

    return {
        "query": request.query,
        "total_found": len(papers),
        "papers": papers
    }