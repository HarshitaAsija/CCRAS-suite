-- backend/migrations/001_add_bm25_search.sql
-- BM25 Full-Text Search Migration for Papers Table

-- Step 1: Add search_vector column
ALTER TABLE papers ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- Step 2: Populate search_vector from existing title and abstract data
UPDATE papers
SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(abstract, ''));

-- Step 3: Create GIN index for efficient full-text search
CREATE INDEX IF NOT EXISTS idx_papers_search_vector ON papers USING GIN(search_vector);

-- Step 4: Create trigger function to auto-update search_vector
CREATE OR REPLACE FUNCTION update_papers_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.abstract, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger for automatic updates on INSERT/UPDATE
CREATE TRIGGER trigger_update_papers_search_vector
  BEFORE INSERT OR UPDATE OF title, abstract ON papers
  FOR EACH ROW
  EXECUTE FUNCTION update_papers_search_vector();