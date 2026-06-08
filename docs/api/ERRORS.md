# API Errors

## HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | Success | — |
| 400 | Bad Request | Pipeline busy; invalid file type; malformed request |
| 401 | Unauthorized | Missing or invalid JWT token or API key |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Entity, document, or result file does not exist |
| 409 | Conflict | Evaluation already running (only one at a time) |
| 422 | Unprocessable Entity | Pydantic validation failed — see `detail` array for field errors |
| 500 | Internal Server Error | LLM API error, storage backend failure, extraction error |
| 503 | Service Unavailable | LLM provider down; storage backend unreachable |

## Common Error Scenarios

### Pipeline Busy (400)

```json
{"detail": "Pipeline is currently processing documents. Please wait."}
```

A document ingestion is in progress. The WebUI polls `/documents/pipeline_status` and shows a spinner. Programmatic clients should poll until `busy: false` before querying.

### Query Too Short (422)

```json
{
  "detail": [
    {
      "loc": ["body", "query"],
      "msg": "String should have at least 3 characters",
      "type": "string_too_short"
    }
  ]
}
```

Queries must be at least 3 characters long.

### Document Not Found (404)

```json
{"detail": "Document 'doc-abc123' not found"}
```

The document ID does not exist in the doc status storage.

### Evaluation Already Running (409)

```json
{
  "status": "busy",
  "eval_id": "eval_20260218_143022_a1b2c3d4",
  "message": "Evaluation already running",
  "total_tests": 0
}
```

Only one RAGAS evaluation can run at a time. Check `GET /evaluation/running` before starting a new one.

### LLM Provider Error (500)

```json
{"detail": "LLM request failed: RateLimitError from OpenAI"}
```

LLM provider returned an error. Common causes:
- Rate limit exceeded (wait and retry)
- Invalid API key
- Model not available in your tier
- Context window exceeded (reduce `MAX_TOTAL_TOKENS` or `CHUNK_SIZE`)

### Entity Not Found (404)

```json
{"detail": "Entity 'NonExistentEntity' not found in graph"}
```

### Embedding Dimension Mismatch (500)

If the embedding model is changed after documents have been indexed, new embeddings will have a different dimensionality than stored ones.

```json
{"detail": "Embedding dimension mismatch: stored=1536, new=3072"}
```

**Resolution:** Clear the vector storage and re-index all documents. See [Troubleshooting](../guides/TROUBLESHOOTING.md#embedding-model-change).

### Storage Backend Unreachable (503)

```json
{"detail": "Failed to connect to Neo4j: ServiceUnavailable at bolt://localhost:7687"}
```

**Resolution:** Ensure the storage backend service is running and the connection string is correct.

## Evaluation-Specific Errors

### RAGAS Not Installed

```json
{
  "ragas_installed": false,
  "eval_llm_configured": false,
  "message": "RAGAS not installed. Run: uv sync --extra evaluation"
}
```

Install with: `uv sync --extra evaluation`

### Evaluation LLM Not Configured

```json
{
  "ragas_installed": true,
  "eval_llm_configured": false,
  "message": "EVAL_LLM_BINDING_API_KEY not set. See env.example for EVAL_* variables."
}
```

Set `EVAL_LLM_MODEL` and `EVAL_LLM_BINDING_API_KEY` in your `.env`.

### Dataset File Not Found (400)

```json
{"detail": "Dataset file 'datasets/missing.json' not found in evaluation directory"}
```

## Document Processing Errors

### Unsupported File Type (400)

```json
{"detail": "File type '.exe' is not supported. Supported types: .pdf, .txt, .md, .docx, .pptx, .xlsx"}
```

### File Too Large (413)

```json
{"detail": "File size exceeds maximum allowed size of 100MB"}
```

Increase `MAX_UPLOAD_SIZE` in `.env` or configure your reverse proxy's `client_max_body_size`.

### Vision Model Error (logged, ingestion continues)

When vision description fails for an image, the error is logged at WARNING level and ingestion continues without the image description. The figure is silently skipped rather than failing the document.

Check `lightrag.log` for:
```
WARNING: Failed to describe image with vision model: [error details]
```

## Garbled Text / OCR Fallback

When Docling detects garbled text (glyph encoding issues in PDFs), a two-tier fallback is triggered:

1. **Tier 1:** Retry with force-OCR mode (free, local)
2. **Tier 2:** Send page images to vision LLM (requires `VISION_ENABLED=true`)

If both fail, the page is ingested as-is with whatever text was extracted. This is logged at WARNING level.

## Authentication Errors

### Missing Token (401)

```
HTTP 401 Unauthorized
WWW-Authenticate: Bearer
{"detail": "Not authenticated"}
```

### Expired Token (401)

```json
{"detail": "Token has expired"}
```

Re-authenticate via `POST /login`.

### Invalid API Key (401)

```json
{"detail": "Invalid API key"}
```

Check the `X-API-Key` header matches `LIGHTRAG_API_KEY` in `.env`.

## Graph Operation Errors

### Entity Merge Conflict (400)

```json
{"detail": "Cannot merge entity into itself"}
```

### Duplicate Entity Name (409)

```json
{"detail": "Entity 'Tesla' already exists. Use allow_rename=true to overwrite."}
```

## Debugging Tips

1. **Enable verbose logging:** Set `VERBOSE=true` and `LOG_LEVEL=DEBUG` in `.env`
2. **Check the log file:** Default at `./lightrag.log` or `LOG_DIR`-specified path
3. **Use only_need_context:** Set `"only_need_context": true` in a query to see what context is retrieved without calling the LLM
4. **Test RAGAS environment:** `GET /evaluation/environment` before running evaluations
5. **Poll pipeline status:** `GET /documents/pipeline_status` to check if the pipeline is busy before sending queries
