# PubMed, arXiv, and PDF Ingestion API

This service provides a complete ingestion pipeline for academic papers from multiple sources.

## Features

1. PubMed article ingestion with deduplication and storage
2. arXiv article ingestion with deduplication and storage
3. PDF processing through GROBID service
4. Duplicate detection using DOI and title similarity
5. Keyword extraction using KeyBERT
6. Background task processing

## API Endpoints

### POST /api/ingest/pubmed
Search and ingest PubMed articles:
```json
{
  "query": "machine learning",
  "max_results": 500
}
```

### POST /api/ingest/arxiv
Search and ingest arXiv articles:
```json
{
  "query": "machine learning",
  "category": "cs.AI",
  "max_results": 200
}
```

### POST /api/ingest/pdf
Process PDF documents through GROBID:
```json
{
  "file": "PDF file upload"
}
```

### POST /api/ingest/process
Process papers through deduplication and storage pipeline with background tasks