<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.111+-009688?logo=fastapi" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql" />
  <img src="https://img.shields.io/badge/Neo4j-5.x-008CC1?logo=neo4j" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js" />
</p>

# 🧬 CCRAS Intelligence Suite

> **A unified Biomedical AI Research Platform** that streamlines literature analysis, knowledge discovery, and clinical study design — built for CCRAS (Central Council for Research in Ayurvedic Sciences).

The platform integrates language models, knowledge graphs, and workflow automation into a single cohesive system to accelerate Ayurvedic and biomedical research.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CCRAS Intelligence Suite                     │
├──────────────┬──────────────────────┬───────────────────────────────┤
│   frontend/  │     backend/         │         ai/                   │
│   Next.js 16 │     FastAPI          │     FastAPI (Rishi-AI)        │
│   Port 3000  │     Port 8002        │     Port 8001                 │
├──────────────┴──────────────────────┴───────────────────────────────┤
│                         Data Layer                                  │
│  PostgreSQL (5432)  │  SQLite (brahma.db)  │  Neo4j (7687)         │
└─────────────────────────────────────────────────────────────────────┘
```

| Layer | Technology | Port | Purpose |
|:------|:-----------|:-----|:--------|
| **Frontend** | Next.js 16, React 19, TypeScript | `3000` | Dashboard, UI, all modules |
| **Backend (Brahma)** | FastAPI, Python | `8002` | Study design, protocol export, evidence adapter |
| **Backend (Rishi-AI)** | FastAPI, Python | `8001` | Literature search, gap analysis, hypothesis generation |
| **Database** | PostgreSQL 16 | `5432` | Papers, entities, hypotheses, gaps (remote hosted) |
| **Local DB** | SQLite | — | Brahma study protocols (`brahma.db`) |
| **Graph DB** | Neo4j 5 | `7687` | Knowledge graph (optional, for graph visualization) |
| **LLM Engine** | Ollama (Llama 3) | `11434` | Local AI inference (optional) |

---

## 🧩 Core Modules

### 📚 RECAP — Library & Knowledge Management
The foundational document repository and research memory system.
- Search & organize scientific literature and clinical papers
- Upload PDFs with automated summarization and entity extraction
- RAG-powered conversational research assistant
- Citation snowballing and collection management

### 🔬 RISHI-AI — Literature Analysis & Knowledge Discovery
The intelligent ingestion and exploration engine for biomedical data.
- Automated literature search from PubMed, bioRxiv, PMC
- Named Entity Recognition (genes, diseases, drugs, Ayurvedic formulations)
- Interactive **Knowledge Graph** construction with Neo4j
- Research gap identification and AI-driven hypothesis generation

### 🧪 BRAHMA — Study & Protocol Design
Translates biomedical discoveries into actionable research protocols.
- 13-step guided clinical study design wizard
- Auto-generates PICO framework, hypotheses, sample size calculations
- Ayurveda-specific protocol parameters (Prakriti, Anupana, API compliance)
- Export protocols as Markdown, Word (.docx), or HTML reports

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Version | Check Command | Install Link |
|:-----|:--------|:-------------|:-------------|
| **Node.js** | 18+ | `node --version` | [nodejs.org](https://nodejs.org/) |
| **npm** | 9+ | `npm --version` | Comes with Node.js |
| **Python** | 3.10+ | `python --version` | [python.org](https://python.org/) |
| **Git** | Any | `git --version` | [git-scm.com](https://git-scm.com/) |

**Optional** (for advanced features):
| Tool | Purpose | Install |
|:-----|:--------|:--------|
| **Docker** | Run Neo4j for knowledge graphs | [docker.com](https://docker.com/) |
| **Ollama** | Local LLM inference (Llama 3) | [ollama.com](https://ollama.com/) |

---

## 🚀 Quick Start (Step by Step)

### Step 0 — Clone & Configure

```bash
# Clone the repository
git clone https://github.com/HarshitaAsija/CCRAS-suite.git
cd CCRAS-suite

# Create environment file from template
cp .env.example .env
```

> The `.env` file contains database credentials and API URLs. The defaults connect to the shared remote PostgreSQL database. Edit only if your DB setup differs.

---

### Step 1 — Install & Start the Frontend (Port 3000)

```bash
cd frontend
npm install
npm run dev
```

✅ **Frontend running at** → [http://localhost:3000](http://localhost:3000)

> The Dashboard's **Live Database Statistics** connects directly to PostgreSQL via a Next.js server-side API route — no backend needed for stats.

---

### Step 2 — Install & Start the Brahma Backend (Port 8002)

Open a **new terminal**:

```bash
cd backend

# Create virtual environment (first time only)
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --port 8002 --reload
```

✅ **Brahma API running at** → [http://localhost:8002/docs](http://localhost:8002/docs)

> Powers: Study Design Studio, Protocol Export (Markdown/Word/HTML), Evidence Adapter, PICO Builder

---

### Step 3 — Install & Start the Rishi-AI Backend (Port 8001)

Open a **new terminal**:

```bash
cd ai

# Create virtual environment (first time only)
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the server
uvicorn api_server:app --port 8001 --reload
```

✅ **Rishi-AI API running at** → [http://localhost:8001/docs](http://localhost:8001/docs)

> Powers: Literature Search, Research Gaps, Hypothesis Generation, Knowledge Graph API

---

### Step 4 (Optional) — Neo4j for Knowledge Graphs

If you want the interactive knowledge graph visualization in RISHI-AI:

```bash
# Using Docker:
docker run -d \
  --name neo4j-rishi \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/rishiai123 \
  neo4j:5
