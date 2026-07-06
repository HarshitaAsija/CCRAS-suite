# config.py
# Single source of truth for DB + Ollama config.
# Defaults work for the shared team server.
# Override with environment variables if needed.
import os

DB_CONFIG = {
    "host":     os.environ.get("CCRAS_DB_HOST",     "100.101.210.91"),
    "port":     int(os.environ.get("CCRAS_DB_PORT", "5432")),
    "database": os.environ.get("CCRAS_DB_NAME",     "ccras_db"),
    "user":     os.environ.get("CCRAS_DB_USER",     "anshika"),
    "password": os.environ.get("CCRAS_DB_PASSWORD", "anshi_123"),
}

OLLAMA_GENERATE_URL     = os.environ.get("OLLAMA_URL",         "http://localhost:11434/api/generate")
OLLAMA_EMBED_URL        = os.environ.get("OLLAMA_EMBED_URL",   "http://localhost:11434/api/embeddings")
OLLAMA_MODEL            = os.environ.get("OLLAMA_MODEL",       "mistral")
OLLAMA_EMBED_MODEL      = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OLLAMA_GENERATE_TIMEOUT = int(os.environ.get("OLLAMA_GENERATE_TIMEOUT", "300"))
OLLAMA_EMBED_TIMEOUT    = int(os.environ.get("OLLAMA_EMBED_TIMEOUT", "120"))