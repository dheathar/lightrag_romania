# Dokploy Deployment Guide — Multimodal Knowledge Base

## Live Instance

| Item | Value |
|------|-------|
| URL | https://docforge.labor-innovation.com |
| Dokploy Panel | https://labor-innovation.com (or the Dokploy server address) |
| App name | `lightrag-romania` |
| Internal app ID | `5aNsYhjjNSbr2En8f6bOO` |
| Dokploy internal name | `lightrag-romania-gip2yo` |

---

## GitHub Source

| Item | Value |
|------|-------|
| Owner | `dheathar` |
| Repository | `lightrag_romania` |
| Branch | `main` |
| Dockerfile | `Dockerfile` (repo root) |
| Auto-deploy on push | enabled |

Every `git push` to `main` triggers a Dokploy rebuild and redeploy automatically.

---

## LLM / Embedding / Vision (OpenRouter)

All three services route through [openrouter.ai](https://openrouter.ai).

| Service | Model | Key env var |
|---------|-------|-------------|
| LLM | `anthropic/claude-sonnet-4-5` | `LLM_BINDING_API_KEY` |
| Embedding | `openai/text-embedding-3-small` | `EMBEDDING_BINDING_API_KEY` |
| Vision | `google/gemini-2.0-flash-001` | `VISION_API_KEY` |

**OpenRouter API Key** (same key used for all three — stored in Dokploy env, do not commit to git):
```
sk-or-v1-<see Dokploy environment variables for the full key>
```

All binding hosts point to `https://openrouter.ai/api/v1`.

---

## Full Environment Variables

```env
HOST=0.0.0.0
PORT=9621
WEBUI_TITLE=Multimodal Knowledge Base
ENABLE_LLM_CACHE=true
ENABLE_LLM_CACHE_FOR_EXTRACT=true
SUMMARY_LANGUAGE=English
MAX_ASYNC=4
MAX_PARALLEL_INSERT=2

LLM_BINDING=openai
LLM_MODEL=anthropic/claude-sonnet-4-5
LLM_BINDING_HOST=https://openrouter.ai/api/v1
LLM_BINDING_API_KEY=<OPENROUTER_API_KEY>
OPENAI_LLM_MAX_TOKENS=4096
OPENAI_LLM_MAX_COMPLETION_TOKENS=4096

EMBEDDING_BINDING=openai
EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIM=1536
EMBEDDING_SEND_DIM=false
EMBEDDING_TOKEN_LIMIT=8192
EMBEDDING_BINDING_HOST=https://openrouter.ai/api/v1
EMBEDDING_BINDING_API_KEY=<OPENROUTER_API_KEY>

VISION_ENABLED=true
VISION_MODEL=google/gemini-2.0-flash-001
VISION_API_KEY=<OPENROUTER_API_KEY>
VISION_BASE_URL=https://openrouter.ai/api/v1

ENTITY_TYPES=["Organization","Person","Location","Project","Programme","Regulation","Indicator","Activity","Policy","FinancialData","Beneficiary","Finding","GeographicUnit","Document","Concept"]

RERANK_BINDING=null
OLLAMA_EMULATING_MODEL_TAG=latest
OLLAMA_LLM_NUM_CTX=32768

WORKING_DIR=/app/data/rag_storage
INPUT_DIR=/app/data/inputs
```

---

## Storage / Volumes

A **Docker named volume** is mounted at `/app/data` inside the container. This persists the RAG knowledge graph across deployments.

| Container path | Purpose |
|----------------|---------|
| `/app/data/rag_storage` | LightRAG graph, vector index, KV cache |
| `/app/data/inputs` | Source PDFs placed here are picked up by the scan endpoint |

**Important**: when you redeploy, the volume is reattached and all ingested documents remain. If you delete the volume, the entire knowledge graph is lost and all documents must be re-ingested.

---

## Domain & TLS

- Domain: `docforge.labor-innovation.com`
- Certificate: Let's Encrypt (auto-renewed by Traefik)
- Port: `9621` (container) → `443` (public HTTPS via Traefik)

No Basic Auth is configured — the app is open access.

---

## Ingesting Documents

### Option A — Upload via API (recommended)

```bash
curl -X POST https://docforge.labor-innovation.com/documents/upload \
  -F "file=@/path/to/document.pdf"
```

Returns a `track_id`. Ingestion runs in the background.

### Option B — Scan input directory

Place PDFs at `/app/data/inputs/` then call:

```bash
curl -X POST https://docforge.labor-innovation.com/documents/scan
```

> Note: because `/app/data` is a Docker volume (starts empty), PDFs baked into the image are shadowed. Use the upload API unless you exec into the container to place files.

### Check pipeline progress

```bash
curl https://docforge.labor-innovation.com/documents/pipeline_status
```

---

## Deploying a Code Change

1. Make changes locally, build the WebUI if needed:
   ```bash
   cd lightrag_webui
   bun run build
   cd ..
   ```
2. Commit and push to `main`:
   ```bash
   git add -A
   git commit -m "your message"
   git push
   ```
3. Dokploy detects the push, rebuilds the Docker image, and redeploys automatically.
4. Monitor in the Dokploy dashboard or via:
   ```bash
   curl https://docforge.labor-innovation.com/health
   ```

---

## Useful API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Server health + config |
| `/documents/upload` | POST | Upload a PDF for ingestion |
| `/documents/scan` | POST | Scan input dir for new files |
| `/documents/pipeline_status` | GET | Live ingestion progress |
| `/documents` | GET | List all documents + status |
| `/query` | POST | Query the knowledge graph |
| `/docs` | GET | Swagger UI (full API reference) |

---

## Entity Taxonomy (15 EU/Romania types)

```
Organization, Person, Location, Project, Programme,
Regulation, Indicator, Activity, Policy, FinancialData,
Beneficiary, Finding, GeographicUnit, Document, Concept
```

---

## MCP Access (Claude Code)

The Dokploy server is accessible via the `@dokploy/mcp` MCP tool within Claude Code sessions. The `applicationId` for all programmatic operations is:

```
5aNsYhjjNSbr2En8f6bOO
```
