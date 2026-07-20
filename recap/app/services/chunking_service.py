# backend/app/services/chunking_service.py

import logging
import re
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID

from app.models import Paper, PaperChunk, ProcessingQueue

logger = logging.getLogger(__name__)

class ChunkingService:
    def __init__(self, chunk_size: int = 1000, overlap: int = 200):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.min_chunk_size = 100
        
    def split_into_chunks(self, text: str) -> List[Dict]:
        """Split text into overlapping chunks with smart boundaries"""
        if not text or len(text.strip()) < self.min_chunk_size:
            return []
            
        # Clean text
        text = self._clean_text(text)
        
        # Get paragraphs
        paragraphs = self._split_into_paragraphs(text)
        
        chunks = []
        current_chunk = []
        current_length = 0
        
        for para in paragraphs:
            para_length = len(para)
            
            if para_length > self.chunk_size * 2:
                sentences = self._split_into_sentences(para)
                for sent in sentences:
                    sent_length = len(sent)
                    if current_length + sent_length > self.chunk_size and current_chunk:
                        chunks.append({
                            'text': ' '.join(current_chunk),
                            'chunk_index': len(chunks),
                            'word_count': len(' '.join(current_chunk).split())
                        })
                        overlap_text = self._get_overlap(current_chunk, self.overlap)
                        current_chunk = [overlap_text] if overlap_text else []
                        current_length = len(overlap_text) if overlap_text else 0
                    
                    current_chunk.append(sent)
                    current_length += sent_length
            else:
                if current_length + para_length > self.chunk_size and current_chunk:
                    chunks.append({
                        'text': ' '.join(current_chunk),
                        'chunk_index': len(chunks),
                        'word_count': len(' '.join(current_chunk).split())
                    })
                    overlap_text = self._get_overlap(current_chunk, self.overlap)
                    current_chunk = [overlap_text] if overlap_text else []
                    current_length = len(overlap_text) if overlap_text else 0
                
                current_chunk.append(para)
                current_length += para_length
        
        if current_chunk:
            chunks.append({
                'text': ' '.join(current_chunk),
                'chunk_index': len(chunks),
                'word_count': len(' '.join(current_chunk).split())
            })
        
        return chunks
    
    def _clean_text(self, text: str) -> str:
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'[^\w\s.,;:?!\-()\[\]{}""\'\n\r\t]', '', text)
        return text.strip()
    
    def _split_into_paragraphs(self, text: str) -> List[str]:
        paragraphs = re.split(r'\n\s*\n|\n', text)
        return [p.strip() for p in paragraphs if p.strip()]
    
    def _split_into_sentences(self, text: str) -> List[str]:
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _get_overlap(self, chunk: List[str], overlap_chars: int) -> str:
        chunk_text = ' '.join(chunk)
        if len(chunk_text) <= overlap_chars:
            return chunk_text
        overlap_text = chunk_text[-overlap_chars:]
        for boundary in ['. ', '! ', '? ', '; ', ', ', ' ']:
            if boundary in overlap_text:
                parts = overlap_text.rsplit(boundary, 1)
                if len(parts) == 2 and len(parts[0]) < overlap_chars * 0.8:
                    return parts[0] + boundary
        return overlap_text
    
    def process_paper(self, paper_id: UUID, db: Session) -> bool:
        """Process a single paper: chunk it and add to queue for embedding"""
        try:
            logger.info(f"Processing paper {paper_id} for chunking")
            
            # Get paper
            paper = db.query(Paper).filter(Paper.id == paper_id).first()
            if not paper:
                logger.error(f"Paper {paper_id} not found")
                return False
            
            if not paper.full_text or len(paper.full_text.strip()) < 100:
                logger.warning(f"Paper {paper_id} has no full text or too short")
                paper.processing_status = 'failed'
                paper.processing_error = 'No full text or too short'
                db.commit()
                return False
            
            # Split into chunks
            chunks = self.split_into_chunks(paper.full_text)
            
            if not chunks:
                logger.warning(f"No chunks generated for paper {paper_id}")
                paper.processing_status = 'failed'
                paper.processing_error = 'No chunks generated'
                db.commit()
                return False
            
            # Delete existing chunks for this paper (if any)
            db.query(PaperChunk).filter(PaperChunk.paper_id == paper_id).delete()
            
            # Insert new chunks
            for chunk_data in chunks:
                chunk = PaperChunk(
                    paper_id=paper_id,
                    chunk_index=chunk_data['chunk_index'],
                    chunk_text=chunk_data['text'],
                    word_count=chunk_data['word_count'],
                    created_at=datetime.now()
                )
                db.add(chunk)
            
            # Update paper status
            paper.processing_status = 'chunked'
            paper.chunked_at = datetime.now()
            db.commit()
            
            # Add to processing queue for embedding
            queue_item = ProcessingQueue(
                paper_id=paper_id,
                task_type='embedding',
                status='pending',
                created_at=datetime.now()
            )
            db.add(queue_item)
            db.commit()
            
            logger.info(f"Successfully chunked paper {paper_id} into {len(chunks)} chunks")
            return True
            
        except Exception as e:
            logger.error(f"Error chunking paper {paper_id}: {str(e)}")
            paper = db.query(Paper).filter(Paper.id == paper_id).first()
            if paper:
                paper.processing_status = 'failed'
                paper.processing_error = f"Chunking failed: {str(e)}"
                db.commit()
            return False