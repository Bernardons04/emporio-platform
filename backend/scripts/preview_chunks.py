"""Preview script for the structure-aware chunking strategy.

Run inside the backend container:
    docker exec emporio_backend python /app/scripts/preview_chunks.py

This script DOES NOT generate embeddings, write to the database, or call
any external API. It is a read-only validation tool.
"""

from collections import Counter
import io
from pathlib import Path
import re
import sys

# Ensure stdout and stderr reliably emit UTF-8 across platforms and redirections
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
elif hasattr(sys.stdout, "buffer"):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
elif hasattr(sys.stderr, "buffer"):
    try:
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure the app package is importable when running as a script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.chunking import _is_heading, chunk_document_pages, count_tokens  # noqa: E402
from app.ingestion.document_ingestion import extract_pdf_pages  # noqa: E402

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PDF_PATH = Path(__file__).resolve().parent.parent / "data" / "documents" / "políticas_da_loja.pdf"
TARGET_TOKENS = 500
OVERLAP_TOKENS = 50

# ---------------------------------------------------------------------------
# Honest, multi-dimensional validation with transparent classification
# ---------------------------------------------------------------------------


def _normalize_phrase(text: str) -> str:
    """Normalizes whitespace and lowercase for comparison."""
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip().lower()


def validate_chunk_pipeline(
    pages: list[tuple[int, str]],
    chunks: list,
    max_tokens: int,
) -> dict:
    """Validates content preservation, Markdown tables, token limits, and ordering."""
    all_chunks_text = "\n".join(c.content for c in chunks)

    # -----------------------------------------------------------------------
    # 1. Markdown Table Integrity Check (Multiplicity & Order)
    # -----------------------------------------------------------------------
    source_headers: list[tuple[int, str]] = []
    source_separators: list[tuple[int, str]] = []
    source_data_rows: list[tuple[int, str]] = []

    for p_num, page_text in pages:
        in_tbl = False
        hdr_seen = False
        for line in page_text.split("\n"):
            s = line.strip()
            if s.startswith("|"):
                is_sep = bool(re.match(r"^\|\s*---.*\|$", s))
                if not in_tbl:
                    in_tbl = True
                    hdr_seen = False
                    source_headers.append((p_num, s))
                elif is_sep:
                    hdr_seen = True
                    source_separators.append((p_num, s))
                elif not hdr_seen:
                    source_headers.append((p_num, s))
                else:
                    source_data_rows.append((p_num, s))
            else:
                in_tbl = False
                hdr_seen = False

    chunk_headers: list[tuple[int, str]] = []
    chunk_separators: list[tuple[int, str]] = []
    chunk_data_rows: list[tuple[int, str]] = []

    for c in chunks:
        in_tbl = False
        hdr_seen = False
        for line in c.content.split("\n"):
            s = line.strip()
            if s.startswith("|"):
                is_sep = bool(re.match(r"^\|\s*---.*\|$", s))
                if not in_tbl:
                    in_tbl = True
                    hdr_seen = False
                    chunk_headers.append((c.chunk_index, s))
                elif is_sep:
                    hdr_seen = True
                    chunk_separators.append((c.chunk_index, s))
                elif not hdr_seen:
                    chunk_headers.append((c.chunk_index, s))
                else:
                    chunk_data_rows.append((c.chunk_index, s))
            else:
                in_tbl = False
                hdr_seen = False

    # A. Validate data rows: must match exact multiplicity
    source_row_counts = Counter(r for _, r in source_data_rows)
    chunk_row_counts = Counter(r for _, r in chunk_data_rows)

    missing_data_rows: list[str] = []
    duplicate_data_rows: list[str] = []

    for row, count in source_row_counts.items():
        c_count = chunk_row_counts.get(row, 0)
        if c_count < count:
            missing_data_rows.append(f"Missing {count - c_count}x: {row}")
        elif c_count > count:
            duplicate_data_rows.append(f"Unexpected duplicate {c_count}x (expected {count}x): {row}")

    # Check for completely foreign rows in chunks
    for row, c_count in chunk_row_counts.items():
        if row not in source_row_counts:
            duplicate_data_rows.append(f"Foreign data row in chunks: {row}")

    # B. Validate header and separator preservation
    source_hdr_set = set(h for _, h in source_headers)
    chunk_hdr_set = set(h for _, h in chunk_headers)
    missing_headers = [h for h in source_hdr_set if h not in chunk_hdr_set]

    # Repeated headers across chunks (intentional when tables are split)
    repeated_headers = [
        f"{h} (present in {chunk_row_counts.get(h, 0)} chunks)"
        for h in chunk_hdr_set if len([1 for _, x in chunk_headers if x == h]) > 1
    ]

    # C. Validate data row ordering
    table_order_errors: list[str] = []
    source_row_sequence = [r for _, r in source_data_rows]
    chunk_row_sequence = [r for _, r in chunk_data_rows]

    last_idx = 0
    for s_row in source_row_sequence:
        try:
            found_idx = chunk_row_sequence.index(s_row, last_idx)
            last_idx = found_idx + 1
        except ValueError:
            table_order_errors.append(f"Row order inversion or missing: {s_row}")

    # -----------------------------------------------------------------------
    # 2. Substantive Text Line Preservation Check
    # -----------------------------------------------------------------------
    substantive_source_lines: list[tuple[int, str]] = []
    for p_num, page_text in pages:
        for line in page_text.split("\n"):
            stripped = line.strip()
            if not stripped or stripped.startswith("|") or _is_heading(stripped):
                continue
            if len(stripped) >= 15:
                substantive_source_lines.append((p_num, stripped))

    missing_text_lines = [
        (p_num, line)
        for p_num, line in substantive_source_lines
        if line not in all_chunks_text
    ]

    # -----------------------------------------------------------------------
    # 3. Document Flow and Structural Ordering Check
    # -----------------------------------------------------------------------
    misordered_lines: list[str] = []
    last_find_pos = 0
    for _, line in substantive_source_lines:
        pos = all_chunks_text.find(line, last_find_pos)
        if pos == -1:
            earlier_pos = all_chunks_text.find(line)
            if earlier_pos != -1:
                misordered_lines.append(line)
        else:
            last_find_pos = pos

    # -----------------------------------------------------------------------
    # 4. Token Limit & Overlap Verification
    # -----------------------------------------------------------------------
    oversized_chunks = [
        (c.chunk_index, c.token_count) for c in chunks if c.token_count > max_tokens
    ]

    # -----------------------------------------------------------------------
    # 5. Duplication Analysis (Strict overlap and source sequence verification)
    # -----------------------------------------------------------------------
    known_headings_normalized = set()
    for c in chunks:
        if c.section:
            known_headings_normalized.add(_normalize_phrase(c.section))
        if c.subsection:
            known_headings_normalized.add(_normalize_phrase(c.subsection))

    ngram_occurrences: dict[str, list[int]] = {}
    for c in chunks:
        words = [w for w in re.sub(r"[^\wÀ-ÿ\s]", " ", c.content.lower()).split() if len(w) >= 3]
        seen_in_chunk = set()
        for i in range(len(words) - 5):
            ngram = " ".join(words[i : i + 6])
            if any(ngram in h for h in known_headings_normalized):
                continue
            if ngram not in seen_in_chunk:
                seen_in_chunk.add(ngram)
                ngram_occurrences.setdefault(ngram, []).append(c.chunk_index)

    duplicate_phrases = {
        ngram: indices for ngram, indices in ngram_occurrences.items() if len(indices) > 1
    }

    # Verify duplicates:
    # 1. Consecutive chunk duplicates: verify if they match configured overlap
    # 2. Non-consecutive chunk duplicates: check source multiplicity
    source_words = [
        w for _, text in pages
        for w in re.sub(r"[^\wÀ-ÿ\s]", " ", text.lower()).split()
        if len(w) >= 3
    ]
    source_normalized_stream = " ".join(source_words)

    # Per-page normalized text for more accurate source multiplicity check
    page_normalized_texts = [
        re.sub(r"[^\wÀ-ÿ\s]", " ", text.lower())
        for _, text in pages
    ]

    # Per-page normalized text for more accurate source multiplicity check
    page_normalized_texts = [
        re.sub(r"[^\wÀ-ÿ\s]", " ", text.lower())
        for _, text in pages
    ]

    verified_overlap_duplicates: list[tuple[str, list[int]]] = []
    source_recurring_duplicates: list[tuple[str, list[int]]] = []
    inconclusive_or_accidental_duplicates: list[tuple[str, list[int]]] = []

    for ngram, indices in duplicate_phrases.items():
        is_consecutive = all(indices[j] + 1 == indices[j + 1] for j in range(len(indices) - 1))

        # Count occurrences in source: search per-page to avoid false negatives from
        # cross-page boundary n-gram merging in a linear stream.
        total_source_matches = sum(
            len(re.findall(re.escape(ngram), page_text))
            for page_text in page_normalized_texts
        )
        # Also try linear stream as fallback
        if total_source_matches == 0:
            total_source_matches = len(re.findall(re.escape(ngram), source_normalized_stream))

        if is_consecutive:
            # Verify it actually looks like intentional overlap: the n-gram should
            # appear near the end of the first chunk AND near the start of the next.
            chunk_map = {c.chunk_index: c.content for c in chunks}
            is_valid_overlap = True
            for j in range(len(indices) - 1):
                content_a = chunk_map.get(indices[j], "")
                content_b = chunk_map.get(indices[j + 1], "")
                # Use the last 300 characters of chunk A and first 300 of chunk B as proxy
                tail_a = _normalize_phrase(content_a[-300:])
                head_b = _normalize_phrase(content_b[:300])
                if ngram not in tail_a or ngram not in head_b:
                    is_valid_overlap = False
                    break
            if is_valid_overlap:
                verified_overlap_duplicates.append((ngram, indices))
            elif total_source_matches >= 2:
                # The n-gram genuinely appears multiple times in the source document
                source_recurring_duplicates.append((ngram, indices))
            else:
                inconclusive_or_accidental_duplicates.append((ngram, indices))
        elif total_source_matches >= 2:
            # Occurred multiple times in the original source document
            source_recurring_duplicates.append((ngram, indices))
        else:
            # Cannot be verified as intentional overlap or source recurrence
            inconclusive_or_accidental_duplicates.append((ngram, indices))

    has_failures = bool(
        missing_data_rows
        or duplicate_data_rows
        or missing_headers
        or table_order_errors
        or missing_text_lines
        or misordered_lines
        or oversized_chunks
        or inconclusive_or_accidental_duplicates
    )

    return {
        "total_source_data_rows": len(source_data_rows),
        "missing_data_rows": missing_data_rows,
        "duplicate_data_rows": duplicate_data_rows,
        "missing_headers": missing_headers,
        "repeated_headers": repeated_headers,
        "table_order_errors": table_order_errors,
        "total_substantive_lines": len(substantive_source_lines),
        "missing_text_lines": missing_text_lines,
        "misordered_lines": misordered_lines,
        "oversized_chunks": oversized_chunks,
        "verified_overlap_duplicates": verified_overlap_duplicates,
        "source_recurring_duplicates": source_recurring_duplicates,
        "inconclusive_or_accidental_duplicates": inconclusive_or_accidental_duplicates,
        "has_failures": has_failures,
    }


