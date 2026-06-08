# Monitoring and Observability

## Health Check

The primary health endpoint is `GET /health`. Use this for load balancer probes, uptime monitors, and readiness checks.

```bash
curl http://localhost:9621/health
```

**Expected response shape:**

```json
{
  "status": "healthy",
  "working_directory": "./rag_storage",
  "input_directory": "./inputs",
  "configuration": { ... },
  "pipeline_busy": false,
  "core_version": "1.5.0",
  "api_version": "1.2.0",
  "auth_mode": "disabled",
  "keyed_locks": {
    "current_status": {
      "total_mp_locks": 0,
      "total_async_locks": 2
    }
  }
}
```

**Key fields to monitor:**

| Field | Healthy value | Alert when |
|-------|--------------|-----------|
| `status` | `"healthy"` | Not `"healthy"` |
| `pipeline_busy` | `false` | Stuck `true` for > 10 minutes |
| `keyed_locks.current_status.total_async_locks` | Low number | Growing without bound |

## Pipeline Status

Monitor document ingestion progress:

```bash
curl http://localhost:9621/documents/pipeline_status
```

```json
{
  "is_scanning": false,
  "current_file": "",
  "indexed_count": 89,
  "total_files": 89,
  "progress": 100,
  "busy": false
}
```

**Alert when:** `busy: true` persists for longer than expected document processing time.

## Log-Based Monitoring

Log file location: `./lightrag.log` (or `LOG_DIR` if configured).

**Log format:**
```
2026-02-18 14:30:22,456 - INFO - lightrag - Starting document ingestion for document.pdf
2026-02-18 14:30:23,789 - WARNING - lightrag - Vision description failed for image 2: timeout
2026-02-18 14:30:45,123 - ERROR - lightrag - LLM request failed: RateLimitError
```

**Log rotation:** Configured via `LOG_MAX_BYTES` (default 10MB) and `LOG_BACKUP_COUNT` (default 5 files).

### Key Log Patterns to Monitor

| Pattern | Severity | Action |
|---------|----------|--------|
| `LLM request failed` | ERROR | Check LLM provider status and rate limits |
| `Failed to connect` | ERROR | Check storage backend availability |
| `Vision description failed` | WARNING | Check vision model configuration |
| `Garbled text detected` | WARNING | Informational — OCR fallback triggered |
| `Token limit exceeded` | WARNING | Reduce `CHUNK_SIZE` or `MAX_EXTRACT_INPUT_TOKENS` |
| `Pipeline cancellation requested` | INFO | Normal shutdown during ingestion |

### Enabling Verbose Logging

For debugging, enable DEBUG level:

```bash
LOG_LEVEL=DEBUG
VERBOSE=true
```

This produces significantly more output including:
- Full prompts sent to LLM (truncated)
- Token counts per chunk
- Cache hit/miss for LLM responses
- Lock acquisition and release events

## Langfuse LLM Observability

When `LANGFUSE_ENABLE_TRACE=true`, all LLM calls are traced in Langfuse, providing:
- Latency per LLM call
- Token usage (input + output)
- Model names
- Full prompt/response (configurable)
- Error traces

**Setup:**

```bash
LANGFUSE_ENABLE_TRACE=true
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_HOST=https://cloud.langfuse.com  # or self-hosted URL
```

Note: Langfuse tracing only works with OpenAI-compatible LLM providers (not Ollama native).

Install: `uv sync --extra observability`

## RAGAS Evaluation as Quality Monitor

Use RAGAS evaluations as a scheduled quality check. Store results and track metric trends over time:

1. Prepare a fixed "gold set" of test questions with ground truth answers
2. Run `POST /evaluation/run` with your gold set after each significant change
3. Compare `avg_ragas_score` across result files — each result embeds `pipeline_config` for context

**Metrics to track:**

| Metric | Meaning | Alert threshold |
|--------|---------|----------------|
| `faithfulness` | Answer is grounded in retrieved context | < 0.7 |
| `answer_relevance` | Answer addresses the question | < 0.7 |
| `context_recall` | Relevant information is retrieved | < 0.6 |
| `context_precision` | Retrieved context is relevant (low noise) | < 0.5 |

## Document Processing Metrics

Monitor document ingestion success rate:

```bash
# Get all documents with FAILED status
curl "http://localhost:9621/documents?status=FAILED"
```

Track:
- Total documents: `indexed_count` from `/documents/pipeline_status`
- Failed documents: count of `status=FAILED` from `/documents`
- Processing time: from `created_at` to `updated_at` in `DocumentStatus`

## Storage Backend Monitoring

### PostgreSQL

Monitor via standard PostgreSQL monitoring:
- Connection pool usage (compare active connections to `POSTGRES_MAX_CONNECTIONS`)
- Table sizes for `lightrag_*` tables
- Query latency for vector similarity queries

### Neo4j

Monitor via Neo4j Browser or Bloom:
- Node and relationship counts
- Query execution times
- Memory usage

### Redis

Monitor via Redis CLI:
```bash
redis-cli INFO stats
redis-cli DBSIZE  # Total keys
redis-cli MEMORY USAGE <key>  # Memory for specific key
```

### Milvus

Monitor via Milvus Attu (web UI) or CLI:
- Collection sizes
- Query latency percentiles
- Memory usage

## API Response Time Monitoring

Key endpoints to monitor for latency:

| Endpoint | Expected latency | Alert threshold |
|----------|-----------------|----------------|
| `GET /health` | < 100ms | > 1s |
| `GET /documents/paginated` | < 500ms | > 2s |
| `POST /query` | 3–30s (LLM-bound) | > 60s |
| `POST /documents/upload` | < 1s (enqueue) | > 5s |

Use any HTTP monitoring tool (Prometheus + Grafana, Datadog, New Relic, etc.) to collect these metrics.

## Alerting Recommendations

| Alert | Condition | Response |
|-------|-----------|---------|
| Server down | `GET /health` returns non-200 or times out | Restart service |
| Pipeline stuck | `pipeline_busy: true` for > 15 minutes | Check logs, restart if necessary |
| High error rate | > 5% of `/query` requests return 500 | Check LLM provider status |
| Failed documents | > 10% of documents in FAILED status | Check logs for extraction errors |
| RAGAS score drop | `avg_ragas_score` drops > 0.1 from baseline | Review pipeline changes |
| Storage backend down | Connection errors in logs | Check storage service health |

## Container Health Checks

The `docker-compose.yml` can be extended with a health check:

```yaml
services:
  lightrag:
    # ... existing config ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9621/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```
