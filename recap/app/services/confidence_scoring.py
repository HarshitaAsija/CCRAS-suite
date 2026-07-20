from typing import List, Dict
import re
import numpy as np
import logging

logger = logging.getLogger(__name__)

class ConfidenceScorer:
    def __init__(self):
        self.weights = {
            "citation_coverage": 0.30,
            "chunk_relevance": 0.35,
            "source_agreement": 0.20,
            "answer_completeness": 0.15
        }
    
    def calculate(self, response: str, chunks: List[Dict]) -> float:
        try:
            scores = {
                "citation_coverage": self._citation_score(response, chunks),
                "chunk_relevance": self._relevance_score(chunks),
                "source_agreement": self._agreement_score(chunks),
                "answer_completeness": self._completeness_score(response)
            }
            
            total = sum(scores[k] * self.weights[k] for k in scores)
            confidence = min(1.0, max(0.0, total))
            
            logger.info(f"📊 Confidence: {confidence:.3f} - {scores}")
            return confidence
        except Exception as e:
            logger.error(f"Error calculating confidence: {e}")
            return 0.5
    
    def _citation_score(self, response: str, chunks: List[Dict]) -> float:
        citations = re.findall(r'\[(\d+)\]', response)
        if not chunks:
            return 0.0
        words = len(response.split())
        expected = min(len(chunks), max(1, words / 50))
        actual = len(set(citations))
        return min(1.0, actual / expected) if expected > 0 else 0.0
    
    def _relevance_score(self, chunks: List[Dict]) -> float:
        if not chunks:
            return 0.0
        scores = [float(chunk.get('score', 0.5)) for chunk in chunks if chunk.get('score')]
        return np.mean(scores) if scores else 0.5
    
    def _agreement_score(self, chunks: List[Dict]) -> float:
        if len(chunks) < 2:
            return 1.0
        papers = set(chunk.get('paper_id', str(i)) for i, chunk in enumerate(chunks))
        if len(papers) == 1:
            return 0.9
        elif len(papers) == len(chunks):
            return 0.5
        return 0.7
    
    def _completeness_score(self, response: str) -> float:
        if "couldn't find" in response.lower() or "don't know" in response.lower():
            return 0.3
        words = len(response.split())
        if words > 100:
            return 0.9
        elif words > 50:
            return 0.7
        elif words > 20:
            return 0.5
        return 0.3
    
    def get_confidence_level(self, score: float) -> str:
        if score >= 0.8:
            return "HIGH"
        elif score >= 0.6:
            return "MEDIUM"
        elif score >= 0.4:
            return "LOW"
        else:
            return "VERY_LOW"