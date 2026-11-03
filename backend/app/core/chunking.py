"""Structure-aware chunking strategy for store policy documents.

Preserves document section hierarchy (headings, subsections) directly in
chunk text and metadata. Tracks page provenance at the line/segment level
directly during text division to accurately compute page and page_end for every chunk.
Recursively splits oversized sections using tiktoken token-based sizing.
Guarantees that no chunk exceeds target_tokens (even with overlap and post-cleaning).
Preserves Markdown table structure across chunk boundaries by repeating headers/dividers.
Never summarizes or rewrites original content.
"""

from dataclasses import dataclass, field
import re
from typing import Any

import tiktoken

# Token encoder shared across all calls (thread-safe, stateless after init)
_ENCODER = tiktoken.get_encoding("cl100k_base")

# ---------------------------------------------------------------------------
# Heading detection (generic — not hardcoded to any specific document)
# ---------------------------------------------------------------------------

# Numbered headings: "1.", "1.1", "2.3.1" etc., followed by a capitalized word
_NUMBERED_HEADING = re.compile(
    r"^(\d+)(\.\d+)*\.?\s+[A-ZÀ-ÚA-Z\u00c0-\u00ff][^:]{0,80}$"
)
# Keyword headings: Seção, Capítulo, Artigo, Parte, Anexo, TÍTULO, etc.
_KEYWORD_HEADING = re.compile(
    r"^(Seção|Capítulo|Artigo|Parte|Anexo|TÍTULO)\b",
    re.IGNORECASE,
)


def _is_heading(line: str) -> bool:
    """Returns True if the line looks like a section heading."""
    s = line.strip()
    if len(s) < 3 or len(s) > 120:
        return False
    # Markdown table delimiters or rows are never headings
    if s.startswith("|"):
        return False
    return bool(_NUMBERED_HEADING.match(s)) or bool(_KEYWORD_HEADING.match(s))


def _heading_level(line: str) -> int:
    """Returns the nesting level of a numbered heading (1, 2, 3…).

    E.g. "1. Sobre a Loja" -> 1, "1.1 Missão" -> 2, "1.1.1 Detalhe" -> 3.
    Returns 1 for keyword headings or any non-numbered heading.
    """
    m = re.match(r"^(\d+)((\.\d+)*)", line.strip())
    if m:
        dots = m.group(2).count(".")
        return dots + 1
    return 1


# ---------------------------------------------------------------------------
# Token counting helpers
# ---------------------------------------------------------------------------


def count_tokens(text: str) -> int:
    """Counts tokens using cl100k_base encoding."""
    return len(_ENCODER.encode(text))


# ---------------------------------------------------------------------------
# Text cleaning (normalisation only, no content loss)
# ---------------------------------------------------------------------------


def clean_pdf_text(text: str) -> str:
    """Normalizes extracted text without altering original meaning or table rows.

    - Replaces carriage returns.
    - Collapses horizontal whitespace on non-table lines.
    - Preserves Markdown table pipes and rows.
    - Collapses 3+ consecutive newlines to 2.
    """
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    cleaned_lines: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith("|"):
            cleaned_lines.append(stripped)
        else:
            cleaned_lines.append(re.sub(r"[ \t]+", " ", stripped))

    joined = "\n".join(cleaned_lines)
    joined = re.sub(r"\n{3,}", "\n\n", joined)
    return joined.strip()


# ---------------------------------------------------------------------------
# Provenance-preserving Segment and TextChunk data structures
# ---------------------------------------------------------------------------


@dataclass
class TextSegment:
    """A segment of text directly associated with its page of origin and structural role."""
    text: str
    page: int
    is_table_row: bool = False
    is_table_header: bool = False
    is_table_separator: bool = False
    is_heading: bool = False


@dataclass
class TextChunk:
    content: str
    page: int           # First page whose content appears in this chunk
    page_end: int       # Last page whose content appears in this chunk
    total_pages: int
    chunk_index: int
    char_count: int
    token_count: int
    section: str | None      # Top-level section title (level 1 heading)
    subsection: str | None   # Sub-section title (level 2+ heading)
    document_name: str
    source: str
    metadata: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Section accumulation with line-level page provenance
# ---------------------------------------------------------------------------


@dataclass
class _SectionLine:
    text: str
    page: int


@dataclass
class _Section:
    heading: str
    level: int
    lines: list[_SectionLine] = field(default_factory=list)
    heading_page: int = 1


