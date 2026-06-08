# ADR-005: IBM Docling + Vision LLM for Multimodal PDF Processing

## Status
Accepted

## Date
2024-06

## Context

EU structural funds documents are complex PDFs containing:
- Dense multi-column layouts
- Financial tables with funding breakdowns
- Charts and graphs showing expenditure trends
- Organizational structure diagrams
- Scanned pages with glyph encoding issues

Standard `pypdf` extraction ignores all of these elements — it extracts only text, missing table structure and all visual content. This significantly degrades retrieval quality for financial and structural questions.

Two enhancement layers are needed:
1. **Layout-aware text extraction** — preserve table structure, detect figure locations
2. **Visual content understanding** — describe figures and charts in natural language for inclusion in the RAG index

## Decision

**Layer 1 — IBM Docling** (`DOCUMENT_LOADING_ENGINE=DOCLING`):
- Open-source document parser (IBM Research)
- Preserves table structure as Markdown
- Identifies figure bounding boxes
- Handles complex multi-column layouts
- Available as an optional extra (`uv sync --extra docling`)
- Installed on-demand to avoid mandatory large model download

**Layer 2 — Vision LLM** (`VISION_ENABLED=true`):
- When Docling detects a figure, export it as PNG
- Send PNG (base64-encoded) to a configurable vision LLM via `describe_image_with_vision()`
- Inject the returned text description inline into the document at the figure's position
- Continue normal chunking — figure descriptions become part of the text index

**Garbled text fallback (two-tier OCR):**
- When Docling detects glyph encoding issues (GLYPH markers in extracted text), trigger Tier 1: force-OCR mode (local, free)
- If still garbled, trigger Tier 2: send page images to vision LLM for text extraction
- Maximum affected pages configurable via `MAX_VISION_OCR_PAGES`

Both layers are optional — the system falls back to pypdf extraction if Docling is not installed, and skips vision description if not configured.

## Consequences

### Positive
- Financial tables are properly extracted and indexed
- Charts and diagrams are described in natural language and become searchable
- OCR fallback handles PDFs with encoding issues (common in scanned legacy documents)
- Both layers are optional — zero overhead if not needed

### Negative
- Docling installation is large (~500MB for models, not counted on macOS which is excluded)
- Vision LLM calls add cost and latency per figure (up to `MAX_FIGURES_PER_DOC` calls)
- Docling is incompatible with Gunicorn multi-worker on macOS (PyTorch fork-safety issue)
- Figure description quality depends on vision LLM capability

### Risks
- **Vision model timeout** — figure description failure is logged at WARNING and ingestion continues without the description. No document is failed due to vision failure.
- **Gunicorn + macOS incompatibility** — documented in `pyproject.toml` classifiers; macOS users must use single-worker Uvicorn mode

## Alternatives Considered

1. **pypdf only** — Rejected: loses all table structure and visual content
2. **Tesseract OCR** — Considered as an alternative to Docling for OCR; rejected because Docling provides better layout understanding and table structure
3. **Azure Document Intelligence / AWS Textract** — Considered: excellent quality but vendor lock-in and per-page cost; Docling is free and self-hosted
4. **Unstructured.io** — Considered: good general parser but less optimized for EU document layouts than Docling's purpose-built models

## References
- `lightrag/api/routers/document_routes.py` — `_is_docling_available()`, `_is_vision_active()`
- `lightrag/api/utils_vision.py` — `describe_image_with_vision()`
- `env.example` — `DOCUMENT_LOADING_ENGINE`, `VISION_*` variables
