from sqlalchemy import text
from app.services.embedding_service import embed_text
from typing import List
import os
import re
import logging
import ollama
from langchain_ollama import OllamaLLM
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ============ RETRIEVAL FUNCTIONS ============

def retrieve_relevant_chunks(query: str, db, top_k: int = 5) -> List[dict]:
    """
    Retrieve relevant chunks using vector similarity search.
    Uses raw SQL to avoid pgvector deserialization issues.
    """
    query_embedding = embed_text(query)
    if hasattr(query_embedding, 'tolist'):
        query_embedding = query_embedding.tolist()
    elif isinstance(query_embedding, str):
        import json
        query_embedding = json.loads(query_embedding)

    query_vec = "[" + ",".join(str(x) for x in query_embedding) + "]"

    stmt = text("""
        SELECT paper_id, chunk_text,
               embedding <=> CAST(:query_vec AS vector) AS distance
        FROM paper_chunks
        ORDER BY distance
        LIMIT :limit
    """).bindparams(query_vec=query_vec, limit=top_k * 3)

    result = db.execute(stmt)
    rows = result.all()

    chunks = []
    for row in rows:
        similarity = max(0.0, 1.0 - row.distance)
        chunks.append({
            "paper_id": str(row.paper_id),
            "chunk_text": row.chunk_text,
            "similarity": float(similarity)
        })

    chunks.sort(key=lambda x: x["similarity"], reverse=True)
    return chunks[:top_k]

# ========================================
# FETCH PAPER DETAILS FROM DATABASE
# ========================================
def fetch_paper_details(db, paper_ids: list) -> dict:
    """
    Fetch paper title, journal, doi, and authors for a list of paper IDs.
    """
    if not paper_ids:
        return {}

    paper_ids_str = [str(pid) for pid in paper_ids]
    placeholders = ', '.join([f':p{i}' for i in range(len(paper_ids_str))])

    stmt = text(f"""
        SELECT id, title, journal, doi, published_date, authors
        FROM papers
        WHERE id::text IN ({placeholders})
    """)

    params = {f'p{i}': pid for i, pid in enumerate(paper_ids_str)}

    result = db.execute(stmt, params)
    papers = {}
    for row in result:
        # DEBUG: log which fields are actually null in the DB so we can tell
        # a genuine data gap apart from a frontend mapping bug.
        missing = [f for f in ("title", "journal", "authors") if not getattr(row, f, None)]
        if missing:
            logger.warning(f"⚠️ Paper {str(row.id)[:8]} missing fields in DB: {missing}")

        papers[str(row.id)] = {
            "title": row.title or "Untitled Paper",
            "journal": row.journal or "",
            "doi": row.doi,
            "published_date": row.published_date,
            "authors": row.authors or []
        }
    return papers

# ========================================
# BUILD CONTEXT WITH NUMBERED CITATIONS
# ========================================
def build_context_string(chunks: list[dict], db=None) -> tuple[str, list[str], list[dict]]:
    """
    Build context string from chunks using [n] numbered citations instead of
    quoted titles. Small local models (e.g. TinyLlama) follow a numbered
    citation format far more reliably than "cite the exact title" instructions,
    which tend to get echoed/mangled verbatim instead of used correctly.

    Returns:
        context: prompt-ready string with [n] markers
        cited_ids: paper_ids in the order they were numbered
        cited_papers: full metadata per paper, including its assigned number
    """
    context_parts = []
    cited_ids = []
    cited_papers = []

    # Preserve first-seen order instead of set() (set() order isn't guaranteed
    # and made citation numbers unstable across runs)
    paper_ids = list(dict.fromkeys(chunk["paper_id"] for chunk in chunks))

    paper_details = {}
    if db and paper_ids:
        try:
            paper_details = fetch_paper_details(db, paper_ids)
            logger.info(f"📚 Fetched details for {len(paper_details)} papers")
        except Exception as e:
            logger.error(f"❌ Error fetching paper details: {e}")

    # Assign a stable number to each paper BEFORE building chunk text
    id_to_num = {}
    for i, pid in enumerate(paper_ids, start=1):
        id_to_num[pid] = i
        info = paper_details.get(str(pid), {})
        title = info.get("title") or f"Paper {pid[:8]}"

        # The DB stores authors as jsonb objects: [{"name": "..."}]
        # Frontend expects plain strings: ["..."] — flatten here so the
        # frontend can safely do authors.join(", ") without getting
        # "[object Object]" back.
        raw_authors = info.get("authors", []) or []
        flat_authors = []
        for a in raw_authors:
            if isinstance(a, dict):
                flat_authors.append(a.get("name") or a.get("full_name") or str(a))
            else:
                flat_authors.append(str(a))

        published_date = info.get("published_date")
        year = None
        if published_date:
            try:
                year = int(str(published_date)[:4])
            except (ValueError, TypeError):
                year = None

        cited_papers.append({
            "id": pid,
            "number": i,
            "title": title,
            "journal": info.get("journal", ""),
            "doi": info.get("doi"),
            "authors": flat_authors,
            "year": year
        })
        cited_ids.append(pid)

    for chunk in chunks:
        num = id_to_num[chunk["paper_id"]]
        context_parts.append(f'[{num}] {chunk["chunk_text"]}')

    logger.info(f"📤 Context built with {len(cited_papers)} papers: {[p['title'][:30] for p in cited_papers]}")
    return "\n\n".join(context_parts), cited_ids, cited_papers

