"""Hybrid retrieval service combining semantic search (pgvector),
lexical search (PostgreSQL Full-Text Search), and Reciprocal Rank Fusion (RRF).

Designed as an independent retrieval engine to be consumed directly
by the LangGraph AI agent in Phase 7.
"""

from collections import defaultdict
import logging
from typing import Sequence
import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.embeddings import MissingApiKeyError, OpenRouterEmbeddingClient
from app.models.document import Document, DocumentChunk
from app.schemas.rag import (
    ChunkCitation,
    HybridSearchResult,
    RetrievalMetadata,
    RetrievedChunk,
)

logger = logging.getLogger(__name__)

# Reciprocal Rank Fusion constant (standard literature value)
RRF_K = 60.0


class HybridRetriever:
    """Performs hybrid semantic and lexical retrieval on document chunks."""

    def __init__(
        self,
        db: Session,
        embedding_client: OpenRouterEmbeddingClient | None = None,
        rrf_k: float = RRF_K,
    ) -> None:
        self.db = db
        self.embedding_client = embedding_client or OpenRouterEmbeddingClient()
        self.rrf_k = rrf_k

    def search_semantic(
        self,
        query: str,
        limit: int = 10,
        document_id: str | None = None,
    ) -> list[tuple[DocumentChunk, Document, float]]:
        """Semantic search using pgvector cosine distance on document_chunks.

        Returns list of (chunk, document, cosine_similarity_score).
        Cosine similarity: 1 - cosine_distance. Higher is better (-1.0 to 1.0).
        Only searches chunks with valid real embeddings.
        """
        if not self.embedding_client.is_configured:
            logger.info("Semantic search disabled: OpenRouter API key is not configured.")
            return []

        try:
            query_embedding = self.embedding_client.get_embedding(query)
        except MissingApiKeyError:
            logger.info("OpenRouter API key missing. Skipping semantic retrieval.")
            return []
        except Exception as e:
            logger.error("Failed to generate embedding for query '%s': %s", query, e)
            return []

        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

        doc_filter_sql = "AND c.document_id = :doc_id" if document_id else ""
        sql = f"""
            SELECT 
                c.id AS chunk_id,
                1 - (c.embedding <=> cast(:query_vector as vector)) AS similarity_score
            FROM document_chunks c
            WHERE c.embedding IS NOT NULL
            {doc_filter_sql}
            ORDER BY c.embedding <=> cast(:query_vector as vector) ASC
            LIMIT :limit;
        """

        params = {"query_vector": embedding_str, "limit": limit}
        if document_id:
            params["doc_id"] = document_id

        rows = self.db.execute(text(sql), params).fetchall()
        if not rows:
            return []

        chunk_scores = {str(row[0]): float(row[1]) for row in rows}
        chunk_ids = [row[0] if isinstance(row[0], uuid.UUID) else uuid.UUID(str(row[0])) for row in rows]

        chunks = (
            self.db.query(DocumentChunk)
            .join(Document, Document.id == DocumentChunk.document_id)
            .filter(DocumentChunk.id.in_(chunk_ids))
            .all()
        )

        results: list[tuple[DocumentChunk, Document, float]] = []
        chunk_map = {str(c.id): c for c in chunks}

        for row in rows:
            c_id = str(row[0])
            if c_id in chunk_map:
                chunk = chunk_map[c_id]
                score = chunk_scores[c_id]
                results.append((chunk, chunk.document, score))

        return results

    def search_lexical(
        self,
        query: str,
        limit: int = 10,
        document_id: str | None = None,
    ) -> list[tuple[DocumentChunk, Document, float]]:
        """Lexical full-text search using PostgreSQL tsvector ('portuguese' dictionary).

        Handles policy terms, deadlines, numbers, and specific policy queries.
        Returns list of (chunk, document, rank_score).
        """
        doc_filter_sql = "AND c.document_id = :doc_id" if document_id else ""
        sql = f"""
            SELECT 
                c.id AS chunk_id,
                ts_rank_cd(
                    to_tsvector('portuguese', c.content),
                    plainto_tsquery('portuguese', :query)
                ) AS rank_score
            FROM document_chunks c
            WHERE to_tsvector('portuguese', c.content) @@ plainto_tsquery('portuguese', :query)
            {doc_filter_sql}
            ORDER BY rank_score DESC
            LIMIT :limit;
        """

        params = {"query": query, "limit": limit}
        if document_id:
            params["doc_id"] = document_id

        rows = self.db.execute(text(sql), params).fetchall()
        if not rows:
            return []

        chunk_scores = {str(row[0]): float(row[1]) for row in rows}
        chunk_ids = [row[0] if isinstance(row[0], uuid.UUID) else uuid.UUID(str(row[0])) for row in rows]

        chunks = (
            self.db.query(DocumentChunk)
            .join(Document, Document.id == DocumentChunk.document_id)
            .filter(DocumentChunk.id.in_(chunk_ids))
            .all()
        )

        results: list[tuple[DocumentChunk, Document, float]] = []
        chunk_map = {str(c.id): c for c in chunks}

        for row in rows:
            c_id = str(row[0])
            if c_id in chunk_map:
                chunk = chunk_map[c_id]
                score = chunk_scores[c_id]
                results.append((chunk, chunk.document, score))

        return results

    def search_hybrid(
        self,
        query: str,
        limit: int = 4,
        semantic_limit: int = 10,
        lexical_limit: int = 10,
        document_id: str | None = None,
    ) -> HybridSearchResult:
        """Combines semantic and lexical retrieval using Reciprocal Rank Fusion (RRF).

        Formula:
            RRF_score(doc) = sum_{m in methods} (1 / (k + rank_m(doc)))
            where k is RRF_K (default 60).
        """
        semantic_results = self.search_semantic(
            query=query, limit=semantic_limit, document_id=document_id
        )
        lexical_results = self.search_lexical(
            query=query, limit=lexical_limit, document_id=document_id
        )

        rrf_scores: dict[str, float] = defaultdict(float)
        chunk_data: dict[str, tuple[DocumentChunk, Document]] = {}

        # 1. Score semantic ranks (1-indexed rank)
        for rank, (chunk, doc, _) in enumerate(semantic_results, start=1):
            c_id = str(chunk.id)
            rrf_scores[c_id] += 1.0 / (self.rrf_k + rank)
            chunk_data[c_id] = (chunk, doc)

        # 2. Score lexical ranks (1-indexed rank)
        for rank, (chunk, doc, _) in enumerate(lexical_results, start=1):
            c_id = str(chunk.id)
            rrf_scores[c_id] += 1.0 / (self.rrf_k + rank)
            chunk_data[c_id] = (chunk, doc)

        # Sort combined results by RRF score descending
        sorted_chunk_ids = sorted(
            rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True
        )

        retrieved_items: list[RetrievedChunk] = []

        for cid in sorted_chunk_ids[:limit]:
            chunk, doc = chunk_data[cid]
            score = round(rrf_scores[cid], 5)
            page = int(chunk.metadata_.get("page", 1))

            citation = ChunkCitation(
                document_name=doc.name,
                file_name=doc.file_name,
                page=page,
                chunk_id=cid,
            )

            retrieved_items.append(
                RetrievedChunk(
                    chunk_id=cid,
                    document_id=str(doc.id),
                    document_name=doc.name,
                    file_name=doc.file_name,
                    content=chunk.content,
                    page=page,
                    score=score,
                    retrieval_method="hybrid_rrf",
                    citation=citation,
                    metadata=dict(chunk.metadata_ or {}),
                )
            )

        return HybridSearchResult(
            query=query,
            total_results=len(retrieved_items),
            results=retrieved_items,
            has_retrieved_results=bool(retrieved_items),
            diagnostics=RetrievalMetadata(
                semantic_matches_count=len(semantic_results),
                lexical_matches_count=len(lexical_results),
                semantic_enabled=self.embedding_client.is_configured,
            ),
        )