def _build_sections(pages: list[tuple[int, str]]) -> list[_Section]:
    """Parses pages into a list of _Section objects with line-level page provenance."""
    sections: list[_Section] = []
    current: _Section | None = None

    for page_num, page_text in pages:
        for line in page_text.split("\n"):
            raw = line
            stripped = line.strip()

            if _is_heading(stripped):
                if current is not None:
                    sections.append(current)
                current = _Section(
                    heading=stripped,
                    level=_heading_level(stripped),
                    lines=[],
                    heading_page=page_num,
                )
            else:
                if current is None:
                    current = _Section(heading="", level=0, lines=[], heading_page=page_num)
                current.lines.append(_SectionLine(text=raw, page=page_num))

    if current is not None:
        sections.append(current)

    return sections


# ---------------------------------------------------------------------------
# Division with strict Table preservation, cell-level splitting and provenance
# ---------------------------------------------------------------------------

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-ZÀ-Ú\u00c0-\u00ff\d])")


def _split_text_to_segments(text: str, page: int, target_tokens: int) -> list[TextSegment]:
    """Recursively splits plain text into TextSegments of at most target_tokens."""
    if count_tokens(text) <= target_tokens:
        return [TextSegment(text=text, page=page)]

    # Try paragraph split
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paras) > 1:
        res = []
        for p in paras:
            res.extend(_split_text_to_segments(p, page, target_tokens))
        return res

    # Try sentence split
    sentences = [s.strip() for s in _SENTENCE_END.split(text) if s.strip()]
    if len(sentences) > 1:
        res = []
        for s in sentences:
            res.extend(_split_text_to_segments(s, page, target_tokens))
        return res

    # Try word split
    words = text.split()
    if len(words) > 1:
        res = []
        curr_words: list[str] = []
        for w in words:
            test_text = " ".join(curr_words + [w])
            if count_tokens(test_text) <= target_tokens:
                curr_words.append(w)
            else:
                if curr_words:
                    res.append(TextSegment(text=" ".join(curr_words), page=page))
                curr_words = [w]
        if curr_words:
            res.append(TextSegment(text=" ".join(curr_words), page=page))
        return res

    # Fallback to token/character slicing
    tokens = _ENCODER.encode(text)
    res = []
    start = 0
    while start < len(tokens):
        end = min(start + target_tokens, len(tokens))
        res.append(TextSegment(text=_ENCODER.decode(tokens[start:end]), page=page))
        if end >= len(tokens):
            break
        start = end
    return res


def _split_oversized_table_row(row_seg: TextSegment, target_tokens: int) -> list[TextSegment]:
    """Splits an oversized Markdown table row without losing Markdown structure.

    If a row exceeds the token budget:
    1. Parse cells from '| cell1 | cell2 | ... |'
    2. Split the widest cell content into sub-parts.
    3. First fragment keeps all cell values; continuation rows replace every other
       cell with an empty string so no cell value is duplicated across fragments.

    Fails explicitly if even a single cell fragment with empty siblings exceeds
    target_tokens, since that would indicate the token budget is too small to
    encode any useful content.
    """
    raw = row_seg.text.strip()
    if not (raw.startswith("|") and raw.endswith("|")):
        # Not a standard pipe row, fallback to text splitting
        return _split_text_to_segments(row_seg.text, row_seg.page, target_tokens)

    cells = [c.strip() for c in raw.strip("|").split("|")]
    if not cells:
        return [row_seg]

    # Find the cell with maximum tokens
    cell_tokens = [count_tokens(c) for c in cells]
    max_idx = cell_tokens.index(max(cell_tokens))
    widest_cell = cells[max_idx]

    # Budget for the widest cell when it's the only non-empty cell (continuation rows).
    # Empty siblings contribute: "| " + " | " * (n-1) + " |" overhead.
    empty_row_overhead = count_tokens("| " + " | ".join("" for _ in cells) + " |")
    # Extra tokens for continuation marker "(cont. N/M) "
    continuation_marker_max = count_tokens("(cont. 99/99) ")
    cell_budget = max(5, target_tokens - empty_row_overhead - continuation_marker_max - 2)

    cell_slices = _split_text_to_segments(widest_cell, row_seg.page, cell_budget)
    total_slices = len(cell_slices)

    result_rows: list[TextSegment] = []
    for idx, slice_seg in enumerate(cell_slices):
        if idx == 0:
            # First fragment: keep all original cell values, only replace the split cell
            new_cells = list(cells)
            new_cells[max_idx] = slice_seg.text
        else:
            # Continuation: empty all cells except the split cell to avoid duplication
            new_cells = [""] * len(cells)
            new_cells[max_idx] = f"(cont. {idx + 1}/{total_slices}) {slice_seg.text}"

        row_str = "| " + " | ".join(new_cells) + " |"

        # Fail explicitly if even this minimal row exceeds the budget
        row_tok = count_tokens(row_str)
        if row_tok > target_tokens:
            raise ValueError(
                f"Table row fragment ({row_tok} tokens) exceeds target_tokens ({target_tokens}) "
                f"even with empty sibling cells. Cell content: {slice_seg.text!r}"
            )

        result_rows.append(
            TextSegment(
                text=row_str,
                page=row_seg.page,
                is_table_row=True,
            )
        )

    return result_rows


