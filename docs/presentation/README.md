# DocForge — Beamer Presentation

## File
`docforge_presentation.tex` — LaTeX Beamer source (16:9, coral/terracotta theme).

## Compile

### Option A — Local LaTeX (pdflatex)
```bash
cd docs/presentation
pdflatex docforge_presentation.tex
pdflatex docforge_presentation.tex   # run twice for references/TOC
```
Requires: `texlive-full` (or MiKTeX on Windows) with packages:
`beamer`, `tikz`, `booktabs`, `fontawesome5`, `xcolor`, `hyperref`

### Option B — Overleaf (recommended, no install needed)
1. Go to [overleaf.com](https://www.overleaf.com) → New Project → Upload
2. Upload `docforge_presentation.tex`
3. Click **Compile** — PDF ready in seconds

### Option C — Docker
```bash
docker run --rm -v $(pwd):/data blang/latex \
  pdflatex /data/docforge_presentation.tex
```

## Slide Structure
| # | Section | Content |
|---|---------|---------|
| 1 | Title | DocForge overview |
| 2 | Agenda | Table of contents |
| 3 | The Problem | Why document analysis is hard |
| 4 | Overview | One-picture pipeline |
| 5 | Ingestion | Multimodal reading (text, tables, charts, images) |
| 6 | Knowledge Graph | City-map analogy + entity diagram |
| 7 | Why a Graph | Comparison vs keyword search |
| 8 | Q&A | Retrieval modes + plain language queries |
| 9 | Citations | Traceability + hallucination stats |
| 10 | AI Reasoning | Synthesis panel explained |
| 11 | Custom Instructions | Romanian, tone, format |
| 12 | Comparison chart | DocForge vs Keyword/NaiveRAG/GraphRAG |
| 13 | Head-to-head table | Feature comparison matrix |
| 14 | Research results | Benchmark numbers + sources |
| 15 | Interface | Panel-by-panel walkthrough |
| 16 | Demo questions | 4 ready-to-paste queries |
| 17 | Summary | Key benefits + URL |
| 18 | References | Cited papers |
