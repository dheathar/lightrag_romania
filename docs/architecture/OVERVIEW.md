# Architecture Overview

## Purpose

DocForge is a multimodal RAG system that converts unstructured documents into a navigable knowledge graph and enables natural language queries over that graph. Its primary differentiators from a plain vector-search RAG are:

1. **Graph-augmented retrieval** — entities and relationships are explicitly modelled and traversed during query time, not only matched by embedding similarity.
2. **Multiple retrieval modes** — `local`, `global`, `hybrid`, `mix`, and `naive` modes allow the caller to trade precision for recall depending on the question type.
3. **Multimodal document understanding** — figures and charts inside PDFs are described by a vision LLM and injected into the text before chunking.
4. **Pluggable production storage** — every storage concern (KV, vector, graph, doc status) has independent backend options for development and production.

## System Boundaries

The system accepts documents and queries from users via the WebUI or REST API. It calls out to one or more LLM providers for extraction and answer generation, one or more embedding providers for vector operations, and one or more storage backends. It has no hard runtime dependency on a single cloud provider.

```
                   ┌─────────────────────────────────────────┐
                   │               DocForge                   │
                   │                                         │
  User             │  WebUI     API Server    LightRAG Core  │
  Browser ────────▶│  (React)──▶(FastAPI)────▶(Python Pkg)  │
                   │                                         │
  API Clients ────▶│            REST/SSE                     │
                   └────────┬────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────────┐
          │                 │                     │
     LLM Providers    Storage Backends      Embedding Providers
     (OpenAI, Ollama,  (Neo4j, PG, Milvus,  (OpenAI, Ollama,
      Gemini, Bedrock)  Redis, Qdrant, etc.)   Jina, Gemini)
```

## Four-Layer Architecture

### Layer 1 — Entry Points

| Entry Point | Technology | Purpose |
|-------------|-----------|---------|
| WebUI | React 19 + Vite | Browser-based interface for graph exploration, document upload, retrieval testing, evaluation, configuration |
| REST API | FastAPI (Uvicorn / Gunicorn) | All WebUI functionality plus programmatic access |
| Ollama-compatible API | FastAPI sub-router | Drop-in compatibility for tools that speak the Ollama protocol |
| Python library | `lightrag` package | Direct programmatic usage without the API server |

### Layer 2 — Core Orchestration (`lightrag.py`)

The `LightRAG` class is the single entry point for all RAG operations. It owns:

- Storage initialization and lifecycle (`initialize_storages()` / `finalize_storages()`)
- Document insertion pipeline (`ainsert()`)
- Query dispatch to the correct retrieval mode (`aquery()`)
- Knowledge graph rebuild on demand (`arebuild_graph()`)
- Workspace isolation for multi-tenant deployments

### Layer 3 — Storage Abstraction (`lightrag/base.py`, `lightrag/kg/`)

Four orthogonal storage concerns, each with multiple backend implementations:

| Storage Type | Purpose | Development Default | Production Options |
|-------------|---------|--------------------|--------------------|
| `KVStorage` | LLM response cache, text chunks, document info | `JsonKVStorage` | `RedisKVStorage`, `PGKVStorage`, `MongoKVStorage` |
| `VectorStorage` | Entity / relation / chunk embeddings | `NanoVectorDBStorage` | `MilvusVectorDBStorage`, `QdrantVectorDBStorage`, `PGVectorStorage`, `FaissVectorDBStorage` |
| `GraphStorage` | Entity-relation graph | `NetworkXStorage` | `Neo4JStorage`, `PGGraphStorage`, `MemgraphStorage` |
| `DocStatusStorage` | Document processing status tracking | `JsonDocStatusStorage` | `RedisDocStatusStorage`, `PGDocStatusStorage`, `MongoDocStatusStorage` |

### Layer 4 — Operation Modules (`lightrag/operate.py`)

Core algorithms that implement retrieval modes and extraction:

