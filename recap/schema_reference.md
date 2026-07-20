```
                                                         Table "public.papers"
      Column      |            Type             | Collation | Nullable | Default | Storage  | Compression | Stats target | Description 
------------------+-----------------------------+-----------+----------+---------+----------+-------------+--------------+-------------
 id               | uuid                        |           | not null |         | plain    |             |              | 
 title            | text                        |           | not null |         | extended |             |              | 
 abstract         | text                        |           |          |         | extended |             |              | 
 authors          | jsonb                       |           |          |         | extended |             |              | 
 published_at     | timestamp without time zone |           |          |         | plain    |             |              | 
 published_date   | text                        |           |          |         | extended |             |              | 
 journal          | text                        |           |          |         | extended |             |              | 
 doi              | text                        |           |          |         | extended |             |              | 
 external_id      | text                        |           |          |         | extended |             |              | 
 source           | text                        |           |          |         | extended |             |              | 
 keywords         | jsonb                       |           |          |         | extended |             |              | 
 full_text        | text                        |           |          |         | extended |             |              | 
 citations        | jsonb                       |           |          |         | extended |             |              | 
 paper_references | jsonb                       |           |          |         | extended |             |              | 
 language         | text                        |           |          |         | extended |             |              | 
 word_count       | integer                     |           |          |         | plain    |             |              | 
 url              | text                        |           |          |         | extended |             |              | 
 created_at       | timestamp without time zone |           |          | now()   | plain    |             |              | 
 embedding        | vector                      |           |          |         | external |             |              | 
 search_vector    | tsvector                    |           |          |         | extended |             |              | 
Indexes:
    "papers_pkey" PRIMARY KEY, btree (id)
    "papers_doi_source_unique" UNIQUE CONSTRAINT, btree (doi, source)
Referenced by:
    TABLE "library_papers" CONSTRAINT "library_papers_paper_id_fkey" FOREIGN KEY (paper_id) REFERENCES papers(id)
    TABLE "paper_chunks" CONSTRAINT "paper_chunks_paper_id_fkey" FOREIGN KEY (paper_id) REFERENCES papers(id)
Access method: heap
```