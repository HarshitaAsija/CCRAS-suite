from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class QueryReformulator:
    def __init__(self, ollama_service):
        self.ollama = ollama_service
        self.follow_up_markers = ["it", "they", "this", "these", "those", "that", "them"]
    
    def is_follow_up(self, query: str) -> bool:
        words = query.lower().split()
        if any(word in self.follow_up_markers for word in words):
            return True
        question_words = ["what", "how", "why", "when", "where", "which", "who"]
        if words and words[0] in question_words and len(words) < 6:
            return True
        return False
    
    def reformulate(self, query: str, history: List[Dict]) -> str:
        if not history or len(history) < 2:
            return query
        
        if self.is_follow_up(query):
            last_q = ""
            for msg in reversed(history):
                if msg.get("role") == "user":
                    last_q = msg.get("content", "")
                    break
            
            if last_q and len(query.split()) < 4:
                reformulated = f"{last_q} - Specifically: {query}"
                logger.info(f"🔄 Reformulated: '{query}' -> '{reformulated}'")
                return reformulated
        
        return query
    