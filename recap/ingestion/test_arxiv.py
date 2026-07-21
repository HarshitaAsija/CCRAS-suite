#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Test the arXiv fetcher implementation
from backend.ingestion.arxiv_fetcher import ArxivFetcher, RawPaper

def main():
    print("Testing arXiv Fetcher...")

    # Test the dataclass
    paper = RawPaper(
        arxiv_id="test.12345",
        title="Test arXiv Paper",
        abstract="This is a test abstract.",
        authors=["Test Author"],
        doi=None,
        publish_date="2023-01-01",
        journal="arXiv"
    )
    print(f"Created test paper: {paper}")

    # Test the fetcher class
    fetcher = ArxivFetcher()
    print("arXivFetcher and RawPaper can be imported successfully")

    print("Test completed")

if __name__ == "__main__":
    main()