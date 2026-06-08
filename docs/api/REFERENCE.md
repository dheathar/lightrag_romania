# API Reference

The DocForge API server runs at `http://localhost:9621` by default. Interactive documentation is available at `http://localhost:9621/docs` (Swagger UI).

All endpoints return JSON. Errors follow the format: `{"detail": "error message"}`.

## Authentication

When `AUTH_ACCOUNTS` is set, all endpoints (except whitelisted paths) require authentication.

**Bearer token (JWT):**
```
Authorization: Bearer <token>
```

**API key:**
```
X-API-Key: <your-api-key>
```

Obtain a JWT token via `POST /login`.

---

## Health

### GET /health
Returns server status and configuration summary.

**Auth:** Not required (always whitelisted)

**Response 200:**
```json
{
  "status": "healthy",
  "working_directory": "./rag_storage",
  "input_directory": "./inputs",
  "configuration": {
    "llm_binding": "openai",
    "llm_binding_host": "https://api.openai.com/v1",
    "llm_model": "gpt-4o",
    "embedding_binding": "openai",
    "embedding_binding_host": "https://api.openai.com/v1",
    "embedding_model": "text-embedding-3-large",
    "kv_storage": "JsonKVStorage",
    "doc_status_storage": "JsonDocStatusStorage",
    "graph_storage": "NetworkXStorage",
    "vector_storage": "NanoVectorDBStorage",
    "workspace": null,
    "max_graph_nodes": "1000",
    "enable_rerank": false,
    "rerank_binding": null,
    "rerank_model": null,
    "summary_language": "English",
    "force_llm_summary_on_merge": true,
    "max_parallel_insert": 2,
    "max_async": 4,
    "embedding_func_max_async": 8,
    "embedding_batch_num": 10,
    "cosine_threshold": 0.2,
    "min_rerank_score": 0.0,
    "related_chunk_number": 5
  },
  "pipeline_busy": false,
  "core_version": "1.5.0",
  "api_version": "1.2.0",
  "auth_mode": "disabled",
  "webui_title": "My Graph KB",
  "webui_description": "Simple and Fast Graph Based RAG System"
}
```

---

## Authentication Endpoints

### POST /login
Authenticate with username and password, receive a JWT token.

