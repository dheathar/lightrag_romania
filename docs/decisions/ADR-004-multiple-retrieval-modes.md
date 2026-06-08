# ADR-004: Multiple Retrieval Modes with Mode-Specific Algorithms

## Status
Accepted

## Date
2024-03

## Context

Different question types require different retrieval strategies:

- "Who is the director of Organization X?" → Best answered by finding Entity X in the graph and returning its local neighborhood
- "What are all the themes discussed in the document corpus?" → Best answered by aggregating community-level summaries across the whole graph
- "What does the document say about section 4.2?" → Best answered by direct vector similarity on raw chunks
- "How does Regulation A relate to Policy B?" → Best answered by combining graph traversal and vector search

No single retrieval algorithm is optimal for all question types. A system that only supports one mode forces users to adapt their questions to the system's strengths.

## Decision

Implement five retrieval modes in `lightrag/operate.py`, each optimized for different question types:

| Mode | Algorithm | Best for |
|------|-----------|---------|
| `naive` | Vector similarity on text chunks | Direct factual recall, text-level questions |
| `local` | Entity vector search → graph traversal → chunk collection | Entity-centric, relationship questions |
| `global` | Relation vector search → entity gathering → chunk collection | Theme, summary, community questions |
| `hybrid` | local + global merged | Balanced questions requiring both |
| `mix` | KG retrieval (hybrid) + vector (naive) merged | General purpose; recommended with reranker |
| `bypass` | No retrieval, direct LLM call | Simple questions, LLM knowledge only |

Add an optional reranking step after context assembly in `mix` mode that scores each chunk against the original query using a dedicated reranker model (Cohere, Jina, or Aliyun).

## Consequences

### Positive
- Users can optimize for their use case
- Query routing is explicit — no hidden heuristics
- Reranker significantly improves `mix` mode precision
- `bypass` mode enables pure LLM usage without knowledge base overhead
- Each mode's behavior is predictable and explainable

### Negative
- Users must understand the trade-offs between modes
- Default mode must be chosen carefully (we chose `mix`)
- More code paths to test and maintain

### Risks
- **Mode confusion** — users choosing the wrong mode for their question type. Mitigated by good documentation and sensible defaults.
- **`mix` mode over-retrieval** — combining three retrieval arms can exceed token budgets. Token budget controls (`MAX_ENTITY_TOKENS`, `MAX_RELATION_TOKENS`, `MAX_TOTAL_TOKENS`) address this.

## Alternatives Considered

1. **Single universal retrieval algorithm** — Rejected: no single algorithm is optimal for all question types
2. **Automatic mode selection based on query classification** — Considered: would require an extra LLM call per query to classify the question type. The cost/benefit is unclear; left as a future enhancement.
3. **Adaptive RAG** — Rejected as too complex for the initial implementation; retrieval quality was sufficient with explicit mode selection

## References
- `lightrag/operate.py` — `kg_query()`, `naive_query()`
- `lightrag/base.py` — `QueryParam` dataclass with mode options
- `lightrag/api/routers/query_routes.py` — `QueryRequest` model
