# Getting Started

This guide gets you from zero to a running DocForge instance with your first documents indexed and your first query answered. Estimated time: 20–30 minutes.

## Prerequisites

| Requirement | Minimum version | Notes |
|-------------|----------------|-------|
| Python | 3.10 | 3.11+ recommended |
| uv | latest | Package manager (install from https://docs.astral.sh/uv/) |
| Bun | 1.x | JavaScript runtime for WebUI (install from https://bun.sh/) |
| Git | any | To clone the repo |
| LLM API key | — | OpenAI, Anthropic, or a running Ollama instance |
| Embedding API key | — | Same provider or Ollama |

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <your-repo-url> docforge
cd docforge

# Install Python dependencies with API and evaluation extras
uv sync --extra api --extra evaluation

# Activate the virtual environment
source .venv/bin/activate           # Linux/macOS
# .venv\Scripts\activate            # Windows (cmd)
# .venv\Scripts\Activate.ps1        # Windows (PowerShell)
```

## Step 2: Configure the Environment

```bash
# Copy the example configuration
cp env.example .env
```

Open `.env` and set the minimum required values:

```bash
# LLM configuration (using OpenAI)
LLM_BINDING=openai
LLM_MODEL=gpt-4o
LLM_BINDING_HOST=https://api.openai.com/v1
LLM_BINDING_API_KEY=sk-your-openai-key-here

# Embedding configuration
EMBEDDING_BINDING=openai
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIM=3072
EMBEDDING_BINDING_HOST=https://api.openai.com/v1
EMBEDDING_BINDING_API_KEY=sk-your-openai-key-here
```

**Using Ollama instead of OpenAI?** Replace with:

```bash
LLM_BINDING=ollama
LLM_MODEL=qwen2.5:32b       # or llama3.1:70b etc.
LLM_BINDING_HOST=http://localhost:11434
OLLAMA_LLM_NUM_CTX=32768    # REQUIRED for Ollama

EMBEDDING_BINDING=ollama
EMBEDDING_MODEL=bge-m3:latest
EMBEDDING_DIM=1024
EMBEDDING_BINDING_HOST=http://localhost:11434
```

## Step 3: Build the WebUI

```bash
cd lightrag_webui
bun install --frozen-lockfile
bun run build
cd ..
```

This compiles the React app into `lightrag/api/webui/`, where the API server serves it as static files.

## Step 4: Start the Server

```bash
# Windows
start.bat

# Linux/macOS
./start.sh

# Or directly with the CLI entry point
lightrag-server
```

The server starts on `http://localhost:9621`.

**Verify it's running:**
```bash
curl http://localhost:9621/health
```

Expected response: `{"status": "healthy", ...}`

## Step 5: Open the WebUI

Navigate to `http://localhost:9621/webui` in your browser.

You will see the DocForge interface with tabs for:
- **Documents** — upload and manage files
- **Graph** — explore the knowledge graph
- **Query** — ask questions
- **Evaluation** — run RAGAS quality checks
- **Config** — adjust pipeline settings

## Step 6: Index Your First Document

### Via WebUI

1. Click the **Documents** tab
2. Click **Upload** or drag-and-drop a PDF, DOCX, or TXT file
3. Watch the processing status update in real time
4. When status shows **DONE**, the document is indexed

### Via API

```bash
curl -X POST http://localhost:9621/documents/upload \
  -F "files=@/path/to/your/document.pdf"
```

### Via text input

```bash
curl -X POST http://localhost:9621/documents/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Your document content here..."}'
```

### Via input directory

Place files in the `./inputs/` directory and trigger a scan:
```bash
curl -X POST http://localhost:9621/documents/scan
```

## Step 7: Ask Your First Question

### Via WebUI

1. Click the **Query** tab
2. Select mode `mix` (recommended)
3. Type your question
4. Click **Send** and watch the streamed response

### Via API

```bash
curl -X POST http://localhost:9621/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main topics in the document?",
    "mode": "mix"
  }'
```

## Step 8: Explore the Knowledge Graph

1. Click the **Graph** tab
2. Use the search box to find an entity by name
3. Click a node to see its description and connected relations
4. Use the layout controls to rearrange the graph
5. Use the Settings panel to adjust the number of nodes displayed

## Development Mode

For active development with hot-reload:

```bash
# Terminal 1: Start API server with auto-reload
./start-dev.sh            # Linux/macOS
start-dev.bat             # Windows

# Terminal 2: Start WebUI dev server (with HMR)
./dev-webui.sh            # Linux/macOS
dev-webui.bat             # Windows
```

The WebUI dev server runs at `http://localhost:5173` and proxies API calls to `http://localhost:9621`.

## Enable Multimodal Processing (Docling + Vision)

To enable layout-aware PDF parsing with figure description:

```bash
# Install Docling extra
uv sync --extra docling

# Add to .env
DOCUMENT_LOADING_ENGINE=DOCLING
VISION_ENABLED=true
VISION_MODEL=google/gemini-2.0-flash-001
VISION_API_KEY=your-vision-api-key
VISION_BASE_URL=https://openrouter.ai/api/v1
```

Then restart the server and re-index your PDFs.

## Enable Reranking

Reranking significantly improves retrieval quality, especially in `mix` mode:

```bash
# Add to .env (using a locally deployed vLLM reranker)
RERANK_BINDING=cohere
RERANK_MODEL=BAAI/bge-reranker-v2-m3
RERANK_BINDING_HOST=http://localhost:8000/v1/rerank
RERANK_BINDING_API_KEY=your-key
RERANK_BY_DEFAULT=true
```

## Enable Authentication

To require login for API and WebUI access:

```bash
# Add to .env
AUTH_ACCOUNTS=admin:strongpassword123,analyst:password456
TOKEN_SECRET=a-long-random-secret-string
TOKEN_EXPIRE_HOURS=48
```

Restart the server. The WebUI will show a login page.

## Project Directory Structure After Setup

```
docforge/
├── .env                    # Your configuration (gitignored)
├── lightrag/               # Core Python package
├── lightrag_webui/         # WebUI source (TypeScript/React)
├── inputs/                 # Drop documents here for auto-scan
├── rag_storage/            # Working directory for JSON/NanoVDB backends
│   ├── kv_store_text_chunks.json
│   ├── kv_store_llm_response_cache.json
│   ├── graph_chunk_entity_relation.graphml
│   ├── entities/           # Entity embeddings (NanoVectorDB)
│   ├── relationships/      # Relation embeddings
│   └── chunks/             # Chunk embeddings
├── lightrag.log            # Application log
└── docs/                   # This documentation
```

## Next Steps

- [Configuration Reference](../operations/CONFIGURATION.md) — tune every setting
- [API Reference](../api/REFERENCE.md) — integrate programmatically
- [Extending the System](./EXTENDING.md) — add storage backends, LLM providers
- [Deployment Guide](../operations/DEPLOYMENT.md) — Docker, production setup
- [Troubleshooting](./TROUBLESHOOTING.md) — common issues
