--psql "postgresql://postgres:Pg1234@100.101.210.91:5432/ccras_db" -f tripti.sql 



WITH seed_scores AS (
    SELECT
        p.doi AS seed_doi,
        p.title,
        (
            SELECT COUNT(*)
            FROM jsonb_array_elements_text(p.paper_references) AS ref_doi
            WHERE LOWER(ref_doi) IN (SELECT LOWER(doi) FROM papers)
        ) AS bwd,
        (
            SELECT COUNT(*)
            FROM jsonb_array_elements_text(p.citations) AS cit_doi
            WHERE LOWER(cit_doi) IN (SELECT LOWER(doi) FROM papers)
        ) AS fwd
    FROM papers p
    WHERE jsonb_typeof(p.paper_references) = 'array'
      AND jsonb_typeof(p.citations) = 'array'
)
SELECT *
FROM seed_scores
WHERE bwd > 0 AND fwd > 0
ORDER BY (bwd + fwd) DESC
LIMIT 20;