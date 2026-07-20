import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/krita")
    
    # Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Ollama
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "tinyllama")
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    
    # RAG
    TOP_K_CHUNKS = int(os.getenv("TOP_K_CHUNKS", 5))
    MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", 2048))
    CACHE_TTL = int(os.getenv("CACHE_TTL", 3600))
    
    # API
    API_HOST = os.getenv("API_HOST", "0.0.0.0")
    API_PORT = int(os.getenv("API_PORT", 8000))

settings = Settings()