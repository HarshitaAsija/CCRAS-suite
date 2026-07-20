#!/usr/bin/env python3
"""
Fetch backward references, forward citations, and journal names for papers.
Populates paper_references, citations, and journal columns in Supabase papers table.
"""

import os
import sys
import time
import json
import requests
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import Json
from urllib.parse import quote
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env")
    sys.exit(1)

# Rate limiting (seconds between API calls)
RATE_LIMIT_CROSSREF = 0.5
RATE_LIMIT_EPMC = 0.5
RATE_LIMIT_ICITE = 1.0
RATE_LIMIT_S2 = 1.5
RATE_LIMIT_OPENALEX = 0.2
RATE_LIMIT_OPENCITATIONS = 1.0

# Endpoints
CROSSREF_URL = "https://api.crossref.org/works/{doi}"
EPMC_SEARCH_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
EPMC_REF_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/{db}/{id}/references"
ICITE_URL = "https://icite.od.nih.gov/api/pubs"
S2_URL = "https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}"
OPENALEX_WORK_URL = "https://api.openalex.org/works/https://doi.org/{doi}"
OPENALEX_WORKS_URL = "https://api.openalex.org/works"
OPENCITATIONS_REFS_URL = "https://opencitations.net/index/coci/api/v1/references/{doi}"
OPENCITATIONS_CITES_URL = "https://opencitations.net/index/coci/api/v1/citations/{doi}"


def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(DATABASE_URL)


def get_papers_to_process(conn):
    """Fetch all papers that need citation data."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, doi, source
            FROM papers
            WHERE doi IS NOT NULL
              AND (citations = '[]'::jsonb OR journal IS NULL)
        """)
        return cur.fetchall()


def fetch_crossref(doi):
    """
    Fetch from CrossRef.
    Returns: (backward_dois, journal)
    """
    try:
        url = CROSSREF_URL.format(doi=quote(doi, safe=''))
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return [], None

        data = resp.json()
        if data.get("status") != "ok" or "message" not in data:
            return [], None

        message = data["message"]

        backward_dois = []
        refs = message.get("reference", [])
        for ref in refs:
            ref_doi = ref.get("DOI")
            if ref_doi:
                backward_dois.append(ref_doi.lower().strip())

        journal = None
        container_titles = message.get("container-title", [])
        if container_titles:
            journal = container_titles[0]

        return backward_dois, journal

    except Exception as e:
        print(f"  CrossRef error for {doi}: {e}")
        return [], None


def fetch_epmc_search(doi):
    """
    Search Europe PMC by DOI to get PMID.
    Returns: pmid or None
    """
    try:
        params = {
            "query": f"DOI:{doi}",
            "resultType": "core",
            "format": "json"
        }
        resp = requests.get(EPMC_SEARCH_URL, params=params, timeout=10)
        if resp.status_code != 200:
            return None

        data = resp.json()
        result_list = data.get("resultList", {})
        results = result_list.get("result", [])

        if not results:
            return None

        result = results[0]
        pmid = result.get("pmid")
        return pmid

    except Exception as e:
        print(f"  EPMC search error for {doi}: {e}")
        return None


def fetch_epmc_references(pmid):
    """
    Fetch references from Europe PMC using PMID.
    Returns: (backward_dois, backward_pmids)
    """
    if not pmid:
        return [], []

    try:
        url = EPMC_REF_URL.format(db="MED", id=pmid)
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return [], []

        data = resp.json()
        ref_list = data.get("referenceList", {})
        refs = ref_list.get("reference", [])

        backward_dois = []
        backward_pmids = []

        for ref in refs:
            ref_doi = ref.get("doi")
            if ref_doi:
                backward_dois.append(ref_doi.lower().strip())
            ref_id = ref.get("id")
            if ref_id:
                backward_pmids.append(ref_id)

        return backward_dois, backward_pmids

    except Exception as e:
        print(f"  EPMC references error for {pmid}: {e}")
        return [], []


