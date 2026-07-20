-- Migration: 004_library_collections.sql
-- Alters existing tables to add missing columns + creates export_log

-- 1. Add missing columns to collections
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add missing column to library_papers
ALTER TABLE library_papers
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. Create export_log (only missing table)
--    collection_id must be INTEGER to match collections.id
CREATE TABLE IF NOT EXISTS export_log (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
  format TEXT NOT NULL,
  exported_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Verify
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('collections','library_papers','collection_papers','export_log');