# ========================================
# OLLAMA INTEGRATION
# ========================================
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")

# Stop sequences prevent the model from wandering back into echoing the
# prompt's own scaffolding (the "[Soource: ...] --- END ---" leakage)
STOP_SEQUENCES = ["--- END ---", "Excerpts:", "Question:", "\n\n\n"]

def get_llm():
    """Get LangChain Ollama instance"""
    return OllamaLLM(
        model=OLLAMA_MODEL,
        base_url="http://localhost:11434",
        temperature=0.3,   # lower temperature = less likely to hallucinate/copy scaffolding
        num_predict=512,   # answers should be short; large num_predict invites rambling
        stop=STOP_SEQUENCES
    )

def generate_with_ollama(prompt: str, stream: bool = False):
    """Generate response using ollama directly"""
    try:
        if stream:
            response = ollama.chat(
                model=OLLAMA_MODEL,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
                options={"stop": STOP_SEQUENCES, "temperature": 0.3}
            )
            for chunk in response:
                if 'message' in chunk and 'content' in chunk['message']:
                    yield chunk['message']['content']
        else:
            response = ollama.chat(
                model=OLLAMA_MODEL,
                messages=[{"role": "user", "content": prompt}],
                options={"stop": STOP_SEQUENCES, "temperature": 0.3}
            )
            return response['message']['content']
    except Exception as e:
        logger.error(f"❌ Ollama error: {e}")
        if stream:
            yield f"Error: {str(e)}"
        else:
            return f"Error: {str(e)}"

# ========================================
# PROMPT TEMPLATES
# ========================================
BASE_RAG_PROMPT = """You are a research assistant. Answer the question in your own words using ONLY the numbered excerpts below. Do not copy the excerpts verbatim. Do not repeat the word "Source" or "Excerpt". After each claim, add the excerpt number in brackets, like [1].

Excerpts:
{context}

Question: {question}

Write a direct 2-4 sentence answer now. Do not restate the excerpts.
Answer:"""

HISTORY_AWARE_PROMPT = """You are a research assistant. Use the previous conversation only to understand what the current question is referring to.

Previous conversation:
{history}

Answer the CURRENT question in your own words using ONLY the numbered excerpts below. Do not copy the excerpts verbatim. After each claim, add the excerpt number in brackets, like [1].

Excerpts:
{context}

Current question: {question}

Write a direct 2-4 sentence answer now. Do not restate the excerpts.
Answer:"""

# ========================================
# ANSWER SANITIZATION
# ========================================
def sanitize_answer(text_: str) -> str:
    """
    Defensive cleanup in case a small model still leaks prompt scaffolding
    into its output despite stop sequences and instructions.
    """
    if not text_:
        return text_
    text_ = re.sub(r'\[Soo?urce:.*?\]', '', text_, flags=re.IGNORECASE)
    text_ = re.sub(r'---\s*END\s*---', '', text_, flags=re.IGNORECASE)
    text_ = re.sub(r'Excerpts?:\s*', '', text_, flags=re.IGNORECASE)
    text_ = re.sub(r'\n{3,}', '\n\n', text_)
    return text_.strip()

