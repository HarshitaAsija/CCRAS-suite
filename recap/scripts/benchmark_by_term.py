"""
Diagnostic follow-up to benchmark.py — isolates latency PER QUERY TERM
instead of lumping all terms together, to confirm whether BM25's high
p95/p99 is caused by one or two expensive (high-match-count) terms
rather than a general concurrency/pooling problem.

Usage:
    python3 benchmark_by_term.py
"""

import asyncio
import time
import statistics
import httpx

BASE_URL = "http://localhost:8000/api"
CONCURRENCY = 5
REQUESTS_PER_TERM = 10

QUERIES = ["diabetes", "ayurveda", "cancer", "inflammation", "wound healing"]


async def timed_request(client: httpx.AsyncClient, url: str):
    start = time.perf_counter()
    try:
        resp = await client.get(url, timeout=30.0)
        elapsed_ms = (time.perf_counter() - start) * 1000
        total = None
        if resp.status_code == 200:
            try:
                total = resp.json().get("total")
            except Exception:
                pass
        return elapsed_ms, resp.status_code, total
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        return elapsed_ms, -1, None


async def benchmark_term(client: httpx.AsyncClient, term: str):
    url = f"{BASE_URL}/papers/search?q={term}&limit=20"
    sem = asyncio.Semaphore(CONCURRENCY)
    latencies = []
    totals = []

    async def bounded():
        async with sem:
            elapsed_ms, status, total = await timed_request(client, url)
            latencies.append(elapsed_ms)
            if total is not None:
                totals.append(total)

    await asyncio.gather(*(bounded() for _ in range(REQUESTS_PER_TERM)))

    latencies.sort()
    match_count = totals[0] if totals else "?"
    print(f"\n  '{term}'  (matches {match_count} papers)")
    print(f"    mean: {statistics.mean(latencies):.1f} ms   "
          f"min: {min(latencies):.1f} ms   max: {max(latencies):.1f} ms")


async def main():
    print(f"Isolating per-term BM25 latency against {BASE_URL}")
    print(f"Concurrency: {CONCURRENCY} | Requests per term: {REQUESTS_PER_TERM}")
    async with httpx.AsyncClient() as client:
        for term in QUERIES:
            await benchmark_term(client, term)


if __name__ == "__main__":
    asyncio.run(main())
