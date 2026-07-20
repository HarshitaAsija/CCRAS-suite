import redis
import json
from typing import List, Dict, Optional
from datetime import timedelta
import hashlib
import logging

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        try:
            self.redis = redis.from_url(redis_url)
            self.redis.ping()
            logger.info("✅ Connected to Redis")
            self.available = True
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            self.redis = None
            self.available = False
    
    def is_available(self) -> bool:
        return self.available
    
    def get_conversation(self, session_id: str) -> List[Dict]:
        if not self.is_available():
            return []
        key = f"conversation:{session_id}"
        data = self.redis.get(key)
        if data:
            try:
                return json.loads(data)
            except:
                return []
        return []
    
    def update_conversation(self, session_id: str, messages: List[Dict], ttl_hours: int = 24):
        if not self.is_available():
            return
        key = f"conversation:{session_id}"
        try:
            self.redis.setex(key, timedelta(hours=ttl_hours), json.dumps(messages))
        except Exception as e:
            logger.error(f"Error updating conversation: {e}")
    
    def get_query_cache(self, query_hash: str) -> Optional[Dict]:
        if not self.is_available():
            return None
        key = f"query_cache:{query_hash}"
        data = self.redis.get(key)
        if data:
            try:
                return json.loads(data)
            except:
                return None
        return None
    
    def cache_response(self, query_hash: str, response: Dict, ttl_seconds: int = 3600):
        if not self.is_available():
            return
        key = f"query_cache:{query_hash}"
        try:
            self.redis.setex(key, timedelta(seconds=ttl_seconds), json.dumps(response))
        except Exception as e:
            logger.error(f"Error caching: {e}")
    
    def generate_query_hash(self, session_id: str, query: str) -> str:
        text = f"{session_id}:{query}"
        return hashlib.md5(text.encode()).hexdigest()
    
    def clear_conversation(self, session_id: str):
        if not self.is_available():
            return
        key = f"conversation:{session_id}"
        self.redis.delete(key)