# Test the PubMed fetcher implementation
import asyncio
from pubmed_fetcher import PubMedFetcher, RawPaper, search_and_fetch_pubmed

async def test_pubmed_fetcher():
    # Test the PubMed fetcher
    print("Testing PubMed fetcher...")

    # Initialize the fetcher
    fetcher = PubMedFetcher()

    # Test searching for PMIDs
    print("Searching for 'machine learning'...")
    pmids = await fetcher.search_pubmed("machine learning", 10)
    print(f"Found {len(pmids)} PMIDs: {pmids[:5]}...")

    # Test the dataclass
    paper = RawPaper(
        pmid="12345678",
        title="Test Paper",
        abstract="This is a test abstract.",
        authors=["Test Author"],
        doi="10.1000/test.doi",
        publish_date="2023-01-01"
    )
    print(f"Created test paper: {paper.title}")

if __name__ == "__main__":
    asyncio.run(test_pubmed_fetcher())