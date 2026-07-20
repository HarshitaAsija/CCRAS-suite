from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, insert
from app.services.embedding_service import embed_text
from app.services.rag_service import (
    generate_rag_answer, 
    retrieve_relevant_chunks, 
    build_context_string,
    EnhancedRAGService,
    generate_with_ollama
)
from app.models import User, ChatSession, ChatMessage
from core.auth import get_current_user
from app.database import get_db
from sqlalchemy.orm import Session
import os
import uuid
import json
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Initialize enhanced service
enhanced_rag = EnhancedRAGService()

class ChatRequest(BaseModel):
    question: str
    session_id: str | None = None
    user_id: str | None = None

# ============ KEEP EXISTING ENDPOINT ============

@router.post("/rag/chat")
def rag_chat(
    request: ChatRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    session_id = request.session_id
    if not session_id:
        stmt = insert(ChatSession).values(
            user_id=current_user.id,
            title=request.question[:60]
        ).returning(ChatSession.id)
        result = db.execute(stmt)
        db.commit()
        session_id = result.scalar_one()
    else:
        stmt = select(ChatSession).where(
            ChatSession.id == session_id, 
            ChatSession.user_id == current_user.id
        )
        result = db.execute(stmt)
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=403, detail="Session not found or access denied")

    # Save user message
    stmt = insert(ChatMessage).values(
        session_id=session_id,
        role="user",
        content=request.question
    )
    db.execute(stmt)
    db.commit()

    # Generate answer
    result = generate_rag_answer(request.question, db)

    # Save assistant message
    stmt = insert(ChatMessage).values(
        session_id=session_id,
        role="assistant",
        content=result["answer"],
        cited_paper_ids=result["cited_paper_ids"]
    )
    db.execute(stmt)
    db.commit()

    return {
        "session_id": str(session_id),
        "question": request.question,
        "answer": result["answer"],
        "cited_papers": result["cited_papers"]
    }

# ============ NEW/ENHANCED ENDPOINTS ============

@router.post("/rag/chat/enhanced")
def rag_chat_enhanced(
    request: ChatRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Enhanced chat with conversation history, confidence scoring, and caching"""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Get or create session
    session_id = request.session_id
    if not session_id:
        stmt = insert(ChatSession).values(
            user_id=current_user.id,
            title=request.question[:60]
        ).returning(ChatSession.id)
        result = db.execute(stmt)
        db.commit()
        session_id = result.scalar_one()
    else:
        stmt = select(ChatSession).where(
            ChatSession.id == session_id, 
            ChatSession.user_id == current_user.id
        )
        result = db.execute(stmt)
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=403, detail="Session not found or access denied")

    # Save user message
    stmt = insert(ChatMessage).values(
        session_id=session_id,
        role="user",
        content=request.question
    )
    db.execute(stmt)
    db.commit()

    # Generate enhanced answer with conversation history
    result = enhanced_rag.generate_answer(
        question=request.question,
        db=db,
        session_id=str(session_id),
        top_k=5,
        use_cache=True
    )

    # Save assistant message with citations
    stmt = insert(ChatMessage).values(
        session_id=session_id,
        role="assistant",
        content=result["answer"],
        cited_paper_ids=result["cited_paper_ids"]
    )
    db.execute(stmt)
    db.commit()

    return {
        "session_id": str(session_id),
        "question": request.question,
        "answer": result["answer"],
        "cited_papers": result["cited_papers"],
        "confidence_score": result.get("confidence_score"),
        "confidence_level": result.get("confidence_level"),
        "citations": result.get("citations", []),
        "chunks_used": result.get("chunks_used", 0)
    }

@router.post("/rag/chat/stream")
def rag_chat_stream(
    request: ChatRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Streaming chat with conversation history"""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Get or create session
    session_id = request.session_id
    if not session_id:
        stmt = insert(ChatSession).values(
            user_id=current_user.id,
            title=request.question[:60]
        ).returning(ChatSession.id)
        result = db.execute(stmt)
        db.commit()
        session_id = result.scalar_one()
    else:
        stmt = select(ChatSession).where(
            ChatSession.id == session_id, 
            ChatSession.user_id == current_user.id
        )
        result = db.execute(stmt)
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=403, detail="Session not found or access denied")

    # Save user message
    stmt = insert(ChatMessage).values(
        session_id=session_id,
        role="user",
        content=request.question
    )
    db.execute(stmt)
    db.commit()

    def generate():
        full_answer = ""
        
        # Get chunks for citations
        chunks = retrieve_relevant_chunks(request.question, db, top_k=5)
        # IMPORTANT: db=db must be passed here, or fetch_paper_details() never
        # runs inside build_context_string, and every citation silently falls
        # back to "Paper {uuid[:8]}" instead of its real title/authors/journal.
        # This was the root cause of citations showing raw IDs.
        context, cited_ids, cited_papers = build_context_string(chunks, db=db)
        
        # Build prompt with history
        prompt = enhanced_rag.build_enhanced_prompt(context, request.question, str(session_id))
        
        # Stream tokens using direct ollama
        for token in generate_with_ollama(prompt, stream=True):
            if isinstance(token, str):
                full_answer += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        
        # Calculate confidence
        confidence = enhanced_rag.calculate_confidence(full_answer, chunks)
        
        # Save assistant message
        stmt = insert(ChatMessage).values(
            session_id=session_id,
            role="assistant",
            content=full_answer,
            cited_paper_ids=cited_ids
        )
        db.execute(stmt)
        db.commit()
        
        # Update Redis conversation history
        history = enhanced_rag.redis_service.get_conversation(str(session_id))
        history.append({"role": "user", "content": request.question})
        history.append({"role": "assistant", "content": full_answer})
        enhanced_rag.redis_service.update_conversation(str(session_id), history)
        
        # Send citations
        yield f"data: {json.dumps({'type': 'citations', 'papers': cited_papers})}\n\n"
        
        # Send confidence
        yield f"data: {json.dumps({'type': 'confidence', 'score': confidence['score'], 'level': confidence['level']})}\n\n"
        
        # Send done
        yield f"data: {json.dumps({'type': 'done', 'session_id': str(session_id)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": str(session_id)
        }
    )