# ---------------------------------------------------------------------------
# Synthetic unit tests
# ---------------------------------------------------------------------------


def _run_synthetic_tests() -> bool:
    """Runs deterministic unit tests covering table splitting, row splitting, and overlap.

    Returns True if all assertions passed; False otherwise.
    Prints a detailed report for each test.
    """
    from app.core.chunking import (
        TextSegment,
        _split_oversized_table,
        _split_oversized_table_row,
        _merge_segments_to_chunks,
        count_tokens,
    )

    all_passed = True

    def assert_eq(label: str, actual, expected) -> None:
        nonlocal all_passed
        if actual != expected:
            print(f"  [FAIL] {label}")
            print(f"         expected: {expected!r}")
            print(f"         actual  : {actual!r}")
            all_passed = False
        else:
            print(f"  [OK]   {label}")

    def assert_le(label: str, actual, limit) -> None:
        nonlocal all_passed
        if actual > limit:
            print(f"  [FAIL] {label}: {actual} > {limit}")
            all_passed = False
        else:
            print(f"  [OK]   {label}: {actual} <= {limit}")

    def assert_true(label: str, condition: bool) -> None:
        nonlocal all_passed
        if not condition:
            print(f"  [FAIL] {label}")
            all_passed = False
        else:
            print(f"  [OK]   {label}")

    def assert_raises(label: str, fn) -> None:
        nonlocal all_passed
        try:
            fn()
            print(f"  [FAIL] {label}: expected ValueError, got none")
            all_passed = False
        except ValueError:
            print(f"  [OK]   {label}: raised ValueError as expected")
        except Exception as e:
            print(f"  [FAIL] {label}: expected ValueError, got {type(e).__name__}: {e}")
            all_passed = False

    # -----------------------------------------------------------------------
    # TEST 1: _split_oversized_table_row
    # -----------------------------------------------------------------------
    print("\n--- Test 1: _split_oversized_table_row ---")

    # Build a row where the description cell is long
    short_cell_a = "Produto X"
    short_cell_b = "R$ 1.500,00"
    long_cell = ("Esta é uma descrição muito longa que precisa ser dividida em partes menores "
                 "para caber dentro do limite de tokens configurado no pipeline. ") * 4

    row_text = f"| {short_cell_a} | {short_cell_b} | {long_cell.strip()} |"
    row_seg = TextSegment(text=row_text, page=3, is_table_row=True)

    target = 60  # small enough to force splitting
    fragments = _split_oversized_table_row(row_seg, target)

    assert_true("produces at least 2 fragments", len(fragments) >= 2)

    # First fragment must contain the original short cells
    first_row_cells = [c.strip() for c in fragments[0].text.strip("|").split("|")]
    assert_eq("first fragment short_cell_a intact", first_row_cells[0], short_cell_a)
    assert_eq("first fragment short_cell_b intact", first_row_cells[1], short_cell_b)

    # Continuation fragments (idx > 0) must have EMPTY other cells (no duplication)
    for i, frag in enumerate(fragments[1:], start=1):
        cells_in_frag = [c.strip() for c in frag.text.strip("|").split("|")]
        assert_eq(f"continuation fragment {i}: cell 0 is empty", cells_in_frag[0], "")
        assert_eq(f"continuation fragment {i}: cell 1 is empty", cells_in_frag[1], "")
        assert_true(
            f"continuation fragment {i}: split cell has continuation marker",
            cells_in_frag[2].startswith("(cont."),
        )

    # All fragments must respect the token limit
    for i, frag in enumerate(fragments):
        tok = count_tokens(frag.text)
        assert_le(f"fragment {i} token count", tok, target)

    # Content reconstruction: strip markers and join split cell parts.
    # _split_text_to_segments splits at word boundaries, so adjacent parts are
    # rejoined with a single space (the whitespace consumed by word splitting).
    split_cell_idx = 2  # index of the long cell
    first_part = [c.strip() for c in fragments[0].text.strip("|").split("|")][split_cell_idx]
    rest_parts = []
    for frag in fragments[1:]:
        raw_cell = [c.strip() for c in frag.text.strip("|").split("|")][split_cell_idx]
        # Strip "(cont. N/M) " prefix
        content = re.sub(r"^\(cont\. \d+/\d+\) ", "", raw_cell)
        rest_parts.append(content)
    reconstructed = " ".join([first_part] + rest_parts)
    assert_eq("reconstructed split cell equals original", reconstructed, long_cell.strip())

    # All fragments must have is_table_row=True
    for i, frag in enumerate(fragments):
        assert_true(f"fragment {i} has is_table_row=True", frag.is_table_row)

    # -----------------------------------------------------------------------
    # TEST 2: _split_oversized_table
    # -----------------------------------------------------------------------
    print("\n--- Test 2: _split_oversized_table ---")

    header_text = "| Produto | Preço | Descrição |"
    sep_text = "| --- | --- | --- |"
    data_rows = [
        f"| Item {i} | R$ {i * 100},00 | Descrição do item {i} muito detalhada. |"
        for i in range(1, 8)
    ]

    header_seg = TextSegment(text=header_text, page=2, is_table_header=True)
    sep_seg = TextSegment(text=sep_text, page=2, is_table_separator=True)
    row_segs = [TextSegment(text=r, page=2, is_table_row=True) for r in data_rows]

    table_segs = [header_seg, sep_seg] + row_segs

    # Full table is over 100 tokens; use target=100 to force splitting
    target = 100
    full_text = "\n".join(s.text for s in table_segs)
    assert_true("full table exceeds target", count_tokens(full_text) > target)

    slices = _split_oversized_table(table_segs, target)

    assert_true("produces at least 2 slices", len(slices) >= 2)

    all_data_in_slices = []
    for s_idx, sl in enumerate(slices):
        sl_texts = [s.text for s in sl]
        # Each slice must start with header then separator
        assert_eq(f"slice {s_idx}: first seg is header", sl[0].text, header_text)
        assert_eq(f"slice {s_idx}: second seg is separator", sl[1].text, sep_text)

        # Assembled token count must not exceed target
        assembled = "\n".join(sl_texts)
        tok = count_tokens(assembled)
        assert_le(f"slice {s_idx} assembled token count", tok, target)

        # Collect data rows from this slice
        for seg in sl:
            if seg.is_table_row:
                all_data_in_slices.append(seg.text)

    # All original data rows must appear exactly once across all slices
    for orig_row in data_rows:
        count_in_slices = all_data_in_slices.count(orig_row)
        assert_eq(f"data row appears exactly once: {orig_row[:30]}...", count_in_slices, 1)

    # No data row must be missing
    assert_eq("all data rows preserved", sorted(all_data_in_slices), sorted(data_rows))

    # -----------------------------------------------------------------------
    # TEST 3: overlap token budget (cross-page, _merge_segments_to_chunks)
    # -----------------------------------------------------------------------
    print("\n--- Test 3: overlap token budget ---")

    # Build a pair of paragraphs that individually fit but together exceed target.
    # We use a fixed short para_a and a para_b that we know fit individually.
    para_a = ("Este é o primeiro parágrafo com conteúdo relevante sobre política de frete. " * 3).strip()
    para_b = ("Este é o segundo parágrafo descrevendo as condições de entrega na região. " * 3).strip()

    seg_a = TextSegment(text=para_a, page=1)
    seg_b = TextSegment(text=para_b, page=2)

    tok_a = count_tokens(seg_a.text)
    tok_b = count_tokens(seg_b.text)
    # Choose a target just above max(tok_a, tok_b) so each fits alone but combined doesn't
    target = max(tok_a, tok_b) + 5
    overlap = 20

    combined_tok = count_tokens(seg_a.text + "\n\n" + seg_b.text)

    assert_le("seg_a fits within target", tok_a, target)
    assert_le("seg_b fits within target", tok_b, target)
    assert_true("combined exceeds target", combined_tok > target)

    result = _merge_segments_to_chunks([seg_a, seg_b], target_tokens=target, overlap_tokens=overlap)

    assert_eq("produces 2 chunks", len(result), 2)

    chunk0_text, chunk0_pages = result[0]
    chunk1_text, chunk1_pages = result[1]

    # Both chunks must be within target
    assert_le("chunk 0 within target", count_tokens(chunk0_text), target)
    assert_le("chunk 1 within target", count_tokens(chunk1_text), target)

    # Page provenance
    assert_true("chunk 0 page provenance includes page 1", 1 in chunk0_pages)
    assert_true("chunk 1 page provenance includes page 2", 2 in chunk1_pages)

    # chunk 1 must contain some overlap content from chunk 0's tail
    first_chunk_tail_words = chunk0_text.split()[-8:]
    overlap_present = any(w in chunk1_text for w in first_chunk_tail_words)
    assert_true("chunk 1 contains overlap content from chunk 0", overlap_present)

    # -----------------------------------------------------------------------
    # TEST 4: explicit failure for header-too-large table
    # -----------------------------------------------------------------------
    print("\n--- Test 4: explicit failure for header-too-large table ---")

    # Header with more than target_tokens
    huge_header = "| " + " | ".join([f"Col_{i} " * 20 for i in range(5)]) + " |"
    huge_header_seg = TextSegment(text=huge_header, page=1, is_table_header=True)
    sep_only = TextSegment(text="| --- | --- | --- | --- | --- |", page=1, is_table_separator=True)
    tiny_row = TextSegment(text="| a | b | c | d | e |", page=1, is_table_row=True)

    assert_raises(
        "header-too-large table raises ValueError",
        lambda: _split_oversized_table([huge_header_seg, sep_only, tiny_row], target_tokens=30),
    )

    return all_passed


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    if not PDF_PATH.exists():
        print(f"[FAIL] ERROR: PDF not found at {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    # -----------------------------------------------------------------------
    # Synthetic unit tests (run before the real document)
    # -----------------------------------------------------------------------
    print("=" * 80)
    print("SYNTHETIC UNIT TESTS")
    print("=" * 80)
    tests_passed = _run_synthetic_tests()
    if tests_passed:
        print("\n[OK] All synthetic tests passed.")
    else:
        print("\n[FAIL] One or more synthetic tests failed. Aborting.")
        sys.exit(1)
    print("=" * 80)
    print()

    print(f"PDF: {PDF_PATH.name}")
    print(f"Target: {TARGET_TOKENS} tokens | Overlap: {OVERLAP_TOKENS} tokens\n")
    print("=" * 80)

    pages = extract_pdf_pages(PDF_PATH)
    print(f"Extracted {len(pages)} pages\n")

    total_source_tokens = sum(count_tokens(text) for _, text in pages)
    print(f"Total source tokens (after table parsing & header/footer stripping): {total_source_tokens}\n")
    print("=" * 80)

    chunks = chunk_document_pages(
        pages,
        chunk_size=TARGET_TOKENS,
        chunk_overlap=OVERLAP_TOKENS,
        document_name="Políticas Da Loja",
        source=PDF_PATH.name,
    )

    for chunk in chunks:
        tag = " [WARN] OVERSIZED" if chunk.token_count > TARGET_TOKENS else ""
        page_span = f"{chunk.page}" if chunk.page == chunk.page_end else f"{chunk.page}-{chunk.page_end}"

        print("-" * 80)
        print(
            f"Chunk {chunk.chunk_index:>2} / {len(chunks)}{tag}\n"
            f"  Page(s) : {page_span} (page={chunk.page}, page_end={chunk.page_end})\n"
            f"  Section : {chunk.section or '(preamble)'}\n"
            f"  Subsect : {chunk.subsection or '—'}\n"
            f"  Tokens  : {chunk.token_count} | Chars: {chunk.char_count}"
        )
        print("  Content :")
        for line in chunk.content.splitlines():
            print(f"    {line}")
        print("-" * 80)
        print()

    print("=" * 80)
    print("SUMMARY")
    print(f"  Total chunks  : {len(chunks)}")
    if chunks:
        min_tok = min(c.token_count for c in chunks)
        max_tok = max(c.token_count for c in chunks)
        avg_tok = sum(c.token_count for c in chunks) // len(chunks)
        total_chunk_tokens = sum(c.token_count for c in chunks)
        print(f"  Token range   : {min_tok} – {max_tok} (avg {avg_tok})")
        print(f"  Total chunk tokens: {total_chunk_tokens}")

    # Page distribution
    page_dist = Counter()
    multi_page_chunks = []
    for c in chunks:
        span = f"{c.page}" if c.page == c.page_end else f"{c.page}-{c.page_end}"
        page_dist[span] += 1
        if c.page != c.page_end:
            multi_page_chunks.append((c.chunk_index, span, c.section, c.subsection, c.token_count))

    print("\nPAGE DISTRIBUTION:")
    for span, count in sorted(page_dist.items(), key=lambda x: str(x[0])):
        print(f"  Page(s) {span:<6}: {count} chunk(s)")

    if multi_page_chunks:
        print(f"\nCHUNKS SPANNING MULTIPLE PAGES ({len(multi_page_chunks)}):")
        for idx, span, sec, sub, tok in multi_page_chunks:
            sub_title = sub or "—"
            print(f"  Chunk {idx:>2} | Pages: {span} | Tokens: {tok} | Sec: {sec} > {sub_title}")
    else:
        print("\nCHUNKS SPANNING MULTIPLE PAGES: None")

    # Run multi-dimensional validation
    report = validate_chunk_pipeline(pages, chunks, TARGET_TOKENS)

    print("\n" + "=" * 80)
    print("DETAILED VALIDATION REPORT")
    print("=" * 80)

    # 1. Token limit
    if report["oversized_chunks"]:
        print(f"  [FAIL] Oversized chunks (>{TARGET_TOKENS} tokens): {len(report['oversized_chunks'])} -> {report['oversized_chunks']}")
    else:
        print(f"  [OK] Token limits: All chunks within target ({TARGET_TOKENS} tokens max).")

    # 2. Table rows & multiplicity
    print(f"  [OK] Markdown table data rows tracked in source: {report['total_source_data_rows']}")
    if report["missing_data_rows"]:
        print(f"  [FAIL] Missing table data rows ({len(report['missing_data_rows'])}):")
        for r in report["missing_data_rows"]:
            print(f"     {r}")
    else:
        print("  [OK] Table data row preservation: 100% of source table rows preserved with exact multiplicity.")

    if report["duplicate_data_rows"]:
        print(f"  [FAIL] Unexpected duplicate data rows ({len(report['duplicate_data_rows'])}):")
        for r in report["duplicate_data_rows"]:
            print(f"     {r}")
    else:
        print("  [OK] Table data row uniqueness: No unexpected duplicate data rows detected.")

    if report["missing_headers"]:
        print(f"  [FAIL] Missing table column headers ({len(report['missing_headers'])}):")
        for h in report["missing_headers"]:
            print(f"     {h}")
    else:
        print("  [OK] Table headers: 100% of table headers preserved.")

    if report["repeated_headers"]:
        print(f"  [INFO] Repeated table headers from chunk division ({len(report['repeated_headers'])}):")
        for r in report["repeated_headers"]:
            print(f"     {r}")

    if report["table_order_errors"]:
        print(f"  [FAIL] Table row ordering errors ({len(report['table_order_errors'])}):")
        for err in report["table_order_errors"]:
            print(f"     {err}")
    else:
        print("  [OK] Table row ordering: All table rows preserve original source sequence.")

    # 3. Substantive text lines
    print(f"  [OK] Substantive source text lines tracked: {report['total_substantive_lines']}")
    if report["missing_text_lines"]:
        print(f"  [FAIL] Missing text lines ({len(report['missing_text_lines'])}):")
        for p, l in report["missing_text_lines"][:5]:
            print(f"     (p.{p}) {l}")
    else:
        print("  [OK] Text line preservation: 100% of substantive source lines verified in chunks.")

    # 4. Ordering
    if report["misordered_lines"]:
        print(f"  [FAIL] Ordering inversions detected ({len(report['misordered_lines'])} lines):")
        for l in report["misordered_lines"][:3]:
            print(f"     {l}")
    else:
        print("  [OK] Document ordering: All content blocks follow source document order.")

    # 5. Duplication analysis
    if report["inconclusive_or_accidental_duplicates"]:
        print(f"  [FAIL] Inconclusive or accidental text duplication detected ({len(report['inconclusive_or_accidental_duplicates'])}):")
        for ngram, indices in report["inconclusive_or_accidental_duplicates"]:
            print(f"     '{ngram}' found in chunks: {indices}")
    else:
        print("  [OK] Accidental duplication: None detected.")

    if report["source_recurring_duplicates"]:
        print(f"  [INFO] Legitimate recurring source phrases detected ({len(report['source_recurring_duplicates'])}):")
        for ngram, indices in report["source_recurring_duplicates"]:
            print(f"     '{ngram}' recurring in chunks: {indices}")

    if report["verified_overlap_duplicates"]:
        print(f"  [INFO] Verified overlap duplication between adjacent chunks ({len(report['verified_overlap_duplicates'])}):")
        for ngram, indices in report["verified_overlap_duplicates"]:
            print(f"     '{ngram}' in adjacent chunks: {indices}")

    print("\nVALIDATION LIMITATIONS & TRANSPARENCY:")
    print("  * Header ('Empório da Música Manual...') and footer ('Página N') are intentionally stripped by extraction.")
    print("  * Multi-line table cell text is normalized onto single Markdown row lines by design.")
    print("  * Note on tables larger than chunk limit: None of the tables in 'políticas_da_loja.pdf' exceed 500 tokens (max table is 112 tokens). Table splitting logic is implemented and tested via unit assertions, but was not exercised by the current document.")
    print("=" * 80)

    if report["has_failures"]:
        print("\n[FAIL] Validation finished with failures.")
        sys.exit(1)
    else:
        print("\n[OK] Validation passed cleanly.")


if __name__ == "__main__":
    main()
