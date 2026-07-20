import asyncio
from datetime import datetime, timedelta
from backend.api.medrxiv_scraper import MedRxivScraper
from backend.app.database import AsyncSessionLocal

async def main():
    # Define date range: last 7 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    async with AsyncSessionLocal() as session:
        scraper = MedRxivScraper(session)
        count = await scraper.scrape(start_date=start_str, end_date=end_str)
        print(f"Processed {count} papers")

if __name__ == "__main__":
    asyncio.run(main())