def fetch_icite_by_doi(doi):
    """
    Fetch from NIH iCite by DOI.
    Returns: (forward_pmids, backward_pmids)
    """
    try:
        params = {
            "dois": doi,
            "fields": "doi,cited_by,references"
        }
        resp = requests.get(ICITE_URL, params=params, timeout=10)
        if resp.status_code != 200:
            return [], []

        data = resp.json()
        items = data.get("data", [])

        if not items:
            return [], []

        item = items[0]
        # Verify iCite returned the correct paper
        returned_doi = item.get("doi", "").lower().strip()
        queried_doi = doi.lower().strip()
        if returned_doi and returned_doi != queried_doi:
            print(f"  iCite DOI mismatch: queried {doi}, got {returned_doi}")
            return [], []

        forward_pmids = item.get("cited_by", [])
        backward_pmids = item.get("references", [])

        return forward_pmids, backward_pmids

    except Exception as e:
        print(f"  iCite error for {doi}: {e}")
        return [], []


def fetch_icite_by_pmids(pmids):
    """
    Fetch DOI mappings from iCite for a list of PMIDs.
    Returns: {pmid: doi}
    """
    if not pmids:
        return {}

    try:
        pmids_str = ",".join(str(p) for p in pmids[:100])
        params = {
            "pmids": pmids_str,
            "fields": "doi"
        }
        resp = requests.get(ICITE_URL, params=params, timeout=10)
        if resp.status_code != 200:
            return {}

        data = resp.json()
        items = data.get("data", [])

        doi_map = {}
        for item in items:
            doi = item.get("doi")
            pmid = item.get("pmid")
            if doi and pmid:
                doi_map[str(pmid)] = doi.lower().strip()

        return doi_map

    except Exception as e:
        print(f"  iCite PMID-to-DOI error: {e}")
        return {}


def fetch_semantic_scholar(doi):
    """
    Fetch from Semantic Scholar.
    Returns: (backward_dois, forward_dois)
    """
    try:
        url = S2_URL.format(doi=doi)
        params = {"fields": "references.externalIds,citations.externalIds"}

        while True:
            resp = requests.get(url, params=params, timeout=15)
            if resp.status_code == 429:
                print(f"  S2 rate limit hit, waiting 60s...")
                time.sleep(60)
                continue
            break

        if resp.status_code != 200:
            return [], []

        data = resp.json()

        backward_dois = []
        refs = data.get("references") or []
        for ref in refs:
            ext_ids = ref.get("externalIds") or {}
            ref_doi = ext_ids.get("DOI")
            if ref_doi:
                backward_dois.append(ref_doi.lower().strip())

        forward_dois = []
        cites = data.get("citations") or []
        for cite in cites:
            ext_ids = cite.get("externalIds") or {}
            cite_doi = ext_ids.get("DOI")
            if cite_doi:
                forward_dois.append(cite_doi.lower().strip())

        return backward_dois, forward_dois

    except Exception as e:
        print(f"  Semantic Scholar error for {doi}: {e}")
        return [], []