**Request (form data):**
```
username=admin&password=admin123
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Response 401:** Invalid credentials

---

## Query Endpoints

### POST /query
Execute a RAG query and return a complete response.

**Request body:** See [API Contracts](./CONTRACTS.md#queryrequest)

**Response 200:**
```json
{
  "response": "The EU Cohesion Policy aims to...",
  "references": [
    {
      "id": "chunk-abc123",
      "content": "excerpt from source document",
      "metadata": {
        "file_path": "document.pdf",
        "chunk_order_index": 5
      }
    }
  ]
}
```

**Response 400:** Pipeline busy, try again later
**Response 500:** LLM or storage error

### POST /query/stream
Same as `/query` but returns a Server-Sent Events stream.

**Response:** `text/event-stream`
```
data: The
data: EU
data: Cohesion
data: ...
data: [DONE]
```

After `[DONE]`, the last `data:` field before it contains a JSON object with references.

### POST /query/withdocuments
Query using uploaded documents as ad-hoc context without inserting into the knowledge graph.

**Request:** Multipart form — `query` field + one or more `files` fields
**Response:** Same as `/query`

---

## Document Endpoints

### POST /documents/upload
Upload one or more files for ingestion into the knowledge graph.

**Request:** Multipart form, field name `files`

**Supported file types:** `.pdf`, `.txt`, `.md`, `.docx`, `.pptx`, `.xlsx`

**Response 200:**
```json
{
  "status": "enqueued",
  "message": "3 file(s) enqueued for processing",
  "track_ids": ["track_abc123", "track_def456", "track_ghi789"]
}
```

### POST /documents/text
Insert raw text content directly (no file upload required).

**Request body:**
```json
{
  "text": "Your document text content here...",
  "id": "optional-custom-id"
}
```

**Response 200:**
```json
{
  "status": "success",
  "id": "doc-abc123",
  "message": "Text inserted successfully"
}
```

### POST /documents/url
Fetch and insert content from a URL.

**Request body:**
```json
{
  "url": "https://example.com/document.pdf"
}
```

### GET /documents
List all documents with their processing status.

**Query params:**
- `status` (optional): Filter by `PENDING`, `PROCESSING`, `DONE`, `FAILED`

**Response 200:**
```json
{
  "statuses": {
    "doc-abc123": {
      "id": "doc-abc123",
      "content_summary": "First 100 chars of content...",
      "file_path": "document.pdf",
      "status": "DONE",
      "created_at": "2026-02-18T10:00:00Z",
      "updated_at": "2026-02-18T10:01:30Z",
      "chunks_count": 15,
      "error": null
    }
  }
}
```

### GET /documents/paginated
Paginated document list. Polled every 5–30 seconds by the WebUI.

**Query params:** `page` (default 1), `page_size` (default 50), `status` (optional filter)

**Response 200:**
```json
{
  "statuses": [...],
  "total": 89,
  "page": 1,
  "page_size": 50
}
```

### GET /documents/pipeline_status
Returns the current pipeline processing state. Polled every 2 seconds by the WebUI.

**Response 200:**
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

### POST /documents/scan
Trigger a scan of the input directory to auto-ingest new files.

**Response 200:**
```json
{
  "status": "started",
  "message": "Scanning ./inputs directory"
}
```

### DELETE /documents/{doc_id}
Remove a document from the knowledge graph and all storage backends.

**Response 200:**
```json
{
  "status": "success",
  "message": "Document deleted successfully",
  "deleted_chunks": 15
}
```

---

## Graph Endpoints

### GET /graph
Retrieve the knowledge graph within a label scope.

**Query params:**
- `label` (optional): Filter to a specific node label
- `max_depth` (default 1): Relationship traversal depth
- `max_nodes` (default 1000): Maximum nodes to return

**Response 200:**
```json
{
  "nodes": [
    {
      "id": "entity-name",
      "labels": ["ORGANIZATION"],
      "properties": {
        "description": "...",
        "entity_type": "ORGANIZATION",
        "source_ids": "chunk1<SEP>chunk2"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-id",
      "source": "entity-a",
      "target": "entity-b",
      "type": "RELATION",
      "properties": {
        "keywords": "cooperates, partners",
        "description": "...",
        "weight": 1.5
      }
    }
  ]
}
```

### GET /graph/entity/{entity_name}
Get a specific entity and its immediate neighborhood.

### GET /graph/label/list
List all entity labels/types present in the graph.

### PUT /graph/entity
Update an entity's properties.

**Request body:**
```json
{
  "entity_name": "European Commission",
  "updated_data": {
    "description": "Updated description text"
  },
  "allow_rename": false,
  "allow_merge": false
}
```

### DELETE /graph/entity/{entity_name}
Delete an entity and all its relations.

### POST /graph/entity/merge
Merge duplicate entities into a canonical entity.

**Request body:**
```json
{
  "entities_to_change": ["Elon Msk", "Ellon Musk"],
  "entity_to_change_into": "Elon Musk"
}
```

### POST /graph/entity
Create a new entity.

**Request body:**
```json
{
  "entity_name": "Tesla",
  "entity_data": {
    "description": "Electric vehicle manufacturer",
    "entity_type": "ORGANIZATION"
  }
}
```

### GET /graph/relation
Get a relation between two entities.

**Query params:** `source_id`, `target_id`

### PUT /graph/relation
Update a relation's properties.

---

## Configuration Endpoints

### GET /config
Returns current server configuration.

**Response 200:** See [API Contracts — ServerConfig](./CONTRACTS.md#serverconfig)

### PUT /config
Update server configuration at runtime. Supports chunking, query defaults, document processing, and entity types.

**Request body:** See [API Contracts — ServerConfigUpdate](./CONTRACTS.md#serverconfigupdate)

**Note:** Changes to `chunk_size`, `chunk_overlap_size`, and `entity_types` only affect documents ingested after the update. Existing documents are not re-processed.

---

## Evaluation Endpoints

### POST /evaluation/run
Start a RAGAS evaluation in the background.

**Request body:**
```json
{
  "test_cases": [
    {
      "question": "What is the budget of the programme?",
      "ground_truth": "The programme budget is EUR 500 million.",
      "project": "optional-project-tag"
    }
  ],
  "use_sample_dataset": false,
  "dataset_filename": null
}
```

**Response 200:**
```json
{
  "status": "started",
  "eval_id": "eval_20260218_143022_a1b2c3d4",
  "message": "Evaluation started with 5 test cases",
  "total_tests": 5
}
```

**Response 409:** Another evaluation is already running.

### GET /evaluation/status/{eval_id}
Check evaluation progress.

**Response 200:**
```json
{
  "status": "running",
  "progress": 3,
  "total": 5,
  "started_at": "2026-02-18T14:30:22Z",
  "completed_at": null,
  "result_file": null,
  "elapsed_time": 45.2,
  "avg_ragas_score": null,
  "error": null
}
```

### GET /evaluation/running
Get the currently running evaluation (if any).

### GET /evaluation/results
List all saved evaluation result files.

**Response 200:**
```json
[
  {
    "filename": "results_20260218_143022.json",
    "timestamp": "2026-02-18T14:30:22Z",
    "total_tests": 5,
    "elapsed_time": 87.3,
    "avg_ragas_score": 0.78,
    "pipeline_config": {
      "extraction_engine": "DOCLING",
      "chunking_method": "SEMANTIC",
      "chunk_size": 1200,
      "chunk_overlap_size": 100,
      "vision_enabled": true,
      "vision_model": "google/gemini-2.0-flash-001"
    }
  }
]
```

### GET /evaluation/results/{filename}
Get full results including per-test-case breakdown.

### DELETE /evaluation/results/{filename}
Delete a result file.

### GET /evaluation/environment
Check whether RAGAS dependencies are installed and the evaluation LLM is configured.

**Response 200:**
```json
{
  "ragas_installed": true,
  "eval_llm_configured": true,
  "eval_llm_model": "gpt-4o-mini",
  "eval_embedding_model": "text-embedding-3-large",
  "message": "Evaluation environment ready"
}
```

### GET /evaluation/datasets
List available evaluation dataset files.

---

## Ollama-Compatible Endpoints

These endpoints implement the Ollama wire protocol, allowing LightRAG to be used as a drop-in Ollama replacement for compatible clients.

### GET /api/tags
Returns model information in Ollama format.

### POST /api/chat
Chat completion using LightRAG as the retrieval backend.

### POST /api/show
Show model information.