# ========================================
# ENHANCED RAG SERVICE
# ========================================
class EnhancedRAGService:
    def __init__(self):
        from app.services.redis_service import RedisService
        from app.services.query_reformulation import QueryReformulator
        from app.services.confidence_scoring import ConfidenceScorer
        from app.config import settings

        self.redis_service = RedisService(settings.REDIS_URL)
        self.reformulator = QueryReformulator(None)
        self.confidence_scorer = ConfidenceScorer()
        self.model = OLLAMA_MODEL
        self.llm = get_llm()
        logger.info(f"🚀 EnhancedRAGService initialized with model: {self.model}")

    def get_conversation_history(self, session_id: str, max_exchanges: int = 3) -> List[dict]:
        """Get recent conversation history from Redis"""
        return self.redis_service.get_conversation(session_id)[-max_exchanges*2:]

    def is_follow_up_question(self, question: str, history: List[dict]) -> bool:
        """Check if the question is a follow-up"""
        if not history:
            return False
        return self.reformulator.is_follow_up(question)

    def build_enhanced_prompt(self, context: str, question: str, session_id: str = None) -> str:
        """Build prompt with conversation history if available"""
        if not session_id:
            return BASE_RAG_PROMPT.format(context=context, question=question)

        history = self.get_conversation_history(session_id)
        if not history:
            return BASE_RAG_PROMPT.format(context=context, question=question)

        if self.is_follow_up_question(question, history):
            history_parts = []
            for msg in history[-4:]:
                role = msg.get("role", "")
                content = msg.get("content", "")
                if role == "user":
                    history_parts.append(f"User asked: {content}")
                elif role == "assistant":
                    if len(content) > 100:
                        content = content[:100] + "..."
                    history_parts.append(f"Assistant responded: {content}")

            history_str = "\n".join(history_parts)

            return HISTORY_AWARE_PROMPT.format(
                history=history_str,
                question=question,
                context=context
            )

        return BASE_RAG_PROMPT.format(context=context, question=question)

    def extract_citations(self, response: str, cited_papers: List[dict]) -> List[dict]:
        """
        Extract [n] citation numbers actually used in the answer text and map
        them back to full paper metadata. Previously this looked for [n]
        markers but the prompt asked the model to cite quoted titles, so the
        two never matched and citations always came back empty.
        """
        numbers = set(int(m) for m in re.findall(r'\[(\d+)\]', response))
        if not numbers:
            return []
        return [p for p in cited_papers if p["number"] in numbers]

    def calculate_confidence(self, response: str, chunks: List[dict]) -> dict:
        """Calculate confidence score"""
        score = self.confidence_scorer.calculate(response, chunks)
        level = self.confidence_scorer.get_confidence_level(score)
        return {
            "score": score,
            "level": level
        }

    def generate_answer(
        self,
        question: str,
        db,
        session_id: str = None,
        top_k: int = 5,
        use_cache: bool = True
    ) -> dict:
        """Generate RAG answer with all enhancements"""
        if use_cache and session_id:
            query_hash = self.redis_service.generate_query_hash(session_id, question)
            cached = self.redis_service.get_query_cache(query_hash)
            if cached:
                logger.info(f"📦 Cache hit for: {question[:50]}...")
                return cached

        chunks = retrieve_relevant_chunks(question, db, top_k=top_k)
        context, cited_ids, cited_papers = build_context_string(chunks, db=db)
        prompt = self.build_enhanced_prompt(context, question, session_id)

        try:
            full_answer = self.llm.invoke(prompt)
        except Exception as e:
            logger.error(f"❌ LangChain Ollama error: {e}")
            full_answer = generate_with_ollama(prompt, stream=False)

        full_answer = sanitize_answer(full_answer)

        citations = self.extract_citations(full_answer, cited_papers)
        confidence = self.calculate_confidence(full_answer, chunks)

        result = {
            "answer": full_answer,
            "cited_paper_ids": cited_ids,
            "cited_papers": cited_papers,   # all retrieved papers, for the Sources panel
            "citations": citations,          # only papers actually referenced in-text
            "confidence_score": confidence["score"],
            "confidence_level": confidence["level"],
            "chunks_used": len(chunks)
        }

        if session_id:
            query_hash = self.redis_service.generate_query_hash(session_id, question)
            self.redis_service.cache_response(query_hash, result)

            history = self.redis_service.get_conversation(session_id)
            history.append({"role": "user", "content": question})
            history.append({"role": "assistant", "content": full_answer})
            self.redis_service.update_conversation(session_id, history)

        return result

    def stream_answer(self, question: str, db, session_id: str = None, top_k: int = 5):
        """Stream answer with conversation history support"""
        chunks = retrieve_relevant_chunks(question, db, top_k=top_k)
        context, cited_ids, cited_papers = build_context_string(chunks, db=db)
        prompt = self.build_enhanced_prompt(context, question, session_id)

        full_answer = ""
        for token in generate_with_ollama(prompt, stream=True):
            if isinstance(token, str):
                full_answer += token
                yield token

        full_answer = sanitize_answer(full_answer)

        citations = self.extract_citations(full_answer, cited_papers)
        confidence = self.calculate_confidence(full_answer, chunks)

        result = {
            "answer": full_answer,
            "cited_paper_ids": cited_ids,
            "cited_papers": cited_papers,
            "citations": citations,
            "confidence_score": confidence["score"],
            "confidence_level": confidence["level"]
        }

        if session_id:
            query_hash = self.redis_service.generate_query_hash(session_id, question)
            self.redis_service.cache_response(query_hash, result)
            history = self.redis_service.get_conversation(session_id)
            history.append({"role": "user", "content": question})
            history.append({"role": "assistant", "content": full_answer})
            self.redis_service.update_conversation(session_id, history)

        yield result

# ========================================
# BACKWARD COMPATIBILITY
# ========================================

def generate_rag_answer(question: str, db) -> dict:
    """Original function - kept for backward compatibility"""
    service = EnhancedRAGService()
    result = service.generate_answer(question, db, session_id=None, use_cache=False)
    return {
        "answer": result["answer"],
        "cited_paper_ids": result["cited_paper_ids"],
        "cited_papers": result["cited_papers"]
    }