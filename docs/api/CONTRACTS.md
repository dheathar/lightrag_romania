# API Contracts

This document describes every request and response schema in detail.

## QueryRequest

```json
{
  "query": "string (min 3 chars, required)",
  "mode": "mix | local | global | hybrid | naive | bypass",
  "only_need_context": "boolean | null",
  "only_need_prompt": "boolean | null",
  "response_type": "string | null (e.g. 'Multiple Paragraphs', 'Bullet Points')",
  "top_k": "integer >= 1 | null",
  "chunk_top_k": "integer >= 1 | null",
  "max_entity_tokens": "integer >= 1 | null",
  "max_relation_tokens": "integer >= 1 | null",
  "max_total_tokens": "integer >= 1 | null",
  "hl_keywords": "string[] (default [])",
  "ll_keywords": "string[] (default [])",
  "conversation_history": "ConversationMessage[] (default [])",
  "user_prompt": "string | null",
  "enable_rerank": "boolean | null",
  "stream": "boolean (default false)"
}
```

Fields set to `null` fall back to server-side defaults configured in `.env`.

**`hl_keywords` and `ll_keywords`:** Pre-computed keywords to skip the LLM keyword extraction step. Useful for deterministic testing or when you have domain knowledge to supply.

**`only_need_context`:** Returns the assembled retrieval context string rather than an LLM-generated answer. Useful for debugging what context would be sent to the LLM.

**`only_need_prompt`:** Returns the fully assembled prompt (system + context + user query) without calling the LLM.

**`response_type`:** Instruction to the LLM about output format. Passed verbatim into the response generation prompt.

**`user_prompt`:** Additional system-level instructions appended to the LLM prompt. Use this to add domain-specific answer guidelines.

## ConversationMessage

```json
{
  "role": "user | assistant",
  "content": "string"
}
```

Conversation history is passed to the LLM for multi-turn dialogue. All history messages are sent to the LLM (no truncation at the API level — ensure `max_total_tokens` accounts for history length).

## QueryResult (response)

```json
{
  "response": "string",
  "references": [
    {
      "id": "string",
      "content": "string",
      "metadata": {}
    }
  ]
}
```

## ReferenceItem

```json
{
  "id": "string",
  "content": "string (excerpt from source chunk)",
  "metadata": {
    "file_path": "string (source document path)",
    "chunk_order_index": "integer"
  }
}
```

## DocumentUploadResponse

```json
{
  "status": "enqueued | failed",
  "message": "string",
  "track_ids": ["string"]
}
```

## DocumentStatus

```json
{
  "id": "string (md5 hash of content)",
  "content_summary": "string (first 100 chars)",
  "content_length": "integer",
  "file_path": "string",
  "status": "PENDING | PROCESSING | DONE | FAILED | DUPLICATED",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime",
  "chunks_count": "integer | null",
  "error": "string | null"
}
```

**Status values:**

| Status | Meaning |
|--------|---------|
| `PENDING` | Queued, not yet started |
| `PROCESSING` | Actively being ingested |
| `DONE` | Successfully indexed |
| `FAILED` | Ingestion failed (see `error` field) |
| `DUPLICATED` | Document content already exists |

## PipelineScanProgress

```json
{
  "is_scanning": "boolean",
  "current_file": "string",
  "indexed_count": "integer",
  "total_files": "integer",
  "progress": "number (0-100)",
  "busy": "boolean"
}
```

## GraphNodeResponse

```json
{
  "id": "string (entity name, lowercase normalized)",
  "labels": ["string (entity type)"],
  "properties": {
    "description": "string",
    "entity_type": "string",
    "entity_name": "string",
    "source_ids": "string (chunk IDs separated by <SEP>)",
    "file_path": "string (source file paths separated by <SEP>)",
    "rank": "number",
    "weight": "number"
  }
}
```

## GraphEdgeResponse

```json
{
  "id": "string (source<SEP>target)",
  "source": "string (source entity name)",
  "target": "string (target entity name)",
  "type": "RELATION",
  "properties": {
    "description": "string",
    "keywords": "string (comma-separated)",
    "weight": "number",
    "source_ids": "string",
    "file_path": "string"
  }
}
```

## ServerConfig

Full configuration object returned by `GET /config`:

```json
{
  "chunking": {
    "method": "TOKEN_SIZE | SEMANTIC | HYBRID",
    "chunk_size": 1200,
    "chunk_overlap_size": 100,
    "semantic_similarity_threshold": 0.8,
    "semantic_min_chunk_size": 100,
    "semantic_max_tokens": 100000
  },
  "query": {
    "top_k": 40,
    "chunk_top_k": 20,
    "max_entity_tokens": 6000,
    "max_relation_tokens": 8000,
    "max_total_tokens": 30000,
    "history_turns": 0
  },
  "rerank": {
    "enabled": false,
    "binding": null,
    "model": null,
    "min_score": 0.0
  },
  "summary": {
    "language": "English",
    "max_tokens": 1200,
    "context_size": 12000
  },
  "document_processing": {
    "loading_engine": "DEFAULT | DOCLING",
    "vision_enabled": false,
    "vision_model": null,
    "max_figures_per_doc": 20,
    "entity_types": ["Person", "Organization", "..."],
    "summary_language": "English"
  },
  "storage": {
    "kv_storage": "JsonKVStorage",
    "vector_storage": "NanoVectorDBStorage",
    "graph_storage": "NetworkXStorage",
    "doc_status_storage": "JsonDocStatusStorage"
  }
}
```

## ServerConfigUpdate

Request body for `PUT /config`. All fields are optional — only send the fields you want to change.

```json
{
  "chunking": {
    "method": "SEMANTIC",
    "chunk_size": 800,
    "chunk_overlap_size": 80
  },
  "document_processing": {
    "entity_types": ["Person", "Organization", "Location", "FundingProgramme"],
    "vision_enabled": true,
    "vision_model": "google/gemini-2.0-flash-001"
  }
}
```

## EvaluationRunRequest

```json
{
  "test_cases": [
    {
      "question": "string",
      "ground_truth": "string",
      "project": "string | null"
    }
  ],
  "use_sample_dataset": false,
  "dataset_filename": "string | null (e.g. 'datasets/my_dataset.json')"
}
```

Priority: `test_cases` → `dataset_filename` → `use_sample_dataset` → sample

## EvaluationResult (detailed)

```json
{
  "eval_id": "string",
  "timestamp": "ISO 8601",
  "total_tests": 5,
  "elapsed_time_seconds": 87.3,
  "benchmark_stats": {
    "avg_ragas_score": 0.78,
    "avg_faithfulness": 0.85,
    "avg_answer_relevance": 0.82,
    "avg_context_recall": 0.71,
    "avg_context_precision": 0.73
  },
  "pipeline_config": {
    "extraction_engine": "DOCLING",
    "chunking_method": "SEMANTIC",
    "chunk_size": 1200,
    "chunk_overlap_size": 100,
    "vision_enabled": true,
    "vision_model": "google/gemini-2.0-flash-001"
  },
  "test_results": [
    {
      "question": "string",
      "ground_truth": "string",
      "answer": "string",
      "contexts": ["string"],
      "metrics": {
        "faithfulness": 0.9,
        "answer_relevance": 0.88,
        "context_recall": 0.75,
        "context_precision": 0.80
      },
      "ragas_score": 0.83
    }
  ]
}
```

## EntityCreateRequest

```json
{
  "entity_name": "string (min 1)",
  "entity_data": {
    "description": "string",
    "entity_type": "string"
  }
}
```

## EntityUpdateRequest

```json
{
  "entity_name": "string",
  "updated_data": {
    "description": "string (optional)",
    "entity_type": "string (optional)"
  },
  "allow_rename": false,
  "allow_merge": false
}
```

## EntityMergeRequest

```json
{
  "entities_to_change": ["Duplicate Name 1", "Duplicate Name 2"],
  "entity_to_change_into": "Canonical Entity Name"
}
```

Merges relations from `entities_to_change` into `entity_to_change_into` and deletes the source entities.

## RelationUpdateRequest

```json
{
  "source_id": "string (entity name)",
  "target_id": "string (entity name)",
  "updated_data": {
    "description": "string",
    "keywords": "string"
  }
}
```

## TokenResponse (login)

```json
{
  "access_token": "string (JWT)",
  "token_type": "bearer"
}
```

## Error Responses

All error responses follow FastAPI's standard format:

```json
{
  "detail": "Human-readable error description"
}
```

Validation errors include field-level detail:

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