- `extract_entities()` — LLM-driven NER and relation extraction per chunk
- `merge_nodes_and_edges()` — Deduplication and graph merge after parallel extraction
- `kg_query()` — Graph-traversal-based retrieval (local, global, hybrid, mix)
- `naive_query()` — Pure vector similarity retrieval
- `rebuild_knowledge_from_chunks()` — Full graph rebuild from stored chunks

## Retrieval Mode Decision Tree

```
Query arrives
     │
     ├── mode=naive   → Vector search on chunks only
     ├── mode=local   → Entity neighborhood: find top-K entities by vector → expand to neighboring relations → gather chunks
     ├── mode=global  → Community summary: find top-K relations by vector → gather related entities → gather chunks
     ├── mode=hybrid  → local + global merged, deduplicated
     ├── mode=mix     → KG (hybrid) + vector (naive) merged, optional reranker
     └── mode=bypass  → Skip retrieval, send query directly to LLM
```

`mix` is the recommended default when a reranker is configured; it combines graph-structured context with chunk-level relevance.

## Document Processing Pipeline

```
Upload
  │
  ├─ File type detection (PDF / DOCX / PPTX / XLSX / TXT / MD)
  │
  ├─ Engine selection:
  │    ├── DEFAULT engine → pypdf (text-only, fast)
  │    └── DOCLING engine → IBM Docling (layout-aware, tables, figures)
  │              │
  │              └── Vision enabled? → each figure → vision LLM → text description
  │                                    → injected inline before chunking
  │
  ├─ Chunking:
  │    ├── TOKEN_SIZE   → fixed window (default 1200 tokens, 100 overlap)
  │    ├── SEMANTIC     → embedding-based boundary detection
  │    └── HYBRID       → token window + semantic validation
  │
  ├─ Entity & Relation Extraction (parallel, per chunk)
  │    └── LLM call with entity_types taxonomy → structured (entity, relation) tuples
  │
  ├─ Graph Merge (deduplication, LLM summary on high-occurrence nodes)
  │
  └─ Storage writes (KV chunks, vector embeddings, graph nodes/edges, doc status)
```

## Concurrency Model

- `MAX_ASYNC` (default 4): maximum concurrent LLM requests across both extraction and query phases
- `MAX_PARALLEL_INSERT` (default 2): documents processed simultaneously; recommended = `MAX_ASYNC / 3`
- `EMBEDDING_FUNC_MAX_ASYNC` (default 8): concurrent embedding requests
- All storage operations use async/await; shared resources are protected by keyed locks to prevent deadlocks

## Multi-Tenant Isolation

The `workspace` parameter (or `WORKSPACE` env var) partitions all storage data per instance:

| Storage | Isolation mechanism |
|---------|-------------------|
| File-based (JSON) | Subdirectories under `working_dir` |
| Collection-based (Milvus, Qdrant) | Collection name prefix |
| Relational (PostgreSQL) | `workspace` column filter |
| Graph (Neo4j) | Label prefix |
| Redis | Key prefix |

## Authentication

Two complementary auth mechanisms:

1. **JWT accounts** — `AUTH_ACCOUNTS` env var defines `username:password` pairs. Login via `POST /login` returns a JWT. Token auto-renewal is configurable via sliding window expiration.
2. **API key** — `LIGHTRAG_API_KEY` env var. Pass via `X-API-Key` header. Useful for programmatic API access.

When neither is configured, the API is open (development default).

## Evaluation Integration

RAGAS evaluation is built directly into the API server and WebUI:

- The `EvaluationPanel` (WebUI) triggers evaluation via `POST /evaluation/run`
- Each evaluation run captures the current pipeline configuration (extraction engine, chunking method, vision settings) alongside RAGAS scores, enabling before/after comparisons when pipeline settings change
- Results are stored as JSON files in `lightrag/evaluation/results/` and listed via `GET /evaluation/results`