def fetch_openalex_citations(doi):
    """
    Fetch backward + forward citations from OpenAlex.
    Backward: referenced_works (OpenAlex IDs) resolved to DOIs via batch lookup.
    Forward: works that cite this one, via filter=cites:{openalex_id}, DOI read directly.
    Returns: (backward_dois, forward_dois)
    """
    try:
        url = OPENALEX_WORK_URL.format(doi=quote(doi, safe=''))
        resp = requests.get(url, timeout=15)
        if resp.status_code != 200:
            return [], []

        data = resp.json()
        openalex_id = data.get("id", "")  # e.g. https://openalex.org/W123456789
        referenced_works = data.get("referenced_works", []) or []

        backward_dois = []
        if referenced_works:
            # Batch-resolve referenced work IDs to DOIs, 50 at a time
            for i in range(0, len(referenced_works), 50):
                chunk = referenced_works[i:i + 50]
                short_ids = "|".join(w.split("/")[-1] for w in chunk)
                params = {"filter": f"ids.openalex:{short_ids}", "per_page": 50}
                r = requests.get(OPENALEX_WORKS_URL, params=params, timeout=15)
                if r.status_code == 200:
                    for item in r.json().get("results", []):
                        item_doi = item.get("doi")
                        if item_doi:
                            backward_dois.append(item_doi.replace("https://doi.org/", "").lower().strip())
                time.sleep(RATE_LIMIT_OPENALEX)

        forward_dois = []
        if openalex_id:
            short_id = openalex_id.split("/")[-1]
            params = {"filter": f"cites:{short_id}", "per_page": 50}
            r = requests.get(OPENALEX_WORKS_URL, params=params, timeout=15)
            if r.status_code == 200:
                for item in r.json().get("results", []):
                    item_doi = item.get("doi")
                    if item_doi:
                        forward_dois.append(item_doi.replace("https://doi.org/", "").lower().strip())

        return backward_dois, forward_dois

    except Exception as e:
        print(f"  OpenAlex citations error for {doi}: {e}")
        return [], []


def fetch_opencitations(doi):
    """
    Fetch backward + forward citations from OpenCitations (COCI).
    Returns: (backward_dois, forward_dois)
    """
    backward_dois = []
    forward_dois = []

    try:
        url = OPENCITATIONS_REFS_URL.format(doi=quote(doi, safe=''))
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            for item in resp.json():
                cited = item.get("cited")
                if cited:
                    backward_dois.append(cited.lower().strip())
    except Exception as e:
        print(f"  OpenCitations references error for {doi}: {e}")

    time.sleep(RATE_LIMIT_OPENCITATIONS)

    try:
        url = OPENCITATIONS_CITES_URL.format(doi=quote(doi, safe=''))
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            for item in resp.json():
                citing = item.get("citing")
                if citing:
                    forward_dois.append(citing.lower().strip())
    except Exception as e:
        print(f"  OpenCitations citations error for {doi}: {e}")

    return backward_dois, forward_dois


def process_paper(paper_id, doi, source):
    """
    Process a single paper through all citation sources.
    Returns: (backward_dois, forward_dois, journal)
    """
    all_backward_dois = set()
    all_forward_dois = set()
    journal = None

    # ===== BACKWARD CITATIONS =====

    # 1. Try CrossRef first
    crossref_dois, crossref_journal = fetch_crossref(doi)
    all_backward_dois.update(crossref_dois)
    if crossref_journal and not journal:
        journal = crossref_journal

    if crossref_dois:
        time.sleep(RATE_LIMIT_CROSSREF)
    else:
        # 2. Try Europe PMC if CrossRef returned 0
        time.sleep(RATE_LIMIT_CROSSREF)
        epmc_dois, epmc_pmids = [], []
        epmc_pmid = fetch_epmc_search(doi)
        if epmc_pmid:
            time.sleep(RATE_LIMIT_EPMC)
            epmc_dois, epmc_pmids = fetch_epmc_references(epmc_pmid)
            all_backward_dois.update(epmc_dois)
            # Note: PMIDs intentionally excluded — only real DOIs stored

        if epmc_dois:
            time.sleep(RATE_LIMIT_EPMC)
        if not all_backward_dois:
            # 3. Try NIH iCite references
            time.sleep(RATE_LIMIT_EPMC)
            forward_pmids, backward_pmids = fetch_icite_by_doi(doi)
            if backward_pmids:
                id_map = fetch_icite_by_pmids(backward_pmids)
                for pmid_val in backward_pmids:
                    mapped_doi = id_map.get(str(pmid_val))
                    if mapped_doi:  # Only store if we have a real DOI
                        all_backward_dois.add(mapped_doi)
                time.sleep(RATE_LIMIT_ICITE)

    # 4. Semantic Scholar for all papers (best coverage)
    s2_backward, s2_forward_early = fetch_semantic_scholar(doi)
    all_backward_dois.update(s2_backward)
    # Store S2 forward here too so we don't call S2 twice
    all_forward_dois.update(s2_forward_early)
    if s2_backward or s2_forward_early:
        time.sleep(RATE_LIMIT_S2)

    # 5. OpenAlex (backward + forward in one pass)
    oa_backward, oa_forward = fetch_openalex_citations(doi)
    all_backward_dois.update(oa_backward)
    all_forward_dois.update(oa_forward)
    if oa_backward or oa_forward:
        time.sleep(RATE_LIMIT_OPENALEX)

    # 6. OpenCitations (backward + forward in one pass)
    oc_backward, oc_forward = fetch_opencitations(doi)
    all_backward_dois.update(oc_backward)
    all_forward_dois.update(oc_forward)

    # ===== FORWARD CITATIONS =====

    # 1. NIH iCite cited_by (only if DOI matches)
    forward_pmids, _ = fetch_icite_by_doi(doi)
    if forward_pmids:
        id_map = fetch_icite_by_pmids(forward_pmids)
        for pmid_val in forward_pmids:
            mapped_doi = id_map.get(str(pmid_val))
            if mapped_doi:  # Only store if we have a real DOI
                all_forward_dois.add(mapped_doi)
        time.sleep(RATE_LIMIT_ICITE)

    # S2 forward already collected above — no need to call again

    return list(all_backward_dois), list(all_forward_dois), journal


