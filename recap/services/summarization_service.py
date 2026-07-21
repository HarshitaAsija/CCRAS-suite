from transformers import BartTokenizer, BartForConditionalGeneration
import torch

class SummarizationService:
    def __init__(self):
        self.model_name = "facebook/bart-large-cnn"
        self.tokenizer = BartTokenizer.from_pretrained(self.model_name)
        self.model = BartForConditionalGeneration.from_pretrained(self.model_name)

    def summarize_single(self, text: str) -> str:
        """
        Summarize the input text using BART model.

        Args:
            text: Input text to summarize (abstract + full_text)

        Returns:
            Summary string
        """
        # Tokenize input
        inputs = self.tokenizer.encode(
            text,
            return_tensors="pt",
            max_length=1024,
            truncation=True
        )

        # Generate summary
        summary_ids = self.model.generate(
            inputs,
            max_length=150,
            min_length=40,
            length_penalty=2.0,
            num_beams=4,
            early_stopping=True
        )

        # Decode and return summary
        summary = self.tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary