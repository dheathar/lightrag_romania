# Troubleshooting

## Quick Diagnostics

Before diving into specific issues, run these checks:

```bash
# 1. Check server health
curl http://localhost:9621/health

# 2. Check log for recent errors
tail -100 lightrag.log

# 3. Check if pipeline is busy
curl http://localhost:9621/documents/pipeline_status

# 4. Check evaluation environment (if running RAGAS)
curl http://localhost:9621/evaluation/environment
```

---

## Storage Not Initialized

**Symptom:** `AttributeError: __aenter__` or `KeyError: 'history_messages'` or similar attribute errors on the storage object.

**Cause:** `await rag.initialize_storages()` was not called after creating the `LightRAG` instance.

**Fix:**
```python
rag = LightRAG(...)
await rag.initialize_storages()  # REQUIRED before any use
# ... use rag ...
await rag.finalize_storages()
```

---

## Embedding Model Change

**Symptom:** After changing `EMBEDDING_MODEL` or `EMBEDDING_DIM`, queries return garbage results or a dimension mismatch error.

**Cause:** Stored vectors were created with a different embedding model. New query-time embeddings have different dimensionality and meaning than stored vectors.

**Fix:**

1. Stop the server
2. Clear the vector storage:
   - JSON/NanoVDB: delete or empty `rag_storage/entities/`, `rag_storage/relationships/`, `rag_storage/chunks/`
   - PostgreSQL: `TRUNCATE TABLE lightrag_entity_vdb, lightrag_relation_vdb, lightrag_chunks_vdb;`
   - Milvus/Qdrant: drop collections and recreate
3. Keep `rag_storage/kv_store_llm_response_cache.json` to avoid re-paying LLM extraction costs
4. Update `EMBEDDING_MODEL` and `EMBEDDING_DIM` in `.env`
5. Restart the server
6. Re-ingest all documents

---

## Entity Types Changed, Graph Inconsistent

**Symptom:** After changing `ENTITY_TYPES`, newly ingested documents have different entity categories than existing documents.

**Fix:**

For a fully consistent graph, clear all storage (graph, vectors, KV) and re-ingest everything:

```bash
# Stop server, then:
rm -rf rag_storage/  # Or clear your external backends
# Restart server, re-ingest all documents
```

For an acceptable mixed graph (when adding new types without removing old ones), you can continue without re-indexing. Existing entities keep their old types; new extractions will use the new taxonomy.

---

## Ollama Context Too Small

**Symptom:** Queries fail, are truncated, or return poor quality answers with Ollama. Log shows context-related errors.

**Cause:** Ollama defaults to 8K context. LightRAG requires at least 32K.

**Fix:**
```bash
# In .env
OLLAMA_LLM_NUM_CTX=32768
```

```bash
# Or set at Ollama level when pulling
ollama run qwen2.5:32b --context-length 32768
```

---

## LLM Returns Garbled/Malformed JSON

**Symptom:** Entity extraction produces no entities, or entities have wrong types. Log shows JSON parse errors.

**Cause:** The LLM returns malformed JSON in the entity extraction response. The `json_repair` library attempts to fix this, but some failures can't be repaired.

**Fix:**

1. Use a stronger model (minimum 32B parameters recommended for extraction)
2. Add stop sequences: `OLLAMA_LLM_STOP='["</s>", "<|EOT|>"]'`
3. Limit max output tokens: `OLLAMA_LLM_NUM_PREDICT=9000`
4. For some models (e.g., Qwen3), disable thinking mode: `OPENAI_LLM_EXTRA_BODY='{"chat_template_kwargs": {"enable_thinking": false}}'`
5. Enable gleaning: set `MAX_GLEANING` higher to retry failed extractions

---

## Infinite Loop / Endless LLM Output

**Symptom:** LLM calls never complete; logs show very high token counts.

**Cause:** Some LLMs (particularly smaller models) enter repetitive loops.

**Fix:**
```bash
# Set max output token limit
OPENAI_LLM_MAX_TOKENS=9000
OLLAMA_LLM_NUM_PREDICT=9000

# Or set timeout
LLM_TIMEOUT=180
```

---

## Rate Limit Errors

**Symptom:** `RateLimitError` in logs; documents fail with API rate limit messages.

**Fix:**

1. Reduce concurrency:
   ```bash
   MAX_ASYNC=2
   MAX_PARALLEL_INSERT=1
   EMBEDDING_FUNC_MAX_ASYNC=4
   ```
2. Add delay between retries (built-in via `tenacity`, but you can adjust backoff)
3. Upgrade your API tier for higher rate limits

---

## Documents Stuck in PENDING or PROCESSING

**Symptom:** Documents remain in `PENDING` or `PROCESSING` status indefinitely.

**Diagnosis:**
```bash
curl http://localhost:9621/documents/pipeline_status
```

If `busy: false` but documents are still `PROCESSING`, the server may have crashed during ingestion.

**Fix:**

1. Check `lightrag.log` for fatal errors during ingestion
2. Restart the server — the pipeline will resume pending documents on next startup
3. If documents are permanently stuck, delete and re-upload them via `DELETE /documents/{id}`

---

## WebUI Cannot Connect to API

**Symptom:** WebUI shows "Failed to connect" or API calls fail in the browser.