def update_paper(conn, paper_id, backward_dois, forward_dois, journal):
    """Update paper with citation data."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE papers
            SET paper_references = %s::jsonb,
                citations = %s::jsonb,
                journal = COALESCE(NULLIF(%s::text, ''), journal)
            WHERE id = %s
        """, (
            json.dumps(backward_dois),
            json.dumps(forward_dois),
            journal,
            paper_id
        ))
    conn.commit()


def main():
    print(f"Starting citation fetch at {datetime.now()}")
    print(f"Database: {DATABASE_URL[:30]}...")
    print()

    conn = get_db_connection()

    papers = get_papers_to_process(conn)
    total = len(papers)
    print(f"Found {total} papers to process")
    print()

    papers_with_backward = 0
    papers_with_forward = 0
    papers_with_journal = 0
    total_backward_refs = 0
    total_forward_cites = 0

    start_time = time.time()

    for i, (paper_id, doi, source) in enumerate(papers, 1):
        try:
            backward_dois, forward_dois, journal = process_paper(paper_id, doi, source)

            update_paper(conn, paper_id, backward_dois, forward_dois, journal)

            if backward_dois:
                papers_with_backward += 1
                total_backward_refs += len(backward_dois)
            if forward_dois:
                papers_with_forward += 1
                total_forward_cites += len(forward_dois)
            if journal:
                papers_with_journal += 1

            if i % 25 == 0 or i == total:
                elapsed = time.time() - start_time
                mins = elapsed / 60
                print(f"[{i}/{total}] backward: {papers_with_backward} | forward: {papers_with_forward} | journals: {papers_with_journal} ({mins:.1f}m elapsed)")

        except Exception as e:
            print(f"ERROR processing paper {paper_id} ({doi}): {e}")
            try:
                conn.rollback()
            except Exception:
                conn = get_db_connection()
            continue

    elapsed = time.time() - start_time
    print()
    print("=== DONE ===")
    print(f"Total papers processed: {total}")
    print(f"Papers with backward refs: {papers_with_backward} ({100*papers_with_backward/total:.1f}%)")
    print(f"Papers with forward citations: {papers_with_forward} ({100*papers_with_forward/total:.1f}%)")
    print(f"Papers with journal filled: {papers_with_journal} ({100*papers_with_journal/total:.1f}%)")
    print(f"Total backward refs collected: {total_backward_refs}")
    print(f"Total forward citations collected: {total_forward_cites}")
    print(f"Total time: {elapsed/60:.1f} minutes")

    conn.close()


if __name__ == "__main__":
    main()