def _split_oversized_table(
    table_segs: list[TextSegment],
    target_tokens: int,
) -> list[list[TextSegment]]:
    """Splits an oversized Markdown table across rows, repeating headers and separators on each slice.

    Guarantees:
    - Every slice starts with the original header + separator segments.
    - Every assembled slice (header + rows + newlines joining them) is verified to
      fit within target_tokens using the actual join token count, not an approximation.
    - Fails explicitly if the header alone exceeds target_tokens (safe, no silent data loss).
    - Single rows that exceed (target_tokens - header_tokens) are split via
      _split_oversized_table_row; each resulting fragment gets its own slice.
    """
    if not table_segs:
        return []

    # Segments that make up the table structure
    header_segs = [s for s in table_segs if s.is_table_header or s.is_table_separator]
    data_rows = [s for s in table_segs if not (s.is_table_header or s.is_table_separator)]

    header_text = "\n".join(s.text for s in header_segs)
    header_tokens = count_tokens(header_text)

    # If the header alone cannot fit within the budget, we cannot produce valid slices
    if header_tokens >= target_tokens:
        raise ValueError(
            f"Table header ({header_tokens} tokens) meets or exceeds target_tokens "
            f"({target_tokens}). Cannot split table with header repetition."
        )

    # Maximum tokens available for data rows in a slice
    max_row_budget = target_tokens - header_tokens - 1  # 1 for the "\n" joining header to first row

    slices: list[list[TextSegment]] = []
    curr_slice: list[TextSegment] = list(header_segs)

    for row_seg in data_rows:
        row_tok = count_tokens(row_seg.text)

        if row_tok > max_row_budget:
            # Flush current slice before handling this oversized row
            if len(curr_slice) > len(header_segs):
                # Verify the assembled slice fits before appending
                assembled_tok = count_tokens("\n".join(s.text for s in curr_slice))
                if assembled_tok > target_tokens:
                    raise ValueError(
                        f"Assembled table slice ({assembled_tok} tokens) exceeds "
                        f"target_tokens ({target_tokens}). This is a bug in slice assembly."
                    )
                slices.append(curr_slice)
                curr_slice = list(header_segs)

            # Split the oversized row; each sub-row gets its own slice
            split_rows = _split_oversized_table_row(row_seg, max_row_budget)
            for sr in split_rows:
                candidate = list(header_segs) + [sr]
                assembled_tok = count_tokens("\n".join(s.text for s in candidate))
                if assembled_tok > target_tokens:
                    raise ValueError(
                        f"Split table row fragment slice ({assembled_tok} tokens) exceeds "
                        f"target_tokens ({target_tokens}). This is a bug in row splitting."
                    )
                slices.append(candidate)
            continue

        # Try to add row to current slice; use actual join token count for accuracy
        candidate = curr_slice + [row_seg]
        candidate_tok = count_tokens("\n".join(s.text for s in candidate))
        if candidate_tok <= target_tokens:
            curr_slice = candidate
        else:
            # Flush current slice and start a new one with this row
            if len(curr_slice) > len(header_segs):
                assembled_tok = count_tokens("\n".join(s.text for s in curr_slice))
                if assembled_tok > target_tokens:
                    raise ValueError(
                        f"Assembled table slice ({assembled_tok} tokens) exceeds "
                        f"target_tokens ({target_tokens}). This is a bug in slice assembly."
                    )
                slices.append(curr_slice)

            new_slice = list(header_segs) + [row_seg]
            new_tok = count_tokens("\n".join(s.text for s in new_slice))
            if new_tok > target_tokens:
                raise ValueError(
                    f"Single data row + header ({new_tok} tokens) exceeds target_tokens "
                    f"({target_tokens}) even on a fresh slice. Row: {row_seg.text!r}"
                )
            curr_slice = new_slice

    # Flush the last slice
    if len(curr_slice) > len(header_segs):
        assembled_tok = count_tokens("\n".join(s.text for s in curr_slice))
        if assembled_tok > target_tokens:
            raise ValueError(
                f"Final assembled table slice ({assembled_tok} tokens) exceeds "
                f"target_tokens ({target_tokens}). This is a bug in slice assembly."
            )
        slices.append(curr_slice)

    return slices


