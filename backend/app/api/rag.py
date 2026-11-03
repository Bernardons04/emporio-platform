"""RAG knowledge base endpoints for search, retrieval, and document reindexing."""

import logging
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_current_user
from app.core.retrieval import HybridRetriever
from app.db.session import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.rag import HybridSearchResult, RetrievedChunk, SearchQuery

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["Knowledge Base & RAG"])


@router.post(
    "/search",
    response_model=HybridSearchResult,
    summary="Hybrid search knowledge base",
    description="Combines pgvector semantic search and PostgreSQL full-text lexical search using Reciprocal Rank Fusion (RRF).",
)
def search_knowledge_base(
    payload: SearchQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HybridSearchResult:
    """Performs hybrid retrieval against the store policies knowledge base.

    Returns structured evidence chunks with citations and confidence indicators.
    """
    retriever = HybridRetriever(db=db)
    result = retriever.search_hybrid(
        query=payload.query,
        limit=payload.limit,
        document_id=payload.document_id,
    )
    return result


@router.get(
    "/documents",
    summary="List registered knowledge base documents",
    description="Returns all documents in the knowledge base and their indexing status.",
)
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists indexed policy documents."""
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return [
        {
            "id": str(d.id),
            "name": d.name,
            "file_name": d.file_name,
            "status": d.status,
            "chunk_count": len(d.chunks),
            "created_at": d.created_at.isoformat(),
            "updated_at": d.updated_at.isoformat(),
        }
        for d in docs
    ]


@router.post(
    "/reindex",
    summary="Reindex policy documents (Admin only)",
    description="Forces re-chunking and re-embedding of policy documents.",
)
def reindex_documents(
    force: bool = Query(default=True, description="Force re-chunking and regeneration"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    """Reindexes documents in the knowledge base."""
    from app.ingestion.document_ingestion import ingest_policy_documents

    stats = ingest_policy_documents(db=db, force=force)
    return {
        "message": "Reindexing completed",
        "documents_processed": stats.documents_processed,
        "chunks_created": stats.chunks_created,
        "embeddings_generated": stats.embeddings_generated,
        "errors": stats.errors,
    }

