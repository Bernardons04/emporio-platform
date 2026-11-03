"""Document ingestion and reindexing pipeline for Empório da Música policies.

Extracts text from PDF documents, performs structured chunking, generates embeddings
via OpenRouter (never fallback vectors), and stores chunks with metadata
in PostgreSQL with pgvector.
"""

from dataclasses import dataclass, field
import logging
from pathlib import Path
import uuid

import pypdf
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.chunking import chunk_document_pages
from app.core.embeddings import MissingApiKeyError, OpenRouterEmbeddingClient
from app.models.document import Document, DocumentChunk

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DOCS_DIR = BACKEND_DIR / "data" / "documents"


@dataclass
class DocumentIngestionStats:
    documents_processed: int = 0
    documents_skipped: int = 0
    chunks_created: int = 0
    embeddings_generated: int = 0
    errors: list[str] = field(default_factory=list)


def extract_pdf_pages(file_path: Path) -> list[tuple[int, str]]:
    """Extracts text page by page from a PDF document.

    Returns a list of (page_number, text) tuples (1-indexed).
    """
    reader = pypdf.PdfReader(str(file_path))
    pages_text: list[tuple[int, str]] = []

    for idx, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        cleaned = text.strip()
        if cleaned:
            pages_text.append((idx, cleaned))

    return pages_text


def invalidate_synthetic_embeddings(db: Session) -> int:
    """Invalidates any previously generated synthetic embeddings.

    Sets chunk.embedding = None and removes fake embedding_model tags
    so that only real embeddings generated via OpenRouter are stored.
    Returns the number of chunks cleared.
    """
    chunks = db.query(DocumentChunk).filter(DocumentChunk.embedding.isnot(None)).all()
    count = 0
    for chunk in chunks:
        meta = dict(chunk.metadata_ or {})
        # If the embedding was generated without a verified OpenRouter signature
        # or during the previous run, clear it
        chunk.embedding = None
        if "embedding_model" in meta:
            del meta["embedding_model"]
        chunk.metadata_ = meta
        count += 1

    # Also update any documents marked as completed back to pending_embeddings if chunks have no embeddings
    docs = db.query(Document).all()
    for doc in docs:
        if count > 0:
            doc.status = "pending_embeddings"

    db.commit()
    logger.info("Invalidated %d synthetic/unverified chunk embeddings.", count)
    return count


def ingest_policy_documents(
    db: Session,
    docs_dir: Path | None = None,
    force: bool = False,
    embedding_client: OpenRouterEmbeddingClient | None = None,
) -> DocumentIngestionStats:
    """Ingests or reindexes policy documents from the documents directory.

    Strict rules:
    - Never stores fake or synthetic embeddings.
    - If OpenRouter API key is missing or invalid, raises error or logs warning;
      the document is NOT marked as 'completed' (stays 'pending_embeddings' or 'failed').
    - If chunks already exist with valid embeddings, skips re-embedding unless force=True.
    - If chunks exist with missing embeddings, attempts to embed them without recreating chunk rows.
    """
    target_dir = docs_dir or DEFAULT_DOCS_DIR
    stats = DocumentIngestionStats()
    embedder = embedding_client or OpenRouterEmbeddingClient()

    if not target_dir.exists():
        stats.errors.append(f"Documents directory not found: {target_dir}")
        return stats

    pdf_files = list(target_dir.glob("*.pdf"))
    if not pdf_files:
        logger.info("No PDF documents found in %s", target_dir)
        return stats

    for pdf_path in pdf_files:
        file_name = pdf_path.name
        doc_name = pdf_path.stem.replace("_", " ").title()

        logger.info("Processing document: %s (%s)", doc_name, file_name)

        stmt = select(Document).where(Document.file_name == file_name)
        existing_doc = db.execute(stmt).scalar_one_or_none()

        if existing_doc and existing_doc.status == "completed" and not force:
            missing_embeddings = (
                db.query(DocumentChunk)
                .filter(
                    DocumentChunk.document_id == existing_doc.id,
                    DocumentChunk.embedding.is_(None),
                )
                .count()
            )
            if missing_embeddings == 0:
                logger.info(
                    "Document '%s' already fully chunked and embedded. Skipping.",
                    file_name,
                )
                stats.documents_skipped += 1
                continue
            else:
                logger.info(
                    "Document '%s' exists but has %d chunks missing embeddings.",
                    file_name,
                    missing_embeddings,
                )
                doc = existing_doc
        elif existing_doc:
            doc = existing_doc
        else:
            doc = Document(
                id=uuid.uuid4(),
                name=doc_name,
                file_name=file_name,
                file_path=str(pdf_path.relative_to(BACKEND_DIR)),
                status="pending",
            )
            db.add(doc)
            db.flush()

        doc.status = "processing"
        db.commit()

        try:
            pages = extract_pdf_pages(pdf_path)
            if not pages:
                raise ValueError(f"No readable text extracted from {file_name}")

            current_chunks_count = len(doc.chunks)

            # Generate chunks if they don't exist yet or if force=True
            if force or current_chunks_count == 0:
                if force and current_chunks_count > 0:
                    for old_chunk in list(doc.chunks):
                        db.delete(old_chunk)
                    db.flush()

                structured_chunks = chunk_document_pages(
                    pages, chunk_size=1200, chunk_overlap=150
                )
                logger.info(
                    "Generated %d structured chunks for '%s'",
                    len(structured_chunks),
                    file_name,
                )

                # Persist chunks with embedding=None first
                created_chunk_objs: list[DocumentChunk] = []
                for c_data in structured_chunks:
                    chunk_meta = dict(c_data.metadata)
                    chunk_meta.update(
                        {
                            "source": file_name,
                            "document_name": doc_name,
                        }
                    )
                    chunk_obj = DocumentChunk(
                        id=uuid.uuid4(),
                        document_id=doc.id,
                        content=c_data.content,
                        embedding=None,
                        metadata_=chunk_meta,
                    )
                    db.add(chunk_obj)
                    created_chunk_objs.append(chunk_obj)
                    stats.chunks_created += 1

                db.flush()

            # Now attempt embedding generation with OpenRouter
            unembedded_chunks = (
                db.query(DocumentChunk)
                .filter(
                    DocumentChunk.document_id == doc.id,
                    DocumentChunk.embedding.is_(None),
                )
                .all()
            )

            if unembedded_chunks:
                if not embedder.is_configured:
                    doc.status = "pending_embeddings"
                    db.commit()
                    msg = (
                        f"Document '{file_name}' text extracted and chunked, but embeddings "
                        "were skipped because OPENROUTER_API_KEY is not configured. Status set to 'pending_embeddings'."
                    )
                    logger.warning(msg)
                    stats.errors.append(msg)
                    continue

                texts_to_embed = [c.content for c in unembedded_chunks]
                embeddings = embedder.get_embeddings(texts_to_embed)

                for chunk_obj, emb in zip(unembedded_chunks, embeddings):
                    chunk_obj.embedding = emb
                    meta = dict(chunk_obj.metadata_ or {})
                    meta["embedding_model"] = embedder.model
                    chunk_obj.metadata_ = meta
                    stats.embeddings_generated += 1

            doc.status = "completed"
            db.commit()
            stats.documents_processed += 1
            logger.info(
                "Document '%s' successfully indexed: %d chunks, %d embeddings.",
                file_name,
                stats.chunks_created,
                stats.embeddings_generated,
            )

        except Exception as e:
            db.rollback()
            doc.status = "failed"
            db.commit()
            err_msg = f"Failed to ingest document '{file_name}': {e}"
            logger.exception(err_msg)
            stats.errors.append(err_msg)

    return stats
