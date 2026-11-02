"""Document ingestion module for Empório da Música policies and knowledge base.

Extracts text from PDF documents in backend/data/documents/, creates Document
and DocumentChunk records in PostgreSQL, and tracks processing status
('pending' -> 'processing' -> 'completed' / 'failed').
"""

from dataclasses import dataclass, field
import logging
from pathlib import Path
import uuid

import pypdf
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DOCS_DIR = BACKEND_DIR / "data" / "documents"


@dataclass
class DocumentIngestionStats:
    documents_processed: int = 0
    documents_skipped: int = 0
    chunks_created: int = 0
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


def ingest_policy_documents(
    db: Session,
    docs_dir: Path | None = None,
    force: bool = False,
) -> DocumentIngestionStats:
    """Ingests policy documents from the documents directory.

    Idempotent: if a document with the same file_name is already marked as
    'completed', it will be skipped unless force=True.
    """
    target_dir = docs_dir or DEFAULT_DOCS_DIR
    stats = DocumentIngestionStats()

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

        # Check existing registration
        stmt = select(Document).where(Document.file_name == file_name)
        existing_doc = db.execute(stmt).scalar_one_or_none()

        if existing_doc:
            if existing_doc.status == "completed" and not force:
                logger.info(
                    "Document '%s' already registered and completed. Skipping.",
                    file_name,
                )
                stats.documents_skipped += 1
                continue
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

        # Update status to processing
        doc.status = "processing"
        db.commit()

        try:
            # Extract pages
            pages = extract_pdf_pages(pdf_path)
            if not pages:
                raise ValueError(f"No readable text extracted from {file_name}")

            # If re-processing existing document, delete previous chunks
            if existing_doc and force:
                for old_chunk in list(doc.chunks):
                    db.delete(old_chunk)
                db.flush()

            # Create document chunks per page
            total_pages = len(pages)
            for page_num, text in pages:
                chunk = DocumentChunk(
                    id=uuid.uuid4(),
                    document_id=doc.id,
                    content=text,
                    embedding=None,  # Embeddings to be generated in Phase 6
                    metadata_={
                        "source": file_name,
                        "document_name": doc_name,
                        "page": page_num,
                        "total_pages": total_pages,
                        "char_count": len(text),
                    },
                )
                db.add(chunk)
                stats.chunks_created += 1

            doc.status = "completed"
            db.commit()
            stats.documents_processed += 1
            logger.info(
                "Document '%s' processed successfully: %d chunks created.",
                file_name,
                len(pages),
            )
        except Exception as e:
            db.rollback()
            doc.status = "failed"
            db.commit()
            err_msg = f"Failed to ingest document '{file_name}': {e}"
            logger.exception(err_msg)
            stats.errors.append(err_msg)

    return stats

