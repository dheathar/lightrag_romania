# ADR-007: RAGAS Evaluation Integrated into API and WebUI

## Status
Accepted

## Date
2024-09

## Context

RAG systems are notoriously difficult to evaluate. The quality of answers depends on:
1. Document extraction quality (was the right text captured?)
2. Chunking strategy (are chunks semantically coherent?)
3. Retrieval effectiveness (is the right context retrieved?)
4. Generation quality (does the LLM accurately use the context?)

Without a quantitative evaluation framework, it is impossible to measure the impact of configuration changes (e.g., switching chunking method or enabling vision processing) on overall RAG quality.

Evaluation must be accessible to non-developers who use the WebUI — not just those who can run Python scripts.

## Decision

Integrate **RAGAS** (Retrieval Augmented Generation Assessment) as the evaluation framework, wrapped with a FastAPI-based evaluation lifecycle and a dedicated WebUI panel:

**RAGAS Metrics:**
- `faithfulness` — Is the answer factually grounded in retrieved contexts?
- `answer_relevance` — Does the answer address the question?
- `context_recall` — Was all relevant information retrieved?
- `context_precision` — Is retrieved context relevant (low noise)?

**Pipeline Configuration Capture:**
When an evaluation starts, snapshot the current pipeline configuration (extraction engine, chunking method, chunk size, vision enabled/model). Store this alongside the RAGAS scores in the result JSON.

This enables before/after comparisons: "Did enabling vision increase context_recall for financial document questions?"

**WebUI Integration:**
- `EvaluationPanel.tsx` — Run evaluations, monitor progress, view results with score bars
- `GET /evaluation/environment` — Check RAGAS availability before showing the panel
- One evaluation at a time (enforced by server) to prevent resource contention
- Saved results can be compared visually in the WebUI

**Dataset sources:**
- Inline test cases (JSON in the request body)
- Saved dataset files in `lightrag/evaluation/datasets/`
- Built-in sample dataset (`lightrag/evaluation/sample_dataset.json`)

## Consequences

### Positive
- Non-developers can run evaluations from the WebUI without Python knowledge
- Pipeline configuration is captured alongside scores — results are reproducible and comparable
- RAGAS is the de facto standard evaluation framework for RAG systems
- Evaluation runs as a background task — UI remains responsive
- Results accumulate over time, enabling trend analysis

### Negative
- RAGAS evaluation requires OpenAI-compatible LLM and embedding endpoints (not all Ollama models work well with RAGAS scoring)
- Evaluations are slow (N × LLM calls for RAGAS metrics, where N = test case count)
- Only one evaluation at a time

### Risks
- **RAGAS API changes** — RAGAS is a young library with frequent API changes. Using `LangchainLLMWrapper` provides a stable interface. Deprecation warnings for this wrapper are suppressed intentionally.
- **Evaluation LLM cost** — For large test sets, evaluation LLM costs can be significant. `EVAL_MAX_CONCURRENT=2` (default) limits rate while reducing cost.

## Alternatives Considered

1. **Custom evaluation metrics** — Rejected: RAGAS is well-established and interpretable
2. **Offline script only (no WebUI)** — Rejected: makes evaluation inaccessible to non-developers
3. **Continuous evaluation (per query)** — Rejected: too expensive and complex; batch evaluation on a gold set is sufficient
4. **ARES evaluation framework** — Considered but less mature than RAGAS at decision time

## References
- `lightrag/evaluation/eval_rag_quality.py` — RAGAS evaluation script
- `lightrag/evaluation/evaluation_manager.py` — WebUI integration and pipeline config capture
- `lightrag/api/routers/evaluation_routes.py` — REST endpoints
- `lightrag_webui/src/features/EvaluationPanel.tsx` — WebUI panel
