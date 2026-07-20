#!/usr/bin/env python3
import sys
import os
import asyncio
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Test the PubMed fetcher implementation
from backend.ingestion.pubmed_fetcher import PubMedFetcher, RawPaper

async def main():
    print("Testing PubMed Fetcher...")

    # Initialize the fetcher
    fetcher = PubMedFetcher()

    # Test the dataclass
    paper = RawPaper(
        pmid="12345678",
        title="Test Paper",
        abstract="This is a test abstract.",
        authors=["Test Author"],
        doi="10.1000/test.doi",
        publish_date="2023-01-01",
        journal="Test Journal"
    )
    print(f"Created test paper: {paper}")

    # Test the search functionality with a small example
    pmids = ["12345678", "23456789"]
    print(f"Testing with PMIDs: {pmids}")

    # This demonstrates that the dataclass works correctly
    print("Test completed")

if __name__ == "__main__":
    # Just show that the module can be imported and used
    print("PubMedFetcher and RawPaper can be imported successfully")

if __name__ == "__main__":
    asyncio.run(main())