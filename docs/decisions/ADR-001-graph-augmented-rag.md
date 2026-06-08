# ADR-001: Graph-Augmented Retrieval over Pure Vector Search

## Status
Accepted

## Date
2024-01

## Context

Naive RAG systems retrieve document chunks by vector similarity. This works well for direct factual questions but struggles with:

1. **Multi-hop reasoning** — "What organizations fund the programme that manages region X?" requires traversing Organization → Programme → Region relationships
2. **Global understanding** — Summarizing all the ways concept A is related to concept B across many documents
3. **Provenance tracking** — Knowing which documents and which parts support a claim

Pure vector search returns chunks that are semantically similar to the query but has no notion of relationships between entities mentioned across different chunks. A question about Entity A in context of Entity B might miss chunks that mention A and B separately.

## Decision

Build a knowledge graph alongside the vector index. For each document chunk:
1. Extract entities and binary relationships using an LLM
2. Merge entities and relationships into a persistent graph (entity = node, relationship = edge)
3. Store embeddings for both chunks AND entities AND relationships

At query time, use the graph to implement multiple retrieval strategies:
- **Local mode:** Find entities matching the query → traverse their relationships → collect supporting chunks
- **Global mode:** Find relationships matching the query → collect related entities → collect chunks
- **Mix mode:** Combine graph retrieval with chunk vector search for maximum coverage

## Consequences

### Positive
- Enables multi-hop reasoning that pure vector search cannot support
- Provides explicit entity-level provenance (which chunks mention which entity)
- Enables graph visualization of the knowledge domain
- Global summaries become possible by traversing the full relationship graph
- Entity merging and deduplication is a natural consequence of graph structure

### Negative
- Document ingestion is significantly slower (LLM call per chunk for extraction)
- Storage requirements are higher (graph + vectors + KV for chunks)
- Graph quality is dependent on LLM extraction quality
- Adding documents requires graph merging, not just appending

### Risks
- **LLM extraction inconsistency** — mitigated by consistent entity naming guidelines in the extraction prompt and post-processing normalization
- **Graph sparsity** — documents with poor entity coverage produce sparse graphs; mitigated by the naive/chunk retrieval fallback in mix mode

## Alternatives Considered

1. **Pure vector search (naive RAG)** — Rejected because it cannot answer multi-hop questions or provide entity-level relationship understanding
2. **Pre-built knowledge graphs from structured data** — Rejected because source documents are unstructured PDFs; LLM extraction is the only viable approach
3. **Traditional NER + relation extraction pipelines** — Rejected because they require training data and don't generalize to domain-specific entity types; see ADR-003

## References
- LightRAG paper: "LightRAG: Simple and Fast Retrieval-Augmented Generation"
- Original GraphRAG (Microsoft Research)
