"""
Task 2.10 — Relevance tuning for KRITA search endpoints.

This does NOT auto-determine relevance — no tool can know which papers
are "correct" for a query without a human judging them. What this script
does is give you a repeatable way to compare BM25 vs semantic vs hybrid
against judgments YOU provide, so you can see which method (or which RRF
k value) surfaces the papers you'd expect near the top.

Workflow:
  1. Pick 5-10 queries that matter for your use case (already started below).
  2. For each query, run it once, eyeball the top ~10 results, and note
     the DOIs of papers that are genuinely relevant. Paste those DOIs into
     RELEVANCE_JUDGMENTS below.
  3. Re-run this script. It reports precision@5 and precision@10 for each
     method on each query, plus an overall average — so you can see which
     method actually performs best on YOUR data, not in the abstract.
  4. If hybrid underperforms bm25 or semantic alone, try adjusting the RRF
     k constant in search_papers_hybrid (currently k=60 — lower k weights
     top-ranked results more heavily, higher k flattens the influence of
     rank position) and re-run to compare.

Usage:
    pip install httpx --break-system-packages
    python3 relevance_eval.py
"""

import asyncio
import httpx

BASE_URL = "http://localhost:8000/api"

# Step 1: fill this in with real judgments after eyeballing results.
# Leave a query's DOI list empty and the script will skip scoring it
# (but still print raw results so you can judge them).
RELEVANCE_JUDGMENTS: dict[str, list[str]] = {
    "diabetic foot ulcer": [
        "10.1038/s41598-026-61198-y",
        "10.1086/424846",
        "10.1016/j.explore.2026.103352",
        "10.1016/j.avsg.2026.06.042",
    ],
    "ayurveda diabetes": [
        "10.1016/j.jaim.2021.05.009",
        "10.21760/jaims.v2i4.9364",
        "10.3389/fphar.2021.662000",
        "10.21760/jaims.9.3.31",
        "10.37648/medinity2025.026",
        "10.1016/s2213-8587(16)30238-8",
        "10.1055/s-2008-1044008",
        "10.1016/s2213-8587(16)30239-x",
        "10.7897/2277-4343.055127",
        "10.33545/ayurveda.2026.v3.i1.a.39",
        "10.69758/gimrj/2505i5vxiiip0051",
        "10.7897/2277-4343.0716",
        "10.1177/20420188261417088",
    ],
    "wound healing": [
        "10.1016/j.jaim.2019.09.002",
        "10.53555/pnvycd12",
        "10.1002/adma.73965",
        "10.1056/nejm199605093341901",
        "10.1186/s12879-026-13947-7",
        "10.1016/j.retram.2026.103599",
        "10.1086/501620",
        "10.1017/s0195941700015241",
        "10.2307/30148464",
        "10.1016/j.carbpol.2012.07.071",
        "10.1128/cmr.19.2.403-434.2006",
    ],
}

METHODS = {
    "bm25":     lambda q: f"{BASE_URL}/papers/search?q={q}&limit=10",
    "semantic": lambda q: f"{BASE_URL}/papers/search/semantic?q={q}&limit=10",
    "hybrid":   lambda q: f"{BASE_URL}/papers/search/hybrid?q={q}&limit=10",
}


async def fetch_dois(client: httpx.AsyncClient, url: str) -> list[str]:
    resp = await client.get(url, timeout=30.0)
    resp.raise_for_status()
    data = resp.json()
    return [r.get("doi", "") for r in data.get("results", [])]


def precision_at_k(ranked_dois: list[str], relevant_dois: set[str], k: int) -> float:
    if not relevant_dois:
        return float("nan")
    top_k = ranked_dois[:k]
    hits = sum(1 for d in top_k if d in relevant_dois)
    return hits / k


async def evaluate_query(client: httpx.AsyncClient, query: str, relevant: list[str]):
    relevant_set = set(relevant)
    print(f"\n--- Query: '{query}' ---")
    for method_name, url_fn in METHODS.items():
        dois = await fetch_dois(client, url_fn(query))
        if relevant_set:
            p5 = precision_at_k(dois, relevant_set, 5)
            p10 = precision_at_k(dois, relevant_set, 10)
            print(f"  {method_name:10s}  P@5={p5:.2f}  P@10={p10:.2f}  top_dois={dois[:5]}")
        else:
            print(f"  {method_name:10s}  (no judgments yet) top_dois={dois[:5]}")


async def main():
    async with httpx.AsyncClient() as client:
        for query, relevant in RELEVANCE_JUDGMENTS.items():
            await evaluate_query(client, query, relevant)

    unjudged = [q for q, r in RELEVANCE_JUDGMENTS.items() if not r]
    if unjudged:
        print(f"\nNote: {len(unjudged)} quer{'y has' if len(unjudged)==1 else 'ies have'} "
              f"no relevance judgments yet ({unjudged}). Precision scores were skipped "
              f"for those — review the printed DOIs, decide which are relevant, and "
              f"paste them into RELEVANCE_JUDGMENTS to get real scores.")


if __name__ == "__main__":
    asyncio.run(main())