**Causes and fixes:**

1. **API server not running:** Start with `./start.sh` or `lightrag-server`
2. **Wrong port:** Check `PORT` in `.env` (default 9621)
3. **CORS blocked:** If WebUI is on a different origin, add to `CORS_ORIGINS` in `.env`:
   ```bash
   CORS_ORIGINS=http://localhost:3000,https://my-domain.com
   ```
4. **Auth required:** If `AUTH_ACCOUNTS` is set, the WebUI login page should appear automatically
5. **Dev mode proxy:** In development, Vite proxies `/` to the API. Ensure the API is running on the same port configured in `lightrag_webui/vite.config.ts`

---

## Graph is Empty / No Entities Extracted

**Symptom:** After uploading documents, the graph shows no nodes.

**Diagnosis steps:**

1. Check document status: `GET /documents` — is it `DONE` or `FAILED`?
2. Check logs for extraction errors
3. Try `only_need_context: true` in a query to see if any context is retrieved

**Common causes:**

1. **Document parsing failed:** Check if the PDF is password-protected. Set `PDF_DECRYPT_PASSWORD` in `.env` or the document may need manual extraction.
2. **LLM not extracting entities:** The LLM may not understand the entity types. Try a stronger model or review the entity taxonomy.
3. **Chunks too small:** If `CHUNK_SIZE` is very small, context may be insufficient for entity extraction. Try `CHUNK_SIZE=1200` (default).
4. **Language mismatch:** Ensure `SUMMARY_LANGUAGE` matches your document language.

---

## Embedding Calls Failing Silently

**Symptom:** Documents process without error, but vector search returns no results.

**Cause:** Embedding function returns wrong shape or `None`, which may be silently swallowed.

**Diagnosis:**
```python
# Quick test of embedding function in Python
import asyncio
from lightrag.llm.openai import openai_embed

async def test():
    result = await openai_embed(["test text"])
    print(f"Shape: {result.shape}, dtype: {result.dtype}")
    # Should be (1, EMBEDDING_DIM) float32

asyncio.run(test())
```

**Fix:** Ensure `EMBEDDING_DIM` matches the actual output dimension of your embedding model.

---

## Evaluation: RAGAS Score is 0 or Very Low

**Symptom:** RAGAS evaluation completes but all metrics score near 0.

**Common causes:**

1. **Wrong evaluation LLM:** RAGAS requires an OpenAI-compatible LLM endpoint. Ollama may not work. Set `EVAL_LLM_BINDING_HOST` to an OpenAI-compatible endpoint.
2. **No context retrieved:** The RAG system returned empty contexts. Check the evaluation questions are relevant to indexed documents.
3. **Ground truth mismatch:** Ground truth answers should be paraphrases of what's in the documents, not exact quotes.
4. **Rate limiting during evaluation:** Reduce `EVAL_MAX_CONCURRENT` to 1.

---

## PostgreSQL Connection Errors

**Symptom:** `asyncpg.exceptions.InvalidPasswordError` or `ConnectionRefusedError` at startup.

**Fix:**
```bash
# Verify connection settings
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_DATABASE=your_database

# For High Availability with failover
POSTGRES_CONNECTION_RETRIES=10
POSTGRES_CONNECTION_RETRY_BACKOFF=3.0
POSTGRES_CONNECTION_RETRY_BACKOFF_MAX=30.0
```

---

## Neo4j Full-Text Index Missing

**Symptom:** Graph queries that rely on full-text search fail with index not found errors.

**Fix:**

```cypher
-- Run in Neo4j browser
CREATE FULLTEXT INDEX entity_fulltext IF NOT EXISTS FOR (n:Entity) ON EACH [n.entity_name];
CREATE FULLTEXT INDEX relation_fulltext IF NOT EXISTS FOR ()-[r:RELATION]-() ON EACH [r.description];
```

Or use the test script: `python tests/test_neo4j_fulltext_index.py`

---

## Windows: HuggingFace Symlink Warning (Docling)

**Symptom:** Warning about symlinks when using Docling on Windows.

**Cause:** HuggingFace Hub uses symlinks for model caching, which require Developer Mode on Windows.

**Fix (already applied in `document_routes.py`):**
```bash
# This is set automatically for Windows in document_routes.py:
HF_HUB_DISABLE_SYMLINKS_WARNING=1
```

If you still see issues, enable Windows Developer Mode in Settings → System → Developer options.

---

## Server Crashes During Shutdown

**Symptom:** Python stack trace about "attached to a different loop" during server shutdown.

**Cause:** Neo4j async driver may fail to finalize if the event loop has changed during shutdown.

**Impact:** Non-fatal — data is not lost. The error appears in logs but doesn't affect ingested data.

**Fix:** The lifespan context in `lightrag_server.py` handles this with a timeout and specific `RuntimeError` catch for this message. If it persists, check Neo4j driver version compatibility.

---

## Getting More Help

1. **Enable verbose logging:** `VERBOSE=true` and `LOG_LEVEL=DEBUG` in `.env`
2. **Use the API docs:** `http://localhost:9621/docs` for interactive API testing
3. **Check the architecture docs:** [Architecture Overview](../architecture/OVERVIEW.md)
4. **Review business rules:** [Business Rules](../data/BUSINESS_RULES.md) for constraint violations
