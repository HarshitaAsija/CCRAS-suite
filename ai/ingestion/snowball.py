import asyncio
import json
import os
import sys
import httpx
import argparse
from datetime import datetime
from typing import Set, List

# Add parent directories to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from ai.ingestion.scrapers.pubmed_scraper import _fetch_batch as fetch_pubmed_batch
from ai.ingestion.scrapers.pmc_scraper import _fetch_batch as fetch_pmc_batch

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'output'))
NCBI_API_KEY = None  # Add if you have one
BASE_SEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
BASE_ELINK = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi"

async def get_initial_seed_pmids(query: str, max_results: int, client: httpx.AsyncClient) -> List[str]:
    print(f"[*] Getting initial seed PMIDs for query: '{query}'")
    params = {
        "db": "pubmed", "term": query,
        "retmax": max_results, "retmode": "json",
        "sort": "relevance"
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY
    
    try:
        resp = await client.get(BASE_SEARCH, params=params)
        resp.raise_for_status()
        ids = resp.json().get("esearchresult", {}).get("idlist", [])
        print(f"[*] Found {len(ids)} initial PMIDs")
        return ids
    except Exception as e:
        print(f"[!] Error getting seed PMIDs: {e}")
        return []

async def get_cited_and_related_pmids(pmid: str, client: httpx.AsyncClient) -> List[str]:
    # Use ELink to get related articles (pubmed_pubmed) and cited articles (pubmed_pubmed_refs)
    params = {
        "dbfrom": "pubmed",
        "db": "pubmed",
        "id": pmid,
        "retmode": "json",
        "cmd": "neighbor" # Gets all linked records
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY
        
    try:
        resp = await client.get(BASE_ELINK, params=params)
        resp.raise_for_status()
        data = resp.json()
        linked_ids = []
        if "linksets" in data and data["linksets"]:
            linkset = data["linksets"][0]
            if "linksetdbs" in linkset:
                for db in linkset["linksetdbs"]:
                    # Look for related, cited, and citing articles
                    if db["linkname"] in ["pubmed_pubmed", "pubmed_pubmed_refs", "pubmed_pubmed_citedin"]:
                        linked_ids.extend([str(link["id"]) for link in db.get("links", [])])
        return list(set(linked_ids))
    except Exception as e:
        # print(f"[!] ELink error for PMID {pmid}: {e}")
        return []

async def run_snowballing(target_count: int, seed_query: str):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"==================================================")
    print(f"  BRAHMA SNOWBALLING PIPELINE")
    print(f"  Target: {target_count} papers")
    print(f"  Seed Query: {seed_query}")
    print(f"  Output Dir: {OUTPUT_DIR}")
    print(f"==================================================")

    visited_pmids: Set[str] = set()
    saved_count = 0
    queue: List[str] = []

    # Count already saved to avoid duplicates and resume
    for f in os.listdir(OUTPUT_DIR):
        if f.startswith("pubmed_") and f.endswith(".json"):
            pmid = f.replace("pubmed_", "").replace(".json", "")
            visited_pmids.add(pmid)
            saved_count += 1
            
    print(f"[*] Found {saved_count} papers already in output dir.")
    
    if saved_count >= target_count:
        print("[*] Target already reached. Exiting.")
        return

    delay = 0.12 if NCBI_API_KEY else 0.35

    async with httpx.AsyncClient(timeout=30) as client:
        # 1. Get initial seeds
        seeds = await get_initial_seed_pmids(seed_query, 50, client)
        for seed in seeds:
            if seed not in visited_pmids:
                queue.append(seed)
                
        print(f"[*] Queue initialized with {len(queue)} PMIDs")

        batch_size = 50

        # 2. Snowball loop
        while queue and saved_count < target_count:
            # Take a batch from queue
            current_batch = queue[:batch_size]
            queue = queue[batch_size:]
            
            # Fetch batch details
            print(f"\n[*] Fetching batch of {len(current_batch)} papers (Saved: {saved_count}/{target_count})")
            papers = await fetch_pubmed_batch(current_batch, client)
            
            for paper in papers:
                pmid = paper.get("pmid")
                if not pmid or not paper.get("title"):
                    continue
                    
                safe_id = f"pubmed_{pmid}"
                out_path = os.path.join(OUTPUT_DIR, f"{safe_id}.json")
                
                if not os.path.exists(out_path):
                    with open(out_path, "w", encoding="utf-8") as f:
                        json.dump(paper, f, indent=2, ensure_ascii=False)
                    saved_count += 1
                    visited_pmids.add(pmid)
                    print(f"  [SAVED] {safe_id}.json | {paper['title'][:60]}")
                
                if saved_count >= target_count:
                    break

            # If we need more papers, expand using ELink (Snowballing)
            if saved_count < target_count:
                print(f"[*] Expanding network from batch... (Queue size: {len(queue)})")
                
                # Get related/cited PMIDs for a subset of the batch to grow queue
                # We don't want to expand all 50 to avoid API rate limits, maybe pick top 5
                expand_candidates = current_batch[:5] 
                
                tasks = [get_cited_and_related_pmids(pmid, client) for pmid in expand_candidates]
                results = await asyncio.gather(*tasks)
                
                new_discoveries = 0
                for linked_pmids in results:
                    for l_pmid in linked_pmids:
                        if l_pmid not in visited_pmids and l_pmid not in queue:
                            queue.append(l_pmid)
                            new_discoveries += 1
                            
                print(f"[*] Discovered {new_discoveries} new linked papers. New queue size: {len(queue)}")
            
            await asyncio.sleep(delay)

    print(f"\n==================================================")
    print(f"  SNOWBALLING COMPLETE")
    print(f"  Total papers saved: {saved_count}")
    print(f"==================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Snowball literature ingestion")
    parser.add_argument("--query", type=str, default="Ayurvedic medicine traditional", help="Initial search query")
    parser.add_argument("--target", type=int, default=5000, help="Target number of papers")
    args = parser.parse_args()
    
    asyncio.run(run_snowballing(args.target, args.query))
