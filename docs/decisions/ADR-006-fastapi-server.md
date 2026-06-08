# ADR-006: FastAPI as API Server with Ollama-Compatible Endpoint

## Status
Accepted

## Date
2024-01

## Context

The system needs an HTTP API server for:
- Receiving document uploads
- Executing RAG queries
- Streaming responses (Server-Sent Events)
- Serving the WebUI as static files
- Exposing health and configuration endpoints

Additionally, the growing ecosystem of tools (Open WebUI, Continue, etc.) that integrate with LLMs via the Ollama protocol creates an opportunity to make DocForge accessible to these tools without additional configuration on the client side.

## Decision

Use **FastAPI** as the API framework:
- Automatic OpenAPI documentation at `/docs` and `/redoc`
- Built-in Pydantic request/response validation
- Native async support (matches the async LightRAG core)
- SSE streaming via `StreamingResponse`
- Static file serving via `StaticFiles`

Use **Uvicorn** for single-worker development and **Gunicorn with UvicornWorker** for multi-worker production. Expose both as CLI entry points: `lightrag-server` and `lightrag-gunicorn`.

Implement an **Ollama-compatible API** as a sub-router at `/api/`:
- `GET /api/tags` — returns model info in Ollama format
- `POST /api/chat` — wraps LightRAG query in Ollama chat format
- `POST /api/show` — returns model details

This allows Open WebUI, Ollama Continue, and similar tools to connect to DocForge without any modification.

## Consequences

### Positive
- Automatic API documentation reduces onboarding friction
- Pydantic validation catches malformed requests early with clear error messages
- Async throughout eliminates blocking during LLM calls
- Ollama compatibility greatly expands the ecosystem of compatible tools
- `lightrag-server` and `lightrag-gunicorn` CLI entries make deployment straightforward

### Negative
- FastAPI adds dependencies (Starlette, Pydantic)
- Gunicorn multi-worker mode requires external storage backends (file-based backends are not safe for concurrent writers)

### Risks
- **Ollama API evolution** — Ollama's wire protocol may change in future versions. Mitigated by implementing only the stable core endpoints.

## Alternatives Considered

1. **Flask** — Rejected: synchronous by default (async extensions add complexity); less suitable for streaming
2. **Django REST Framework** — Rejected: too heavyweight; Django is already used in the Hybrid-RAG component
3. **Starlette (bare)** — Rejected: FastAPI provides better developer ergonomics with minimal overhead
4. **gRPC** — Rejected: browser clients require transcoding; HTTP/JSON is simpler for this use case

## References
- `lightrag/api/lightrag_server.py` — main FastAPI application
- `lightrag/api/routers/ollama_api.py` — Ollama-compatible endpoints
- `lightrag/api/gunicorn_config.py` — Gunicorn configuration
- `pyproject.toml` — CLI entry points (`lightrag-server`, `lightrag-gunicorn`)
