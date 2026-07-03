# Brahma

Biomedical AI Research Platform

A platform for ingesting biomedical literature, AI-assisted research, and knowledge graph construction.

## Tech Stack

- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: FastAPI + Python
- AI Layer: CrewAI, LangChain, BioBERT, Ollama
- Database: PostgreSQL + pgvector
- Knowledge Graph: Neo4j
- Containerization: Docker
- CI/CD: GitHub Actions

## Project Structure

```
brahma/
├── frontend/
├── backend/
├── ai/
├── database/
├── docs/
├── README.md
├── .gitignore
├── docker-compose.yml
└── .env.example
```

## Getting Started

See the individual READMEs in each directory for setup instructions.

## License

MIT
<!-- Testing feature/pubmed-ingestion branch -->

<!-- Temporary main branch test -->


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

---

## Brahma Study Design Intelligence

Brahma has been upgraded from a client-side mock system into a backend-connected, persistent, hybrid AI clinical study design platform.

### Key API Endpoints (Brahma)

- **CRUD Operations (`/api/v1/studies/`):**
  - `POST /`: Create study protocol
  - `GET /`: List studies (supports filtering by type, completeness, quality score, and text search)
  - `GET /{id}`: Load a specific study
  - `PUT /{id}`: Autosave / update protocol state
  - `DELETE /{id}`: Remove protocol

- **AI Analytics & Reasoning (`/api/v1/study-design/`):**
  - `POST /analyze`: Calculate quality, completeness, and audit for SPIRIT, CONSORT, ICMR, and AYUSH guideline compliance
  - `POST /generate-hypothesis`: Generate comparative, alternate, and null hypotheses from PICO
  - `POST /recommend-study-type`: Recommend trial design with confidence intervals
  - `POST /statistical-plan`: Recommend appropriate analytical tests
  - `POST /protocol-summary`: Compile an executive brief
  - `POST /export`: Export to Markdown or HTML formatted printable layout

### Testing the Endpoints
A sample payload JSON is stored in the system under `scratch/sample_protocol.json`. You can verify endpoints using `curl`:
```bash
# Test the AI study design analyzer
curl -X POST http://localhost:8000/api/v1/study-design/analyze \
  -H "Content-Type: application/json" \
  -d @scratch/sample_protocol.json
```
