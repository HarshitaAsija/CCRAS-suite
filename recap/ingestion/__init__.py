from fastapi import FastAPI
from .pubmed_fetcher import router as pubmed_router
from .arxiv_fetcher import router as arxiv_router

app = FastAPI()

# Include the PubMed and arXiv routers
app.include_router(pubmed_router)
app.include_router(arxiv_router)