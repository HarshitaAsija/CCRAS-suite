# CCRAS Intelligence Suite

The **CCRAS Intelligence Suite** is a unified Biomedical AI Research Platform designed to streamline literature analysis, knowledge discovery, and clinical study design. It integrates cutting-edge language models, knowledge graphs, and workflow automation into a single cohesive platform to accelerate scientific research.

## Core Modules

The platform is structured into three independent but highly integrated core modules:

### 1. RECAP (Library & Knowledge Management)
RECAP serves as the foundational repository and document management system. 
- Organizes scientific literature, clinical documents, and research papers.
- Extracts automated summaries and key metadata from uploaded documents.
- Provides a centralized workspace for researchers to curate their collections and reference materials.

### 2. RISHI-AI (Literature Analysis & Knowledge Discovery)
RISHI-AI powers the intelligent ingestion and exploration of biomedical data.
- Automates literature search and evidence retrieval from sources like PubMed, bioRxiv, PMC, etc.
- Employs advanced NLP for Named Entity Recognition (identifying genes, diseases, drugs).
- Constructs interactive **Knowledge Graphs** to map complex biological relationships.
- Identifies critical research gaps and auto-generates novel, evidence-based scientific hypotheses.

### 3. BRAHMA (Study & Protocol Design)
BRAHMA translates biomedical discoveries into actionable research execution.
- Guides researchers through clinical trial and experimental study design.
- Generates rigorous research protocols based on the hypotheses formulated by RISHI-AI.
- Aligns methodologies with standard regulatory guidelines and research best practices.

---

## Tech Stack

- **Frontend:** Next.js (React), TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python
- **AI / NLP Layer:** CrewAI, LangChain, BioBERT, Ollama
- **Database:** PostgreSQL (with pgvector for semantic search)
- **Knowledge Graph:** Neo4j
- **Containerization:** Docker & Docker Compose

---

## Project Structure

```text
ccras-suite/
├── frontend/         # Next.js web application (Dashboard & UI)
├── backend/          # FastAPI Python server
├── ai/               # Data ingestion, scrapers, and NLP pipelines
└── docs/             # Architecture and platform documentation
```

---

## Getting Started

You will need two terminal windows to run the suite locally.

### 1. Start the Frontend
The frontend requires Node.js. Running the production build is recommended to optimize memory usage (especially if running via WSL).
```bash
cd frontend
npm install
npm run build
npm run start
```
*The web interface will be available at `http://localhost:3000`*

### 2. Start the Backend API
The backend requires Python 3.10+.
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
*The API will be available at `http://localhost:8000`*

---

## Team Workflow & Branching Strategy

To allow independent teams to build the 3 core modules without merge conflicts, this repository utilizes a branch-based isolation strategy:

- `main` branch: Contains the shared architecture, unified Dashboard, Authentication, and Landing Page.
- `recap` branch: Dedicated workspace for the Library team.
- `rishi` branch: Dedicated workspace for the Discover & Knowledge Graph team.
- `brahma` branch: Dedicated workspace for the Study Design team.

**Standard Workflow:**
1. Clone the repository.
2. Checkout your team's specific branch (e.g., `git checkout rishi`).
3. Build and commit your features to your branch.
4. Periodically, the `main` branch improvements will be merged into the module branches to keep the core dashboard up to date.