def _take_overlap_segments(
    segments: list[TextSegment],
    token_budget: int,
) -> list[TextSegment]:
    """Takes segments from the tail of *segments* up to *token_budget*, preserving their real pages."""
    if token_budget <= 0 or not segments:
        return []

    chosen: list[TextSegment] = []
    accum_tokens = 0

    # Traverse from tail to head
    for seg in reversed(segments):
        # Do not include table headers or table rows in general text overlap
        if seg.is_table_header or seg.is_table_separator or seg.is_table_row:
            continue
        seg_tok = count_tokens(seg.text)
        sep_tok = count_tokens("\n\n") if chosen else 0

        if accum_tokens + sep_tok + seg_tok <= token_budget:
            chosen.insert(0, seg)
            accum_tokens += sep_tok + seg_tok
        else:
            # Take a sub-slice of this segment if space allows
            remain_budget = token_budget - accum_tokens - sep_tok
            if remain_budget >= 10:
                tokens = _ENCODER.encode(seg.text)
                tail_tokens = tokens[-remain_budget:]
                slice_text = _ENCODER.decode(tail_tokens)
                if slice_text.strip():
                    chosen.insert(0, TextSegment(text=slice_text, page=seg.page))
            break

    return chosen


def _merge_segments_to_chunks(
    segments: list[TextSegment],
    target_tokens: int,
    overlap_tokens: int,
    current_parent_heading: str | None = None,
    sub_heading: str | None = None,
) -> list[tuple[str, list[int]]]:
    """Merges TextSegments into chunk tuples of (chunk_content, list_of_pages_in_chunk).

    Guarantees:
    - Never exceeds target_tokens.
    - Pages are tracked directly from segments present in the chunk.
    - Tables are sliced row-by-row with repeated headers/separators if they exceed target_tokens.
    - Overlap preserves the exact source page of each overlapping segment.
    """
    chunks_out: list[tuple[str, list[int]]] = []

    # First pass: group into atomic units (table blocks or text units)
    atomic_units: list[list[TextSegment]] = []
    idx = 0
    while idx < len(segments):
        seg = segments[idx]
        if seg.is_table_header or seg.is_table_separator or seg.is_table_row:
            table_block = []
            while idx < len(segments) and (
                segments[idx].is_table_header
                or segments[idx].is_table_separator
                or segments[idx].is_table_row
            ):
                table_block.append(segments[idx])
                idx += 1
            tbl_text = "\n".join(s.text for s in table_block)
            if count_tokens(tbl_text) > target_tokens:
                tbl_slices = _split_oversized_table(table_block, target_tokens)
                for sl in tbl_slices:
                    atomic_units.append(sl)
            else:
                atomic_units.append(table_block)
        else:
            if count_tokens(seg.text) > target_tokens:
                split_segs = _split_text_to_segments(seg.text, seg.page, target_tokens)
                for s in split_segs:
                    atomic_units.append([s])
            else:
                atomic_units.append([seg])
            idx += 1

    # Second pass: merge atomic units greedily
    curr_segs: list[TextSegment] = []
    curr_text = ""
    curr_tokens = 0

    for unit in atomic_units:
        unit_text = "\n".join(s.text for s in unit)
        unit_tokens = count_tokens(unit_text)

        sep_tokens = count_tokens("\n\n") if curr_text else 0
        if curr_tokens + sep_tokens + unit_tokens <= target_tokens:
            curr_segs.extend(unit)
            curr_text = (curr_text + "\n\n" + unit_text).strip() if curr_text else unit_text
            curr_tokens = count_tokens(curr_text)
        else:
            if curr_segs:
                chunk_pages = [
                    s.page for s in curr_segs
                    if not (s.is_heading and s.text == current_parent_heading and sub_heading)
                ]
                if not chunk_pages:
                    chunk_pages = [s.page for s in curr_segs]
                chunks_out.append((curr_text, chunk_pages))

                # Apply overlap from previous chunk if unit is not a standalone table slice
                is_unit_table = any(s.is_table_row or s.is_table_header or s.is_table_separator for s in unit)
                if not is_unit_table and overlap_tokens > 0:
                    # sep_tokens here is the "\n\n" separator between overlap content and unit content
                    overlap_sep_tokens = count_tokens("\n\n")
                    budget = max(0, min(overlap_tokens, target_tokens - unit_tokens - overlap_sep_tokens))
                    overlap_segs = _take_overlap_segments(curr_segs, budget)
                    if overlap_segs:
                        candidate_segs = list(overlap_segs) + list(unit)
                        candidate_text = "\n\n".join(s.text for s in candidate_segs).strip()
                        candidate_tokens = count_tokens(candidate_text)
                        # Reduce overlap from the front until the assembled chunk fits within target
                        while candidate_tokens > target_tokens and overlap_segs:
                            overlap_segs.pop(0)
                            if overlap_segs:
                                candidate_segs = list(overlap_segs) + list(unit)
                                candidate_text = "\n\n".join(s.text for s in candidate_segs).strip()
                                candidate_tokens = count_tokens(candidate_text)
                            else:
                                candidate_segs = list(unit)
                                candidate_text = unit_text
                                candidate_tokens = unit_tokens
                        curr_segs = candidate_segs
                        curr_text = candidate_text
                        curr_tokens = candidate_tokens
                    else:
                        curr_segs = list(unit)
                        curr_text = unit_text
                        curr_tokens = unit_tokens
                else:
                    curr_segs = list(unit)
                    curr_text = unit_text
                    curr_tokens = unit_tokens
            else:
                curr_segs = list(unit)
                curr_text = unit_text
                curr_tokens = unit_tokens

    if curr_segs and curr_text.strip():
        chunk_pages = [
            s.page for s in curr_segs
            if not (s.is_heading and s.text == current_parent_heading and sub_heading)
        ]
        if not chunk_pages:
            chunk_pages = [s.page for s in curr_segs]
        chunks_out.append((curr_text, chunk_pages))

    return chunks_out


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def chunk_document_pages(
    pages: list[tuple[int, str]],
    chunk_size: int = 500,          # in tokens
    chunk_overlap: int = 50,        # in tokens
    min_chunk_size: int = 20,       # in tokens (never drop meaningful sections)
    document_name: str = "",
    source: str = "",
) -> list[TextChunk]:
    """Chunks document pages into structured, section-aware TextChunks.

    Hierarchy & Provenance Preservation:
    1. Detects level 1 (parent) and level 2+ (child) headings.
    2. Parent headings that introduce upcoming subsections are preserved and
       injected at the top of each child chunk's text (and metadata).
    3. Self-contained parent sections with their own body text form their own chunk.
    4. Tracks line-level and segment-level page provenance directly during text division
       to calculate accurate `page` and `page_end` for every chunk without substring heuristics.
    5. No chunk exceeds `chunk_size` tokens (strictly verified after post-cleaning).
    6. Overlap is applied only when an oversized section must be divided internally,
       preserving real segment page numbers.
    7. Tables exceeding `chunk_size` are sliced between rows with headers and separators repeated.

    Args:
        pages:          List of (1-indexed page_number, page_text) tuples.
        chunk_size:     Target maximum tokens per chunk.
        chunk_overlap:  Overlap tokens when dividing an oversized section.
        min_chunk_size: Lower bound threshold for discarding empty/fragment chunks.
        document_name:  Human-readable document name stored in metadata.
        source:         File name or path stored in metadata.

    Returns:
        Ordered list of TextChunk objects.
    """
    if not pages:
        return []

    total_pages = len(pages)
    raw_sections = _build_sections(pages)

    chunks: list[TextChunk] = []
    current_parent_heading: str | None = None
    current_parent_page: int | None = None
    global_index = 0

    for i, sec in enumerate(raw_sections):
        lvl = sec.level
        hd = sec.heading
        body_lines = [l.text for l in sec.lines]
        body = "\n".join(body_lines).strip()

        if lvl == 1:
            current_parent_heading = hd
            current_parent_page = sec.heading_page
            sub_heading: str | None = None
        elif lvl >= 2:
            sub_heading = hd
        else:
            current_parent_heading = None
            current_parent_page = None
            sub_heading = None

        # Standalone parent heading with no body that introduces subsections
        # (e.g. "5. Política de Frete e Entregas")
        if lvl == 1 and not body:
            has_following_sub = (
                i + 1 < len(raw_sections) and raw_sections[i + 1].level >= 2
            )
            if has_following_sub:
                continue

        # Build segments list with exact page provenance
        section_segments: list[TextSegment] = []

        # 1. Add inherited parent heading if present
        if current_parent_heading and sub_heading:
            section_segments.append(
                TextSegment(
                    text=current_parent_heading,
                    page=current_parent_page if current_parent_page is not None else sec.heading_page,
                    is_heading=True,
                )
            )

        # 2. Add section/subsection heading if present
        if hd:
            section_segments.append(
                TextSegment(
                    text=hd,
                    page=sec.heading_page,
                    is_heading=True,
                )
            )

        # 3. Add body lines as segments (distinguishing headers, separators, data rows)
        in_table = False
        table_header_seen = False
        for line_obj in sec.lines:
            raw_text = line_obj.text.strip()
            if not raw_text:
                continue
            is_tbl = raw_text.startswith("|")
            if is_tbl:
                is_sep = bool(re.match(r"^\|\s*---.*\|$", raw_text))
                if not in_table:
                    # First line of table is the column header line
                    in_table = True
                    table_header_seen = False
                    is_hdr = True
                elif is_sep:
                    # Markdown separator line
                    table_header_seen = True
                    is_hdr = False
                elif not table_header_seen:
                    is_hdr = True
                else:
                    is_hdr = False

                section_segments.append(
                    TextSegment(
                        text=raw_text,
                        page=line_obj.page,
                        is_table_row=not (is_hdr or is_sep),
                        is_table_header=is_hdr,
                        is_table_separator=is_sep,
                    )
                )
            else:
                in_table = False
                table_header_seen = False
                section_segments.append(
                    TextSegment(
                        text=raw_text,
                        page=line_obj.page,
                    )
                )

        if not section_segments:
            continue

        full_content_test = clean_pdf_text("\n".join(s.text for s in section_segments))
        tok = count_tokens(full_content_test)
        if tok < min_chunk_size and not body:
            continue

        # Merge segments into chunks with strict token limits and direct provenance
        chunk_pieces = _merge_segments_to_chunks(
            section_segments,
            target_tokens=chunk_size,
            overlap_tokens=chunk_overlap,
            current_parent_heading=current_parent_heading,
            sub_heading=sub_heading,
        )

        for content_text, content_pages in chunk_pieces:
            cleaned_content = clean_pdf_text(content_text)
            if not cleaned_content:
                continue

            # Strict post-cleaning token count check
            piece_tok = count_tokens(cleaned_content)
            if piece_tok > chunk_size:
                # Detect if the content contains Markdown table structure
                contains_table = cleaned_content.startswith("|") or "\n|" in cleaned_content
                if contains_table:
                    raise ValueError(
                        f"Post-cleaning produced an oversized chunk ({piece_tok} tokens) "
                        f"containing Markdown table structure that cannot be safely re-split "
                        f"as plain text. This is a bug in table slicing."
                    )
                # Plain text: re-split strictly
                cleaned_segs = _split_text_to_segments(
                    cleaned_content,
                    content_pages[0] if content_pages else sec.heading_page,
                    chunk_size,
                )
                re_chunk_pieces = [(s.text, [s.page]) for s in cleaned_segs]
            else:
                re_chunk_pieces = [(cleaned_content, content_pages)]

            for sub_content, sub_pages in re_chunk_pieces:
                sub_tok = count_tokens(sub_content)
                p_start = min(sub_pages) if sub_pages else sec.heading_page
                p_end = max(sub_pages) if sub_pages else sec.heading_page

                global_index += 1
                meta: dict[str, Any] = {
                    "page": p_start,
                    "page_end": p_end,
                    "total_pages": total_pages,
                    "chunk_index": global_index,
                    "char_count": len(sub_content),
                    "token_count": sub_tok,
                    "section": current_parent_heading,
                    "subsection": sub_heading,
                    "document_name": document_name,
                    "source": source,
                }

                chunks.append(
                    TextChunk(
                        content=sub_content,
                        page=p_start,
                        page_end=p_end,
                        total_pages=total_pages,
                        chunk_index=global_index,
                        char_count=len(sub_content),
                        token_count=sub_tok,
                        section=current_parent_heading,
                        subsection=sub_heading,
                        document_name=document_name,
                        source=source,
                        metadata=meta,
                    )
                )

    return chunks
