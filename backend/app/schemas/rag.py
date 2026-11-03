"""RAG models, schemas, and result contracts for Empório da Música.

Defines the output contract consumed by the AI Agent in Phase 7.
"""

from typing import Any, Literal
import uuid
from pydantic import BaseModel, Field


class ChunkCitation(BaseModel):
    """Source reference for the frontend to render inline citations."""
    document_name: str
    file_name: str
    page: int
    chunk_id: str


class RetrievedChunk(BaseModel):
    """Structured evidence item returned by the RAG retrieval layer.

    Adheres strictly to the Phase 6/7 output contract:
    - chunk_id: Unique chunk identifier
    - document_id: Unique document identifier
    - document_name: Human readable document title
    - file_name: Source file name
    - content: Actual text excerpt
    - page: Original page number (1-indexed)
    - score: Combined RRF ranking score or retrieval score
    - retrieval_method: 'semantic', 'lexical', or 'hybrid_rrf'
    - citation: Structured citation metadata
    - metadata: Additional dictionary of preserved metadata
    """
    chunk_id: str
    document_id: str
    document_name: str
    file_name: str
    content: str
    page: int
    score: float
    retrieval_method: Literal["semantic", "lexical", "hybrid_rrf"] = "hybrid_rrf"
    citation: ChunkCitation
    metadata: dict[str, Any] = Field(default_factory=dict)


class SearchQuery(BaseModel):
    """Query parameters for knowledge base search."""
    query: str = Field(..., min_length=2, max_length=500, description="Natural language user question")
    limit: int = Field(default=4, ge=1, le=20, description="Maximum number of chunks to retrieve")
    document_id: str | None = Field(default=None, description="Optional document filter")


class RetrievalMetadata(BaseModel):
    """Diagnostic details regarding retrieval execution."""
    semantic_matches_count: int
    lexical_matches_count: int
    semantic_enabled: bool


class HybridSearchResult(BaseModel):
    """Complete retrieval response."""
    query: str
    total_results: int
    results: list[RetrievedChunk]
    has_retrieved_results: bool = Field(
        ...,
        description="Indicates if retrieval matched any candidate chunks in the knowledge base. "
                    "Note: semantic/evidence validation will be performed by the AI Agent in Phase 7."
    )
    diagnostics: RetrievalMetadata
