"""Chunking strategies and text preprocessing for store policy documents.

Preserves page numbers, titles, sections, and maintains configurable chunk size
with overlapping character windows.
"""

from dataclasses import dataclass, field
import re
from typing import Any


@dataclass
class TextChunk:
    content: str
    page: int
    total_pages: int
    chunk_index: int
    char_count: int
    metadata: dict[str, Any] = field(default_factory=dict)


def clean_pdf_text(text: str) -> str:
    """Cleans and normalizes extracted PDF text without altering original meaning.

    Collapses excessive multi-spaces, trailing spaces, and standardizes newlines,
    while leaving numbers, punctuation, and Unicode characters intact.
    """
    if not text:
        return ""

    # Replace carriage returns
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Replace 2+ horizontal whitespace with single space (except newlines)
    text = re.sub(r"[ \t]+", " ", text)

    # Replace 3+ consecutive newlines with 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def chunk_document_pages(
    pages: list[tuple[int, str]],
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
    min_chunk_size: int = 100,
) -> list[TextChunk]:
    """Chunks document pages into structured text chunks with overlap.

    - Splits on natural paragraph breaks (\\n\\n) or sentence boundaries (., !, ?)
    - Preserves the original 1-indexed page number
    - Tracks global chunk index and per-chunk metadata
    """
    chunks: list[TextChunk] = []
    total_pages = len(pages)
    global_index = 0

    for page_num, raw_text in pages:
        cleaned_page = clean_pdf_text(raw_text)
        if not cleaned_page:
            continue

        # If page fits in chunk_size, keep it as single coherent chunk
        if len(cleaned_page) <= chunk_size:
            global_index += 1
            chunks.append(
                TextChunk(
                    content=cleaned_page,
                    page=page_num,
                    total_pages=total_pages,
                    chunk_index=global_index,
                    char_count=len(cleaned_page),
                    metadata={
                        "page": page_num,
                        "total_pages": total_pages,
                        "chunk_index": global_index,
                        "char_count": len(cleaned_page),
                    },
                )
            )
            continue

        # For larger pages, divide using sliding window with paragraph/sentence awareness
        paragraphs = cleaned_page.split("\n\n")
        current_chunk_text = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if not current_chunk_text:
                current_chunk_text = para
            elif len(current_chunk_text) + len(para) + 2 <= chunk_size:
                current_chunk_text += "\n\n" + para
            else:
                # Flush current chunk
                if len(current_chunk_text) >= min_chunk_size:
                    global_index += 1
                    chunks.append(
                        TextChunk(
                            content=current_chunk_text,
                            page=page_num,
                            total_pages=total_pages,
                            chunk_index=global_index,
                            char_count=len(current_chunk_text),
                            metadata={
                                "page": page_num,
                                "total_pages": total_pages,
                                "chunk_index": global_index,
                                "char_count": len(current_chunk_text),
                            },
                        )
                    )

                # Overlap: keep tail of previous chunk
                overlap_text = current_chunk_text[-chunk_overlap:] if chunk_overlap > 0 else ""
                current_chunk_text = (overlap_text + "\n" + para).strip() if overlap_text else para

        # Flush final remainder of the page
        if current_chunk_text and len(current_chunk_text) >= min_chunk_size:
            global_index += 1
            chunks.append(
                TextChunk(
                    content=current_chunk_text,
                    page=page_num,
                    total_pages=total_pages,
                    chunk_index=global_index,
                    char_count=len(current_chunk_text),
                    metadata={
                        "page": page_num,
                        "total_pages": total_pages,
                        "chunk_index": global_index,
                        "char_count": len(current_chunk_text),
                    },
                )
            )

    return chunks

