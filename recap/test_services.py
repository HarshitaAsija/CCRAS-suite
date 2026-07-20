import asyncio
from app.config import settings
from app.services.redis_service import RedisService
from app.services.ollama_service import OllamaService

async def test_services():
    print("=" * 50)
    print("Testing Services...")
    print("=" * 50)
    
    print(f"\n📝 Configuration:")
    print(f"  OLLAMA_MODEL: {settings.OLLAMA_MODEL}")
    print(f"  REDIS_URL: {settings.REDIS_URL}")
    
    # Test Redis
    print("\n🔴 Testing Redis...")
    redis = RedisService(settings.REDIS_URL)
    if redis.is_available():
        print("  ✅ Redis is working!")
        # Test set/get
        test_session = "test_session"
        test_messages = [{"role": "user", "content": "Hello"}]
        redis.update_conversation(test_session, test_messages)
        retrieved = redis.get_conversation(test_session)
        print(f"  ✅ Retrieved: {retrieved}")
        redis.clear_conversation(test_session)
        print("  ✅ Conversation cleared")
    else:
        print("  ❌ Redis not working. Make sure redis-server is running")
    
    # Test Ollama
    print("\n🤖 Testing Ollama...")
    ollama = OllamaService(settings.OLLAMA_MODEL)
    print(f"  Model: {ollama.current_model}")
    
    # List models
    models = ollama.list_models()
    print(f"  Available models: {models}")
    
    # Test generation
    try:
        print("  Generating test response...")
        response = ollama.generate("What is 2+2? Answer briefly.")
        print(f"  ✅ Response: {response[:100]}...")
        print("  ✅ Ollama is working!")
    except Exception as e:
        print(f"  ❌ Ollama error: {e}")
    
    print("\n" + "=" * 50)
    print("✅ All tests complete!")

if __name__ == "__main__":
    asyncio.run(test_services())