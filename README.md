# DocForge - Multimodal RAG System

A production-grade Retrieval-Augmented Generation system with multimodal document processing, knowledge graph visualization, extensible entity taxonomy, and built-in RAGAS evaluation. Built on LightRAG with significant enhancements for EU structural funds analysis and general-purpose document intelligence.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [WebUI Guide](#webui-guide)
- [Entity Taxonomy](#entity-taxonomy)
- [Evaluation](#evaluation)
- [Document Processing Pipeline](#document-processing-pipeline)
- [Development](#development)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Contributing](#contributing)

---

## Overview

DocForge is a custom RAG system designed for multimodal document analysis at scale. Originally built for analyzing ~89 Romanian EU structural funds PDFs, it provides a general-purpose framework for:

- **Multimodal Document Processing** - PDFs with images, tables, charts, equations via vision models
- **Knowledge Graph Construction** - Automatic entity/relation extraction with interactive Sigma.js visualization
- **Extensible NER Taxonomy** - 11 default entity types + domain-specific extensions (16 EU Cohesion Policy types included)
- **Multi-Mode Retrieval** - Local, global, hybrid, mix, and naive retrieval strategies
- **Production Storage** - PostgreSQL, MongoDB, Neo4j, Redis, Milvus, Qdrant backends
- **Reranking Support** - Cohere, Jina, Aliyun for improved retrieval accuracy
- **RAGAS Evaluation** - Built-in RAG quality metrics with WebUI integration and pipeline config tracking
- **Multiple LLM Providers** - Ollama, OpenAI, Azure, Anthropic, Gemini, Bedrock, OpenRouter

---

## Key Features

### Multimodal Document Processing

- **Dual extraction engines**: Default (pypdf) for basic text, Docling (IBM) for layout-aware extraction with Markdown tables and figure detection
- **Vision model integration**: Figures/charts sent to vision LLM for description, injected inline before RAG ingestion
- **OCR fallback**: Automatic garbled text detection with tiered recovery (force OCR, then vision LLM)
- **Configurable chunking**: TOKEN_SIZE (fixed), SEMANTIC (embedding-based), HYBRID (token + semantic validation)

### Knowledge Graph

- Entity and relation extraction with configurable entity types
- Community detection for global retrieval
- Interactive Sigma.js graph visualization with search, filtering, and layout algorithms
- Statistics dashboard with entity counts and connection metrics

### Evaluation & Quality

- RAGAS integration (faithfulness, relevance, context precision/recall)
- WebUI evaluation panel with dataset management
- Pipeline config capture - every evaluation records which extraction engine, chunking method, and vision settings were active
- Past results comparison with pipeline badges
- Multiple evaluation datasets for Romanian EU structural funds documents

### WebUI (DocForge)

- Claude-inspired warm light theme with amber/stone accents
- English + Romanian internationalization
- Document manager with drag-and-drop upload, batch processing, status monitoring
- Document processing panel with configurable extraction and chunking settings
- Knowledge graph viewer with interactive exploration
- Retrieval interface with streaming responses and citation display
- Evaluation panel with real-time progress tracking
- About dialog with entity taxonomy reference
- API explorer with Swagger/OpenAPI docs

---

## Architecture

### Backend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Core Engine | Python 3.10+, LightRAG | Entity extraction, graph construction, multi-mode retrieval |
| API Server | FastAPI, Uvicorn/Gunicorn | REST endpoints, WebSocket, Ollama-compatible API |
| Storage | Pluggable backends | KV, vector, graph, doc status storage |
| Evaluation | RAGAS | RAG quality metrics and benchmarking |

### Frontend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | React 19, TypeScript | UI components and type safety |
| Build | Vite, Bun | Fast builds and package management |
| State | Zustand | Global state management |
| Styling | Tailwind CSS | Utility-first styling with custom warm theme |
| Graph | Sigma.js, Graphology | Interactive knowledge graph visualization |
| i18n | react-i18next | English + Romanian |

### Storage Options

**Development (default):**
- JSON files (KV + doc status)
- NanoVectorDB (vectors)
- NetworkX (graph)

**Production:**
- PostgreSQL (all-in-one: KV, vectors, graph, doc status)
- MongoDB (all-in-one, vectors on Atlas Cloud)
- Neo4j / Memgraph (graph)
- Redis (KV + doc status cache)
- Milvus / Qdrant / Faiss (vectors)

---

## Installation

### Prerequisites

- Python 3.10+
- [Bun](https://bun.sh) (for WebUI builds)
- Git

### Quick Start

```bash
# Clone repository
git clone https://github.com/dheathar/multimodal-rag.git
cd multimodal-rag

# Install core package with API support
uv sync --extra api

# Build WebUI
cd lightrag_webui
bun install --frozen-lockfile
bun run build
cd ..

# Configure environment
cp env.example .env
# Edit .env with your LLM, embedding, and storage settings

# Start server
lightrag-server
```

The server starts at **http://localhost:9621**

### Install Extras

```bash
uv sync --extra api              # API server + WebUI
uv sync --extra offline-storage  # All storage backends
uv sync --extra offline-llm      # All LLM providers
uv sync --extra evaluation       # RAGAS evaluation
uv sync --extra docling          # IBM Docling extraction engine
uv sync --extra observability    # Langfuse tracing
uv sync --extra offline          # Complete offline package
uv sync --extra test             # Testing dependencies
```

### Platform Scripts

| Action | Windows | Unix/Mac |
|--------|---------|----------|
| Start server | `start.bat` | `./start.sh` |
| Start dev mode | `start-dev.bat` | `./start-dev.sh` |
| Stop server | `stop.bat` | `./stop.sh` |
| Build WebUI | `build-webui.bat` | `./build-webui.sh` |
| Dev WebUI | `dev-webui.bat` | `./dev-webui.sh` |

---

## Configuration

### Essential Settings

```bash
# .env - Key configuration sections

# Server
HOST=0.0.0.0
PORT=9621

# LLM (openai, ollama, azure_openai, gemini, aws_bedrock)
LLM_BINDING=openai
LLM_MODEL=gpt-4o
LLM_BINDING_HOST=https://api.openai.com/v1
LLM_BINDING_API_KEY=your_api_key

# Embedding (must stay consistent after first indexing)
EMBEDDING_BINDING=openai
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIM=3072

# Document Processing
DOCUMENT_LOADING_ENGINE=DEFAULT    # DEFAULT or DOCLING
CHUNKING_METHOD=TOKEN_SIZE         # TOKEN_SIZE, SEMANTIC, HYBRID
CHUNK_SIZE=1200
CHUNK_OVERLAP_SIZE=100

# Vision (requires DOCLING engine)
VISION_ENABLED=false
VISION_MODEL=google/gemini-2.0-flash-001
VISION_API_KEY=your_key
VISION_BASE_URL=https://openrouter.ai/api/v1

# Entity Types (customizable)
ENTITY_TYPES='["Person", "Organization", "Location", "Event", "Concept"]'

# Reranking (optional but recommended)
RERANK_BINDING=null                # null, cohere, jina, aliyun
RERANK_MODEL=rerank-v3.5
```

See `env.example` for the complete configuration reference with all storage backends, LLM providers, and advanced tuning options.

### Chunking Strategies

| Method | Description | Best For |
|--------|-------------|----------|
| `TOKEN_SIZE` | Fixed-size token-based chunking (default, fastest) | General use, large document sets |
| `SEMANTIC` | Embedding-based semantic similarity chunking | Better coherence, smaller document sets |
| `HYBRID` | Token-based with semantic boundary validation | Balance of speed and quality |

### Semantic Chunking Parameters

```bash
SEMANTIC_SIMILARITY_THRESHOLD=0.8   # Breakpoint percentile (0.0-1.0)
SEMANTIC_MIN_CHUNK_SIZE=100         # Min tokens per chunk
SEMANTIC_MAX_TOKENS=100000          # Max doc tokens before fallback
```

---

## Usage

### Starting the Server

```bash
# Development
lightrag-server

# Development with auto-reload
uvicorn lightrag.api.lightrag_server:app --reload

# Production with gunicorn
lightrag-gunicorn --workers 2 --bind 0.0.0.0:9621
```

### Endpoints

- **WebUI**: http://localhost:9621
- **API Docs**: http://localhost:9621/docs
- **Health Check**: http://localhost:9621/health

### Python API

```python
import asyncio
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed

async def main():
    rag = LightRAG(
        working_dir="./rag_storage",
        llm_model_func=gpt_4o_mini_complete,
        embedding_func=openai_embed
    )
    await rag.initialize_storages()   # Required!

    # Insert documents
    await rag.ainsert("Your document text here")
    await rag.ainsert(["Doc 1", "Doc 2"], file_paths=["doc1.pdf", "doc2.pdf"])

    # Query with different modes
    result = await rag.aquery(
        "Your question",
        param=QueryParam(
            mode="mix",           # local, global, hybrid, naive, mix
            top_k=60,
            chunk_top_k=20,
            enable_rerank=True,
            stream=False
        )
    )
    print(result)

    await rag.finalize_storages()

asyncio.run(main())
```

---

## WebUI Guide

### Tab Navigation

| Tab | Color | Description |
|-----|-------|-------------|
| **Documents** | Green | Upload, manage, and monitor document processing |
| **Doc Processing** | Green | Configure extraction engine, chunking method, vision settings |
| **Knowledge Graph** | Green | Interactive graph visualization with Sigma.js |
| **Retrieval** | Blue | Query interface with multiple retrieval modes and citations |
| **Evaluation** | Amber | RAGAS evaluation runner with dataset management and results |
| **API** | Gray | Built-in Swagger/OpenAPI documentation |
| **Settings** | Gray | LLM, embedding, and system configuration |

### Document Processing Panel

Configure your extraction pipeline directly from the WebUI:

1. **Extraction Engine**: Choose DEFAULT (pypdf) or DOCLING (layout-aware)
2. **Chunking Method**: Select TOKEN_SIZE, SEMANTIC, or HYBRID
3. **Chunk Size / Overlap**: Tune for your document characteristics
4. **Vision Model**: Enable for figure/chart description (requires Docling)

Pipeline badges in the Document Manager show which engine processed each document.

### Evaluation Panel

1. Select or upload an evaluation dataset
2. Click "Run Evaluation" to start RAGAS assessment
3. Monitor real-time progress
4. View results with per-question scores and pipeline configuration
5. Compare past evaluations with different pipeline settings

---

## Entity Taxonomy

DocForge uses an extensible Named Entity Recognition (NER) system for knowledge graph construction.

### Default Entity Types (11)

`Person`, `Creature`, `Organization`, `Location`, `Event`, `Concept`, `Method`, `Content`, `Data`, `Artifact`, `NaturalObject`

### EU Cohesion Policy Types (16) - Domain Extension

For Romanian EU structural funds analysis, the following domain-specific types are available:

| Category | Entity Types |
|----------|-------------|
| **Structural** | Programme, Project, ThematicObjective, Priority |
| **Institutional** | ManagingAuthority, Beneficiary, Organization, Person |
| **Financial** | Budget, Indicator |
| **Geographic** | Country, Region |
| **Regulatory** | Regulation, Recommendation, Document |
| **Temporal** | Event |

### Custom Entity Types

Configure via environment variable:

```bash
ENTITY_TYPES='["Programme", "ManagingAuthority", "Beneficiary", "Project", "Indicator", "Budget", "Country", "Region", "Regulation", "Recommendation", "ThematicObjective", "Priority", "Document", "Event", "Organization", "Person"]'
```

Or via the Settings tab in the WebUI. See `docs/NER_ENTITY_TYPES_GUIDE.md` for detailed guidance.

---

## Evaluation

### Built-in Datasets

| Dataset | Tests | Source |
|---------|-------|--------|
| Sample Dataset | Built-in | General testing |
| Communication Evaluation Interreg Romania-Serbia | 20 | EU programme evaluation |
| Communication Evaluation (Multimodal) | 12 | Multimodal variant |
| Evaluarea Intermediara PODCA 2007-2009 | 20 | Romanian operational programme |
| Evaluarea Intermediara PODCA 2010-2012 | 20 | Romanian operational programme |
| Ex-Ante Evaluation OPTA | 20 | Operational programme assessment |

### RAGAS Metrics

- **Faithfulness**: Are answers grounded in retrieved context?
- **Answer Relevancy**: Do answers address the question?
- **Context Precision**: Is retrieved context relevant?
- **Context Recall**: Was all needed context retrieved?
- **RAGAS Score**: Composite quality metric (0-1)

### Evaluation Configuration

```bash
EVAL_LLM_MODEL=gpt-4o-mini
EVAL_LLM_BINDING_API_KEY=your_key
EVAL_EMBEDDING_MODEL=text-embedding-3-large
EVAL_MAX_CONCURRENT=2
EVAL_QUERY_TOP_K=10
```

---

## Document Processing Pipeline

```
PDF Upload
  |
  v
Extraction Engine
  |-- DEFAULT: pypdf text extraction
  |-- DOCLING: Layout-aware with tables, figures, structure
  |     |
  |     +-- Vision Model (optional): Figure/chart description
  |     +-- OCR Fallback: Garbled text recovery
  |
  v
Chunking
  |-- TOKEN_SIZE: Fixed-size token splits
  |-- SEMANTIC: Embedding-based boundary detection
  |-- HYBRID: Token-based + semantic validation
  |
  v
Entity/Relation Extraction (LLM)
  |
  v
Knowledge Graph + Vector Embeddings
  |
  v
Multi-Mode Retrieval (local/global/hybrid/mix/naive)
```

---

## Development

### Frontend

```bash
cd lightrag_webui
bun install --frozen-lockfile    # Install dependencies
bun run dev                      # Development server (hot reload)
bun run build                    # Production build
bun run lint                     # Lint check
```

### Backend

```bash
uv sync                          # Install in editable mode
pytest tests                     # Run offline tests
pytest tests --run-integration   # Run all tests (requires services)
ruff check .                     # Lint
ruff format .                    # Format
```

### Testing

```bash
# Default: offline tests only (~3s, 21 tests)
pytest tests

# Full suite with integration tests
pytest tests --run-integration

# Keep artifacts for debugging
pytest tests --keep-artifacts

# Stress testing
pytest tests --stress-test
```

---

## Project Structure

```
multimodal-rag/
|-- lightrag/                        # Core RAG engine (Python package)
|   |-- api/                         # FastAPI server
|   |   |-- lightrag_server.py       # Main server entry point
|   |   |-- routers/                 # API route handlers
|   |   |   |-- config_routes.py     # Configuration management API
|   |   |   |-- document_routes.py   # Document upload/processing API
|   |   |   +-- evaluation_routes.py # RAGAS evaluation API
|   |   |-- utils_vision.py          # Vision model utilities
|   |   +-- webui/                   # Built WebUI assets
|   |-- kg/                          # Storage implementations
|   |   |-- json_*.py                # JSON file storage
|   |   |-- neo4j_impl.py           # Neo4j graph storage
|   |   |-- postgres_impl.py        # PostgreSQL storage
|   |   |-- mongo_impl.py           # MongoDB storage
|   |   |-- milvus_impl.py          # Milvus vector storage
|   |   +-- qdrant_impl.py          # Qdrant vector storage
|   |-- llm/                         # LLM provider bindings
|   |-- rerank/                      # Reranker implementations
|   |-- evaluation/                  # RAGAS evaluation framework
|   |   |-- eval_rag_quality.py      # RAGEvaluator class
|   |   |-- evaluation_manager.py    # WebUI integration manager
|   |   |-- datasets/                # Evaluation datasets (JSON)
|   |   |-- results/                 # Evaluation result files
|   |   +-- sample_dataset.json      # Default test dataset
|   |-- lightrag.py                  # Main LightRAG orchestrator
|   |-- operate.py                   # Core extraction/query operations
|   |-- base.py                      # Abstract storage base classes
|   +-- chunking.py                  # Chunking strategies
|-- lightrag_webui/                  # React WebUI source
|   |-- src/
|   |   |-- api/lightrag.ts          # TypeScript API client
|   |   |-- components/              # Shared components
|   |   |   |-- AboutDialog.tsx      # About DocForge with entity taxonomy
|   |   |   |-- graph/               # Graph visualization components
|   |   |   |-- retrieval/           # Query interface components
|   |   |   +-- ui/                  # Base UI components
|   |   |-- features/                # Page-level components
|   |   |   |-- DocumentManager.tsx  # Document upload/management
|   |   |   |-- DocumentProcessingPanel.tsx  # Extraction/chunking config
|   |   |   |-- EvaluationPanel.tsx  # RAGAS evaluation UI
|   |   |   |-- GraphViewer.tsx      # Knowledge graph viewer
|   |   |   |-- RetrievalTesting.tsx # Query/retrieval interface
|   |   |   |-- SettingsPanel.tsx    # System settings
|   |   |   +-- SiteHeader.tsx       # Header with DocForge branding
|   |   |-- locales/                 # i18n translations
|   |   |   |-- en.json              # English
|   |   |   +-- ro.json              # Romanian
|   |   +-- stores/                  # Zustand state stores
|   +-- public/                      # Static assets (logo, favicon)
|-- docs/                            # Documentation
|-- tests/                           # Test suite
|-- .env                             # Environment configuration
|-- env.example                      # Configuration template
|-- CLAUDE.md                        # Development guide
+-- README.md                        # This file
```

---

## API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/documents/upload` | Upload documents |
| `GET` | `/documents/paginated` | List documents with pagination |
| `DELETE` | `/documents/{doc_id}` | Delete a document |
| `POST` | `/query` | Query the RAG system |
| `POST` | `/query/stream` | Streaming query |
| `GET` | `/graph/nodes` | Get graph nodes |

### Configuration Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/config` | Get current server configuration |
| `PATCH` | `/config` | Update configuration (chunking, extraction, etc.) |

### Evaluation Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/evaluation/environment` | Check RAGAS availability |
| `POST` | `/evaluation/run` | Start new evaluation |
| `GET` | `/evaluation/status/{eval_id}` | Get evaluation progress |
| `GET` | `/evaluation/results` | List past evaluations |
| `GET` | `/evaluation/results/{filename}` | Get detailed result |
| `DELETE` | `/evaluation/results/{filename}` | Delete result |
| `GET` | `/evaluation/datasets` | List available datasets |

Full interactive API docs at **http://localhost:9621/docs**

---

## Contributing

This is a private project. For internal contributions:

1. Create a feature branch from `main`
2. Make changes following existing code style
3. Run tests: `pytest tests`
4. Lint: `ruff check .`
5. Build WebUI: `cd lightrag_webui && bun run build`
6. Submit PR with description

### Code Style

- **Python**: PEP 8, type annotations, async/await, `lightrag.utils.logger` for logging
- **TypeScript/React**: Functional components, hooks, 2-space indent, Tailwind utility-first
- **Package Manager**: Always use Bun for frontend (never npm/yarn)
- **i18n**: All UI strings via react-i18next in `en.json` and `ro.json`

---

## License

Private/Internal Use

---

**DocForge** - Built for production RAG systems with multimodal document intelligence
