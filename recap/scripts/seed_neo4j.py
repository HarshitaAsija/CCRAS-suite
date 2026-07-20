#!/usr/bin/env python3
"""
Seed Neo4j graph database with papers from Supabase.
Creates Paper, Author, Keyword nodes and WROTE, HAS_KEYWORD relationships.
"""

import os
import json
from dotenv import load_dotenv
import psycopg2
from neo4j import GraphDatabase

load_dotenv()

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

BATCH_SIZE = 50


def parse_json_field(value):
    """
    Parse JSON field that may be string, list, or None.
    Returns list of values, or empty list if unparseable.
    """
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
            return [parsed] if parsed else []
        except json.JSONDecodeError:
            return []
    return []


def extract_author_names(authors_data):
    """
    Extract author names from authors field.
    Handles: list of strings, list of dicts with 'name' key, None, malformed.
    Returns list of non-empty string names.
    """
    names = []
    for item in authors_data:
        if isinstance(item, str):
            name = item.strip()
            if name:
                names.append(name)
        elif isinstance(item, dict):
            # Try common keys for author name
            name = item.get("name") or item.get("author") or item.get("full_name")
            if isinstance(name, str):
                name = name.strip()
                if name:
                    names.append(name)
    return names


def extract_keywords(keywords_data):
    """
    Extract keywords from keywords field.
    Handles: list of strings, None, malformed.
    Returns list of non-empty, lowercased keyword strings.
    """
    keywords = []
    for kw in keywords_data:
        if isinstance(kw, str):
            kw = kw.strip().lower()
            if kw:
                keywords.append(kw)
    return keywords


def seed_neo4j():
    """Main seeding function."""
    # Connect to Supabase
    print("Connecting to Supabase...")
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    # Fetch all papers with DOI
    print("Fetching papers from Supabase...")
    cursor.execute("""
        SELECT doi, title, authors, keywords, journal
        FROM papers
        WHERE doi IS NOT NULL
    """)
    papers = cursor.fetchall()
    total_papers = len(papers)
    print(f"Found {total_papers} papers with DOI")

    cursor.close()
    conn.close()

    # Connect to Neo4j
    print(f"Connecting to Neo4j at {NEO4J_URI}...")
    driver = GraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USER, NEO4J_PASSWORD)
    )

    def process_batch(tx, batch):
        """Process a batch of papers in a single transaction."""
        for doi, title, authors_raw, keywords_raw, journal in batch:
            # MERGE Paper node
            tx.run("""
                MERGE (p:Paper {doi: $doi})
                SET p.title = $title,
                    p.journal = $journal
            """, doi=doi, title=title, journal=journal)

            # Process authors
            authors_list = parse_json_field(authors_raw)
            author_names = extract_author_names(authors_list)
            for author_name in author_names:
                tx.run("""
                    MERGE (a:Author {name: $name})
                    WITH a
                    MATCH (p:Paper {doi: $doi})
                    MERGE (a)-[:WROTE]->(p)
                """, name=author_name, doi=doi)

            # Process keywords
            keywords_list = parse_json_field(keywords_raw)
            keywords = extract_keywords(keywords_list)
            for keyword in keywords:
                tx.run("""
                    MERGE (k:Keyword {name: $name})
                    WITH k
                    MATCH (p:Paper {doi: $doi})
                    MERGE (p)-[:HAS_KEYWORD]->(k)
                """, name=keyword, doi=doi)

    # Process papers in batches
    print(f"Processing in batches of {BATCH_SIZE}...")
    with driver.session() as session:
        for i in range(0, total_papers, BATCH_SIZE):
            batch = papers[i:i + BATCH_SIZE]
            session.execute_write(process_batch, batch)
            processed = min(i + BATCH_SIZE, total_papers)
            print(f"Processed {processed}/{total_papers} papers")

    # Get counts
    print("\nQuerying graph statistics...")
    with driver.session() as session:
        paper_count = session.run("MATCH (p:Paper) RETURN count(p) as count").single()["count"]
        author_count = session.run("MATCH (a:Author) RETURN count(a) as count").single()["count"]
        keyword_count = session.run("MATCH (k:Keyword) RETURN count(k) as count").single()["count"]
        wrote_count = session.run("MATCH ()-[r:WROTE]->() RETURN count(r) as count").single()["count"]
        has_keyword_count = session.run("MATCH ()-[r:HAS_KEYWORD]->() RETURN count(r) as count").single()["count"]

    print(f"\n=== Graph Statistics ===")
    print(f"Total Paper nodes: {paper_count}")
    print(f"Total Author nodes: {author_count}")
    print(f"Total Keyword nodes: {keyword_count}")
    print(f"Total WROTE relationships: {wrote_count}")
    print(f"Total HAS_KEYWORD relationships: {has_keyword_count}")

    driver.close()
    print("\nSeeding complete!")


if __name__ == "__main__":
    seed_neo4j()