# DocForge Documentation

DocForge is a production-ready multimodal RAG (Retrieval-Augmented Generation) system built on LightRAG. It extracts entities and relationships from documents, constructs a knowledge graph, and enables multi-modal retrieval through a full-featured web interface.

## What This Documentation Covers

| Section | Purpose |
|---------|---------|
| [Architecture Overview](./architecture/OVERVIEW.md) | High-level system design and component relationships |
| [C4 Context Diagram](./architecture/C4_CONTEXT.md) | System boundary and external actors |
| [C4 Container Diagram](./architecture/C4_CONTAINERS.md) | Internal containers and their communication |
| [C4 Component Diagram](./architecture/C4_COMPONENTS.md) | Detailed component breakdown per container |
| [Communication Patterns](./architecture/COMMUNICATION.md) | Sync/async flows between components |
| [API Reference](./api/REFERENCE.md) | All REST endpoints with schemas |
| [API Contracts](./api/CONTRACTS.md) | Request/response shapes in detail |
| [API Errors](./api/ERRORS.md) | Error codes and handling |
| [Data Model](./data/MODEL.md) | Storage layer, entity schema, graph structure |
| [Data Flows](./data/FLOWS.md) | Document ingestion and query flows |
| [Business Rules](./data/BUSINESS_RULES.md) | Invariants, constraints, and domain logic |
| [Getting Started](./guides/GETTING_STARTED.md) | Developer onboarding and local setup |
| [Extending the System](./guides/EXTENDING.md) | How to add features following existing patterns |
| [Code Patterns](./guides/PATTERNS.md) | Conventions and critical implementation patterns |
| [Troubleshooting](./guides/TROUBLESHOOTING.md) | Common issues and solutions |
| [Deployment Guide](./operations/DEPLOYMENT.md) | Docker, production, and Kubernetes deployment |
| [Configuration Reference](./operations/CONFIGURATION.md) | Every environment variable documented |
| [Monitoring](./operations/MONITORING.md) | Health checks, logging, and observability |
| [ADR Index](./decisions/INDEX.md) | Architecture Decision Records |

## Quick Navigation

### I want to run the system locally
Go to [Getting Started](./guides/GETTING_STARTED.md).

### I want to call the API
Go to [API Reference](./api/REFERENCE.md).

### I want to understand how document ingestion works
Go to [Data Flows — Document Ingestion](./data/FLOWS.md#document-ingestion-flow).

### I want to add a new storage backend
Go to [Extending the System](./guides/EXTENDING.md#adding-a-storage-backend).

### I want to configure entity types for my domain
Go to [Business Rules](./data/BUSINESS_RULES.md#entity-type-taxonomy) and [NER Entity Types Guide](./NER_ENTITY_TYPES_GUIDE.md).

### I want to deploy to production
Go to [Deployment Guide](./operations/DEPLOYMENT.md).

### I want to understand why a decision was made
Go to [ADR Index](./decisions/INDEX.md).

## System at a Glance

```
Documents (PDF, DOCX, PPTX, XLSX, TXT, MD)
        |
        v
  Document Ingestion Pipeline
  (Docling or pypdf extraction, optional vision model, chunking)
        |
        v
  Entity & Relation Extraction (LLM-driven NER)
        |
        v
  Knowledge Graph Storage         Vector Storage
  (Neo4j / NetworkX / PGGraph)    (Milvus / Qdrant / PGVector / NanoVDB)
        \                              /
         v                            v
         Hybrid Retrieval Engine (local / global / hybrid / mix / naive)
                    |
                    v
              LLM Answer Generation
                    |
                    v
             REST API + WebUI (React 19 + Sigma.js)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Python 3.10+, TypeScript |
| API Server | FastAPI + Uvicorn / Gunicorn |
| WebUI | React 19, Vite, Bun, Tailwind CSS |
| Graph Visualization | Sigma.js via @react-sigma |
| Knowledge Graph | Neo4j 5.x / NetworkX / PostgreSQL / Memgraph |
| Vector Storage | Milvus / Qdrant / Faiss / PostgreSQL pgvector / NanoVectorDB |
| KV & Doc Status | Redis / PostgreSQL / MongoDB / JSON files |
| LLM Providers | OpenAI, Azure OpenAI, Ollama, Gemini, AWS Bedrock, Anthropic |
| Embedding Providers | OpenAI, Ollama, Azure, Jina, Gemini |
| Document Parsing | IBM Docling, pypdf |
| Evaluation | RAGAS |
| Observability | Langfuse |
| Containerization | Docker, docker-compose, Kubernetes |
