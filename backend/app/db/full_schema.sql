-- ============================================================================
-- CCRAS RISHI-AI / BRAHMA — Full Database Schema
-- PostgreSQL 18 — Recreates all 24+ tables from previous DB
-- Run: sudo -u postgres psql -d brahma -f full_schema.sql
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    uid             UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name       VARCHAR(255),
    role            VARCHAR(50) DEFAULT 'researcher',
    is_active       BOOLEAN DEFAULT TRUE,
    is_verified     BOOLEAN DEFAULT FALSE,
    avatar_url      TEXT,
    institution     VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. refresh_tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============================================================================
-- 3. papers — canonical deduplicated records
-- ============================================================================
CREATE TABLE IF NOT EXISTS papers (
    id               SERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    abstract         TEXT NOT NULL,
    full_text        TEXT,
    authors          JSON NOT NULL,
    journal          VARCHAR(255) NOT NULL,
    publication_date DATE NOT NULL,
    doi              VARCHAR(255) UNIQUE,
    pmid             VARCHAR(255) UNIQUE,
    url              TEXT NOT NULL,
    source           VARCHAR(100) DEFAULT 'pubmed',
    open_access      VARCHAR(10) DEFAULT 'false',
    article_type     VARCHAR(100),
    language         VARCHAR(10) DEFAULT 'en',
    citation_count   INT DEFAULT 0,
    embedding        VECTOR(1536),
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_papers_title    ON papers USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_papers_abstract ON papers USING GIN (abstract gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_papers_doi      ON papers (doi);
CREATE INDEX IF NOT EXISTS idx_papers_pmid     ON papers (pmid);

-- ============================================================================
-- 4. raw_papers — immutable audit log of scraped data
-- ============================================================================
CREATE TABLE IF NOT EXISTS raw_papers (
    id                 SERIAL PRIMARY KEY,
    ingestion_hash     VARCHAR(255) UNIQUE NOT NULL,
    raw_title          TEXT NOT NULL,
    abstract           TEXT,
    full_text          TEXT,
    source             VARCHAR(100) DEFAULT 'pubmed',
    source_external_id VARCHAR(255) NOT NULL,
    source_url         TEXT NOT NULL,
    doi                VARCHAR(255),
    pmid               VARCHAR(255) UNIQUE,
    authors            JSON NOT NULL,
    journal            VARCHAR(255) NOT NULL,
    publication_date   DATE NOT NULL,
    fetch_timestamp    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. authors — normalized author records
-- ============================================================================
CREATE TABLE IF NOT EXISTS authors (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    orcid       VARCHAR(50) UNIQUE,
    affiliation TEXT,
    email       VARCHAR(255),
    paper_count INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_authors_name ON authors USING GIN (name gin_trgm_ops);

-- ============================================================================
-- 6. author_consents
-- ============================================================================
CREATE TABLE IF NOT EXISTS author_consents (
    id          SERIAL PRIMARY KEY,
    author_id   INT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    paper_id    INT REFERENCES papers(id) ON DELETE SET NULL,
    consent_type VARCHAR(100) NOT NULL,
    granted     BOOLEAN DEFAULT FALSE,
    granted_at  TIMESTAMPTZ,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. keywords
-- ============================================================================
CREATE TABLE IF NOT EXISTS keywords (
    id          SERIAL PRIMARY KEY,
    keyword     VARCHAR(255) UNIQUE NOT NULL,
    category    VARCHAR(100),
    paper_count INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_keywords_kw ON keywords (keyword);

-- paper <-> keyword junction
CREATE TABLE IF NOT EXISTS paper_keywords (
    paper_id   INT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    keyword_id INT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    PRIMARY KEY (paper_id, keyword_id)
);

-- ============================================================================
-- 8. keyword_queue — keywords pending scraping
-- ============================================================================
CREATE TABLE IF NOT EXISTS keyword_queue (
    id           SERIAL PRIMARY KEY,
    keyword      VARCHAR(255) NOT NULL,
    source       VARCHAR(100) DEFAULT 'pubmed',
    priority     INT DEFAULT 0,
    status       VARCHAR(50) DEFAULT 'pending',
    max_results  INT DEFAULT 100,
    fetched      INT DEFAULT 0,
    error        TEXT,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- 9. paper_chunks — section-level chunks with embeddings for RAG
-- ============================================================================
CREATE TABLE IF NOT EXISTS paper_chunks (
    id            SERIAL PRIMARY KEY,
    paper_id      INT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    chunk_index   INT NOT NULL,
    section_type  VARCHAR(100),
    section_label VARCHAR(255),
    content       TEXT NOT NULL,
    word_count    INT DEFAULT 0,
    embedding     VECTOR(1536),
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (paper_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_chunks_paper ON paper_chunks (paper_id);
CREATE INDEX IF NOT EXISTS idx_chunks_section ON paper_chunks (section_type);

-- ============================================================================
-- 10. collections & collection_papers
-- ============================================================================
CREATE TABLE IF NOT EXISTS collections (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    is_public   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_papers (
    id            SERIAL PRIMARY KEY,
    collection_id INT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    paper_id      INT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    added_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    notes         TEXT,
    UNIQUE (collection_id, paper_id)
);

-- ============================================================================
-- 11. library_papers — user's personal library
-- ============================================================================
CREATE TABLE IF NOT EXISTS library_papers (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    paper_id   INT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    status     VARCHAR(50) DEFAULT 'unread',
    rating     INT CHECK (rating BETWEEN 1 AND 5),
    tags       JSON DEFAULT '[]',
    notes      TEXT,
    added_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, paper_id)
);

-- ============================================================================
-- 12. chat_sessions & chat_messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255),
    model      VARCHAR(100) DEFAULT 'llama2',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          SERIAL PRIMARY KEY,
    session_id  INT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant','system')),
    content     TEXT NOT NULL,
    citations   JSON DEFAULT '[]',
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_msg_session ON chat_messages (session_id);

-- ============================================================================
-- 13. comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    paper_id   INT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    parent_id  INT REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 14. manuscripts
-- ============================================================================
CREATE TABLE IF NOT EXISTS manuscripts (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(500) NOT NULL,
    content     TEXT,
    status      VARCHAR(50) DEFAULT 'draft',
    paper_ids   JSON DEFAULT '[]',
    metadata    JSON DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 15. notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(100) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    message    TEXT,
    read       BOOLEAN DEFAULT FALSE,
    data       JSON DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (user_id, read);

-- ============================================================================
-- 16. saved_searches
-- ============================================================================
CREATE TABLE IF NOT EXISTS saved_searches (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query      TEXT NOT NULL,
    filters    JSON DEFAULT '{}',
    name       VARCHAR(255),
    alert      BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 17. search_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_logs (
    id           SERIAL PRIMARY KEY,
    user_id      INT REFERENCES users(id) ON DELETE SET NULL,
    query        TEXT NOT NULL,
    source       VARCHAR(100),
    result_count INT DEFAULT 0,
    filters      JSON DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 18. audit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id         SERIAL PRIMARY KEY,
    user_id    INT REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(100) NOT NULL,
    entity     VARCHAR(100),
    entity_id  INT,
    details    JSON DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity, entity_id);

-- ============================================================================
-- 19. export_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS export_log (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id) ON DELETE SET NULL,
    export_type VARCHAR(100) NOT NULL,
    format      VARCHAR(50) DEFAULT 'csv',
    record_count INT DEFAULT 0,
    file_path   TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 20. file_uploads
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_uploads (
    id           SERIAL PRIMARY KEY,
    user_id      INT REFERENCES users(id) ON DELETE SET NULL,
    filename     VARCHAR(500) NOT NULL,
    content_type VARCHAR(100),
    size_bytes   BIGINT,
    storage_path TEXT NOT NULL,
    paper_id     INT REFERENCES papers(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 21. gap_candidates — research gap identification
-- ============================================================================
CREATE TABLE IF NOT EXISTS gap_candidates (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    gap_type        VARCHAR(100),
    confidence      FLOAT CHECK (confidence BETWEEN 0 AND 1),
    supporting_papers JSON DEFAULT '[]',
    status          VARCHAR(50) DEFAULT 'identified',
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 22. processing_queue
-- ============================================================================
CREATE TABLE IF NOT EXISTS processing_queue (
    id           SERIAL PRIMARY KEY,
    paper_id     INT REFERENCES papers(id) ON DELETE CASCADE,
    task_type    VARCHAR(100) NOT NULL,
    status       VARCHAR(50) DEFAULT 'pending',
    priority     INT DEFAULT 0,
    attempts     INT DEFAULT 0,
    error        TEXT,
    result       JSON,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_procq_status ON processing_queue (status);

-- ============================================================================
-- 23. workflow_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_history (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id   INT NOT NULL,
    from_status VARCHAR(100),
    to_status   VARCHAR(100) NOT NULL,
    comment     TEXT,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 24-28. Knowledge graph tables (entities, aliases, relations, pipeline)
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE entity_type AS ENUM ('Drug','Disease','Gene','Protein');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS entities (
    id             SERIAL PRIMARY KEY,
    canonical_name VARCHAR(255) NOT NULL,
    entity_type    entity_type NOT NULL,
    description    TEXT,
    embedding      VECTOR(1536),
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (canonical_name, entity_type)
);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities (canonical_name);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities (entity_type);

CREATE TABLE IF NOT EXISTS entity_aliases (
    id         SERIAL PRIMARY KEY,
    alias      VARCHAR(255) NOT NULL,
    entity_id  INT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    source     VARCHAR(100) DEFAULT 'scispaCy',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (alias, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_alias ON entity_aliases (alias);

CREATE TABLE IF NOT EXISTS paper_entities (
    id          SERIAL PRIMARY KEY,
    paper_id    INT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    entity_id   INT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    section     VARCHAR(100) NOT NULL,
    evidence_text TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (paper_id, entity_id, section)
);
CREATE INDEX IF NOT EXISTS idx_pe_paper  ON paper_entities (paper_id);
CREATE INDEX IF NOT EXISTS idx_pe_entity ON paper_entities (entity_id);

DO $$ BEGIN
    CREATE TYPE relation_type AS ENUM ('treats','associates_with','affects','prevents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS relationship_instances (
    id                SERIAL PRIMARY KEY,
    paper_id          INT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    entity_1_id       INT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    entity_2_id       INT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relation_type     relation_type NOT NULL,
    evidence_sentence TEXT NOT NULL,
    section           VARCHAR(100) NOT NULL,
    confidence_score  FLOAT NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    model_version     VARCHAR(100) DEFAULT 'scispaCy-0.4.0',
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (paper_id, entity_1_id, entity_2_id, relation_type)
);

DO $$ BEGIN
    CREATE TYPE pipeline_status AS ENUM ('pending','running','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS pipeline_tasks (
    id            SERIAL PRIMARY KEY,
    task_type     VARCHAR(100) NOT NULL,
    paper_id      INT REFERENCES papers(id) ON DELETE SET NULL,
    status        pipeline_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    model_version VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at  TIMESTAMPTZ
);

-- ============================================================================
-- 29. studies (BRAHMA study design)
-- ============================================================================
CREATE TABLE IF NOT EXISTS studies (
    id                SERIAL PRIMARY KEY,
    title             VARCHAR(255) NOT NULL,
    research_question TEXT,
    pico              JSON,
    hypothesis        JSON,
    study_type        JSON,
    sample_size       JSON,
    statistical_plan  JSON,
    eligibility       JSON,
    confounders       JSON,
    ayush_protocol    JSON,
    timeline          JSON,
    ethics            JSON,
    quality_score     INT DEFAULT 0,
    completeness      INT DEFAULT 0,
    risks             JSON DEFAULT '[]',
    compliance        JSON DEFAULT '[]',
    snapshots         JSON DEFAULT '[]',
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Auto-chunking trigger: when a paper's full_text is inserted/updated,
-- automatically create chunks in paper_chunks
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_chunk_paper()
RETURNS TRIGGER AS $$
DECLARE
    chunk_size INT := 500;
    words TEXT[];
    total_words INT;
    chunk_start INT;
    chunk_idx INT := 0;
    chunk_text TEXT;
BEGIN
    -- Only run if full_text changed
    IF NEW.full_text IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.full_text IS DISTINCT FROM NEW.full_text) THEN
        -- Remove old chunks
        DELETE FROM paper_chunks WHERE paper_id = NEW.id;

        -- Split into words
        words := string_to_array(NEW.full_text, ' ');
        total_words := array_length(words, 1);

        IF total_words IS NOT NULL AND total_words > 0 THEN
            chunk_start := 1;
            WHILE chunk_start <= total_words LOOP
                chunk_text := array_to_string(words[chunk_start : LEAST(chunk_start + chunk_size - 1, total_words)], ' ');
                INSERT INTO paper_chunks (paper_id, chunk_index, section_type, section_label, content, word_count)
                VALUES (NEW.id, chunk_idx, 'auto', 'auto_chunk', chunk_text, LEAST(chunk_size, total_words - chunk_start + 1));
                chunk_idx := chunk_idx + 1;
                chunk_start := chunk_start + chunk_size;
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_chunk ON papers;
CREATE TRIGGER trg_auto_chunk
    AFTER INSERT OR UPDATE OF full_text ON papers
    FOR EACH ROW EXECUTE FUNCTION auto_chunk_paper();

-- ============================================================================
-- Updated_at auto-update trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_papers_ts ON papers;
CREATE TRIGGER trg_papers_ts BEFORE UPDATE ON papers
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_users_ts ON users;
CREATE TRIGGER trg_users_ts BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- Done — verify
-- ============================================================================
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
