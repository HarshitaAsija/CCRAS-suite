import ollama
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class OllamaService:
    def __init__(self, model_name: str = "tinyllama"):
        self.models = {
            "tinyllama": "tinyllama",
            "llama3.2": "llama3.2:latest",
            "llama3.1": "llama3.1:latest"
        }
        self.current_model = self.models.get(model_name, "tinyllama")
        logger.info(f"🤖 Ollama using model: {self.current_model}")
    
    def switch_model(self, model_name: str) -> bool:
        if model_name in self.models:
            self.current_model = self.models[model_name]
            logger.info(f"🔄 Switched to: {self.current_model}")
            return True
        logger.warning(f"❌ Model {model_name} not found")
        return False
    
    def generate(self, prompt: str, system_prompt: str = None, **kwargs) -> str:
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            response = ollama.chat(
                model=self.current_model,
                messages=messages,
                options={
                    "temperature": kwargs.get("temperature", 0.7),
                    "top_p": kwargs.get("top_p", 0.9),
                    "num_predict": kwargs.get("max_tokens", 2048)
                }
            )
            return response['message']['content']
        except Exception as e:
            logger.error(f"❌ Ollama error: {e}")
            return f"Error: {str(e)}"
    
    def list_models(self) -> List[str]:
        try:
            response = ollama.list()
            return [model['name'] for model in response.get('models', [])]
        except Exception as e:
            logger.error(f"❌ Error listing models: {e}")
            return []