# ============ CONVERSATION MANAGEMENT ============

@router.get("/rag/conversation/{session_id}")
def get_conversation_history(
    session_id: str, 
    current_user: User = Depends(get_current_user)
):
    """Get conversation history from Redis"""
    history = enhanced_rag.redis_service.get_conversation(session_id)
    return {
        "session_id": session_id,
        "message_count": len(history),
        "messages": history
    }

@router.delete("/rag/conversation/{session_id}")
def clear_conversation(
    session_id: str, 
    current_user: User = Depends(get_current_user)
):
    """Clear conversation history from Redis"""
    enhanced_rag.redis_service.clear_conversation(session_id)
    return {"status": "success", "session_id": session_id}

@router.get("/rag/session-stats/{session_id}")
def get_session_stats(
    session_id: str, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get statistics for a session"""
    try:
        # First check if session exists in Redis
        redis_messages = enhanced_rag.redis_service.get_conversation(session_id)
        
        # Then check if session exists in database
        stmt = select(ChatSession).where(
            ChatSession.id == session_id, 
            ChatSession.user_id == current_user.id
        )
        result = db.execute(stmt)
        session = result.scalar_one_or_none()
        
        # Build stats
        stats = {
            "session_id": str(session_id),
            "total_messages": len(redis_messages),
            "user_messages": len([m for m in redis_messages if m.get("role") == "user"]),
            "assistant_messages": len([m for m in redis_messages if m.get("role") == "assistant"]),
            "has_redis_history": len(redis_messages) > 0,
        }
        
        if session:
            stats.update({
                "title": session.title,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "updated_at": session.updated_at.isoformat() if session.updated_at else None,
                "has_db_session": True
            })
        else:
            stats.update({
                "title": "No DB session",
                "has_db_session": False
            })
        
        return stats
    except Exception as e:
        # If there's an error, return basic stats from Redis
        redis_messages = enhanced_rag.redis_service.get_conversation(session_id)
        return {
            "session_id": str(session_id),
            "total_messages": len(redis_messages),
            "user_messages": len([m for m in redis_messages if m.get("role") == "user"]),
            "assistant_messages": len([m for m in redis_messages if m.get("role") == "assistant"]),
            "has_redis_history": len(redis_messages) > 0,
            "error": "Database session not found, but Redis history exists"
        }

# ============ EXISTING ENDPOINTS (Keep as-is) ============

@router.get("/rag/history/{session_id}")
def get_chat_history(
    session_id: str, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    stmt = select(ChatSession).where(
        ChatSession.id == session_id, 
        ChatSession.user_id == current_user.id
    )
    result = db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    stmt = select(ChatMessage).where(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at)
    result = db.execute(stmt)
    messages = result.scalars().all()

    return {
        "session_id": str(session_id),
        "messages": [
            {
                "id": str(msg.id),
                "role": msg.role,
                "content": msg.content,
                "cited_paper_ids": [str(pid) for pid in (msg.cited_paper_ids or [])],
                "created_at": msg.created_at.isoformat() if msg.created_at else None
            }
            for msg in messages
        ]
    }

@router.get("/rag/sessions")
def get_sessions(
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        stmt = select(ChatSession).where(
            ChatSession.user_id == current_user.id
        ).order_by(ChatSession.created_at.desc())
        result = db.execute(stmt)
        sessions = result.scalars().all()
        
        # Also get Redis sessions
        redis_keys = enhanced_rag.redis_service.redis.keys("conversation:*")
        redis_sessions = []
        for key in redis_keys:
            session_id = key.decode('utf-8').replace('conversation:', '')
            # Check if this session belongs to this user
            # For now, just add it
            redis_sessions.append({
                "id": session_id,
                "title": "Redis Session",
                "created_at": None,
                "is_redis": True
            })
        
        # Combine both
        db_sessions = [
            {
                "id": str(sess.id),
                "title": sess.title,
                "created_at": sess.created_at.isoformat() if sess.created_at else None,
                "is_redis": False
            }
            for sess in sessions
        ]
        
        # Remove duplicates (if session exists in both)
        db_ids = {s["id"] for s in db_sessions}
        unique_redis = [s for s in redis_sessions if s["id"] not in db_ids]
        
        return {
            "sessions": db_sessions + unique_redis,
            "total": len(db_sessions) + len(unique_redis),
            "db_sessions": len(db_sessions),
            "redis_sessions": len(unique_redis)
        }
    except Exception as e:
        # Fallback to just Redis sessions
        redis_keys = enhanced_rag.redis_service.redis.keys("conversation:*")
        sessions = []
        for key in redis_keys:
            session_id = key.decode('utf-8').replace('conversation:', '')
            messages = enhanced_rag.redis_service.get_conversation(session_id)
            sessions.append({
                "id": session_id,
                "title": messages[0].get("content", "Chat")[:50] if messages else "Chat",
                "created_at": None,
                "is_redis": True,
                "message_count": len(messages)
            })
        return {
            "sessions": sessions,
            "total": len(sessions),
            "db_sessions": 0,
            "redis_sessions": len(sessions)
        }
        