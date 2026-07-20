"""
Diagnostic v2 — same as benchmark.py but:
  1. Reports the ACTUAL exception on any failed request (instead of
     just counting it), so we can tell a genuine timeout apart from
     a connection error or a server-side exception.
  2. Prints CPU core count available on this machine, since embedding
     computation is CPU-bound and core count directly caps how much
     concurrent semantic/hybrid throughput is physically possible.
  3. Waits 2s between endpoint batches, so fire-and-forget background
     tasks (the asyncio.create_task(_log_search(...)) calls) from one
     endpoint's 50 requests have time to finish before the next
     endpoint's test starts — avoiding cross-test contamination.

Usage:
    python3 benchmark_v2.py
"""

import asyncio
import os
import time
import statistics
import httpx

BASE_URL = "http://localhost:8000/api"
CONCURRENCY = 3
REQUESTS_PER_ENDPOINT = 15
PAUSE_BETWEEN_ENDPOINTS_SEC = 3

QUERIES = ["diabetes", "ayurveda", "cancer", "inflammation", "wound healing"]

ENDPOINTS = [
    ("BM25 search",      lambda q: f"{BASE_URL}/papers/search?q={q}&limit=20"),
    ("Semantic search",  lambda q: f"{BASE_URL}/papers/search/semantic?q={q}&limit=20"),
    ("Hybrid search",    lambda q: f"{BASE_URL}/papers/search/hybrid?q={q}&limit=20"),
    ("Suggestions",      lambda q: f"{BASE_URL}/papers/search/suggest?q={q[:4]}&limit=5"),
]


async def timed_request(client: httpx.AsyncClient, url: str):
    start = time.perf_counter()
    try:
        resp = await client.get(url, timeout=30.0)
        elapsed_ms = (time.perf_counter() - start) * 1000
        if resp.status_code != 200:
            # Capture the actual FastAPI error detail, not just the status code
            try:
                body = resp.json()
                detail = body.get("detail", resp.text[:300])
            except Exception:
                detail = resp.text[:300]
            return elapsed_ms, resp.status_code, f"HTTP {resp.status_code}: {detail}"
        return elapsed_ms, resp.status_code, None
    except Exception as e:
        elapsed_ms = (time.perf_counter() - start) * 1000
        return elapsed_ms, -1, f"{type(e).__name__}: {e}"


async def run_endpoint_benchmark(name: str, url_fn):
    latencies = []
    errors = 0
    error_details = []
    sem = asyncio.Semaphore(CONCURRENCY)

    async with httpx.AsyncClient() as client:
        async def bounded_request(url: str):
            nonlocal errors
            async with sem:
                elapsed_ms, status, err = await timed_request(client, url)
                if status != 200:
                    errors += 1
                    if err:
                        error_details.append(err)
                    else:
                        error_details.append(f"HTTP {status}")
                latencies.append(elapsed_ms)

        urls = [url_fn(QUERIES[i % len(QUERIES)]) for i in range(REQUESTS_PER_ENDPOINT)]
        wall_start = time.perf_counter()
        await asyncio.gather(*(bounded_request(u) for u in urls))
        wall_elapsed = time.perf_counter() - wall_start

    latencies.sort()
    n = len(latencies)
    p50 = latencies[int(n * 0.50)]
    p95 = latencies[int(n * 0.95) - 1] if n >= 20 else max(latencies)
    p99 = latencies[int(n * 0.99) - 1] if n >= 100 else max(latencies)
    throughput = REQUESTS_PER_ENDPOINT / wall_elapsed

    print(f"\n=== {name} ===")
    print(f"  requests:        {REQUESTS_PER_ENDPOINT} (concurrency={CONCURRENCY})")
    print(f"  errors/timeouts: {errors}")
    if error_details:
        print(f"  error details:   {error_details[:5]}")  # first 5 unique-ish samples
    print(f"  wall time:       {wall_elapsed:.2f}s")
    print(f"  throughput:      {throughput:.1f} req/s")
    print(f"  latency mean:    {statistics.mean(latencies):.1f} ms")
    print(f"  latency p50:     {p50:.1f} ms")
    print(f"  latency p95:     {p95:.1f} ms")
    print(f"  latency p99:     {p99:.1f} ms")
    print(f"  latency min/max: {min(latencies):.1f} / {max(latencies):.1f} ms")


async def main():
    print(f"Benchmarking against {BASE_URL}")
    print(f"CPU cores available on this machine: {os.cpu_count()}")
    print(f"Concurrency: {CONCURRENCY} | Requests per endpoint: {REQUESTS_PER_ENDPOINT}")
    for i, (name, url_fn) in enumerate(ENDPOINTS):
        await run_endpoint_benchmark(name, url_fn)
        if i < len(ENDPOINTS) - 1:
            await asyncio.sleep(PAUSE_BETWEEN_ENDPOINTS_SEC)


if __name__ == "__main__":
    asyncio.run(main())