```

✅ **Neo4j Browser** → [http://localhost:7474](http://localhost:7474) (user: `neo4j`, password: `rishiai123`)

---

### Step 5 (Optional) — Ollama for Local LLM

If you want AI-powered hypothesis generation and gap analysis:

```bash
# Install Ollama from https://ollama.com, then:
ollama pull llama3
ollama serve
```

✅ **Ollama API** → [http://localhost:11434](http://localhost:11434)

---

## 🖥️ Running Summary

Once everything is set up, you need **3 terminals** running simultaneously:

| Terminal | Directory | Command | Port |
|:---------|:----------|:--------|:-----|
| 1️⃣ | `frontend/` | `npm run dev` | 3000 |
| 2️⃣ | `backend/` | `uvicorn app.main:app --port 8002 --reload` | 8002 |
| 3️⃣ | `ai/` | `uvicorn api_server:app --port 8001 --reload` | 8001 |

Then open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🗄️ Database Connection

The platform connects to a **shared remote PostgreSQL** database by default:

| Parameter | Value |
|:----------|:------|
| Host | `100.101.210.91` |
| Port | `5432` |
| Database | `ccras_db` |
| User | `anshika` |
| Password | `anshi_123` |

These credentials are configured in `.env`. The Dashboard reads from this database directly via the Next.js API route (`frontend/app/api/stats/route.ts`).

**Key Tables:**
- `papers` — 93,000+ ingested research papers
- `entities` — Extracted biomedical entities (genes, drugs, diseases)
- `hypothesis_seeds` — AI-generated research hypotheses
- `gap_candidates` — Identified research gaps
- `studies` — Brahma study protocols

---

## 📁 Project Structure

```
CCRAS-suite/
│
├── frontend/                    # Next.js 16 web application
│   ├── app/                     #   App router (pages, API routes)
│   │   ├── api/stats/           #   Dashboard stats API (direct DB connection)
│   │   ├── dashboard/           #   Dashboard page
│   │   ├── login/               #   Authentication pages
│   │   └── ...
│   ├── components/              #   React components
│   │   ├── dashboard/           #     Main Dashboard with live stats
│   │   ├── discover/            #     RISHI-AI Studio (search, gaps, graphs)
│   │   ├── study-design/        #     BRAHMA Study Design wizard
│   │   ├── library/recap/       #     RECAP library & upload system
│   │   ├── layout/              #     Sidebar, navigation
│   │   └── features/            #     Knowledge Graph, Hypothesis Generator
│   └── lib/                     #   API client utilities
│
├── backend/                     # FastAPI backend (Brahma)
│   ├── app/
│   │   ├── main.py              #   Entry point
│   │   ├── routers/             #   API route handlers
│   │   │   ├── evidence_adapter.py  #   Evidence search & PICO extraction
│   │   │   ├── study_design_ai.py   #   Protocol export (MD/DOCX/HTML)
│   │   │   ├── study.py         #   Study CRUD operations
│   │   │   └── library.py       #   Paper library endpoints
│   │   └── services/            #   Business logic
│   │       └── study_design_ai.py   #   AI study design engine
│   ├── brahma.db                #   SQLite database for study protocols
│   └── requirements.txt
│
├── ai/                          # Rishi-AI backend
│   ├── api_server.py            #   FastAPI entry point (port 8001)
│   ├── research_gap.py          #   Gap analysis engine
│   ├── hypothesis.py            #   Hypothesis generation
│   ├── scorer.py                #   Novelty scoring
│   ├── config.py                #   Environment configuration
│   ├── ingestion/               #   Paper ingestion pipelines
│   ├── knowledgegraph/          #   Neo4j graph construction
│   └── requirements.txt
│
├── .env.example                 # Environment variable template
├── .env                         # Local config (git-ignored)
└── README.md                    # This file
```

---

## 🔧 Environment Variables

All configuration is managed through the `.env` file in the project root. Copy from `.env.example`:

| Variable | Description | Default |
|:---------|:------------|:--------|
| `CCRAS_DB_HOST` | PostgreSQL host | `100.101.210.91` |
| `CCRAS_DB_PORT` | PostgreSQL port | `5432` |
| `CCRAS_DB_NAME` | Database name | `ccras_db` |
| `CCRAS_DB_USER` | DB username | `anshika` |
| `CCRAS_DB_PASSWORD` | DB password | `anshi_123` |
| `PG_DSN` | Full Postgres connection string | `postgresql://readonly:Read1234@...` |
| `NEO4J_URI` | Neo4j connection | `bolt://127.0.0.1:7687` |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `rishiai123` |
| `LLM_PROVIDER` | LLM backend | `ollama` |
| `OLLAMA_MODEL` | Model name | `llama3` |
| `OLLAMA_HOST` | Ollama API URL | `http://127.0.0.1:11434` |

---

## 🧑‍💻 Team & Branching Strategy

| Branch | Team | Module |
|:-------|:-----|:-------|
| `main` | All | Shared Dashboard, Auth, Landing Page |
| `recap` | Library Team | RECAP module |
| `rishi` | Discovery Team | RISHI-AI module |
| `brahma` | Study Design Team | BRAHMA module |

**Workflow:** Checkout your team branch → Build features → PR to `main`.

---

## 📄 License

This project is developed under **CCRAS (Central Council for Research in Ayurvedic Sciences)**, Ministry of Ayush, Government of India.
