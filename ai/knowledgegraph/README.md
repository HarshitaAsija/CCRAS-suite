# RishiAI Knowledge Graph — Setup Guide

## File Structure
```
rishiai_kg/
├── knowledge_graph.py   ← full pipeline (embed → PG → normalize → Neo4j)
├── api.py               ← FastAPI server
├── frontend_demo.html   ← Cytoscape visualization
├── requirements.txt
└── .env.example         ← copy to .env and fill in your values
```

---

## Step 1 — Neo4j via Docker

```bash
docker run -d \
  --name neo4j-rishiai \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your_neo4j_password \
  neo4j:5
```

Open http://localhost:7474 to verify it's running.
Login: neo4j / your_neo4j_password

---

## Step 2 — Python environment

```bash
cd rishiai_kg
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## Step 3 — Configure .env

```bash
cp .env.example .env
# Edit .env — fill in PG_DSN and NEO4J_PASSWORD
```

Your PG_DSN from DBngin looks like:
```
postgresql://postgres:@localhost:5432/ccras_db
```

---

## Step 4 — Test the pipeline directly

```bash
python knowledge_graph.py
```

Expected output:
```json
{
  "nodes": 87,
  "edges": 203,
  "sample_nodes": ["ashwagandha", "adaptogen", "stress", ...]
}
```

---

## Step 5 — Start the API

```bash
uvicorn api:app --reload --port 8000
```

Test it:
```bash
curl -X POST http://localhost:8000/graph \
  -H "Content-Type: application/json" \
  -d '{"query": "ashwagandha", "user_id": "test"}'
```

---

## Step 6 — Open the frontend

Open `frontend_demo.html` directly in your browser (no server needed).
Type a query and hit Search.

---

## Tuning parameters (.env)

| Variable | Default | Effect |
|---|---|---|
| TOP_K_PAPERS | 40 | More papers = richer graph but slower |
| COSINE_THRESH | 0.82 | Lower = more aggressive concept merging |
| FUZZY_THRESH | 88 | Lower = more fuzzy string merging |
| MIN_EDGE_WEIGHT | 2 | Higher = fewer, stronger edges only |

---

## Neo4j Graph Schema

```
(:Concept {name, weight, is_query, user_id, query})
(:Paper   {paper_id, title, abstract, journal, doi, score, user_id, query})
(:Author  {name, user_id})

(:Concept)-[:CO_OCCURS_WITH {weight}]-(:Concept)
(:Concept)-[:APPEARS_IN]->(:Paper)
(:Author)-[:AUTHORED]->(:Paper)
```

---

## Troubleshooting

**psycopg2 connection refused** → Check PG_DSN, make sure DBngin is running

**Neo4j auth error** → Make sure NEO4J_PASSWORD in .env matches what you set in docker run

**No results** → Run `SELECT COUNT(*) FROM paper_chunks` — if 0, embeddings haven't been generated yet

**Slow first run** → sentence-transformers downloads the model (~90MB) on first use
