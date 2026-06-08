# Configuration Reference

All configuration is done via environment variables in a `.env` file at the project root. CLI arguments (used with `lightrag-server`) provide the same options but fall back to env vars.

Copy `env.example` as your starting point: `cp env.example .env`

## Server Settings

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `HOST` | `0.0.0.0` | No | Bind address for the API server |
| `PORT` | `9621` | No | Port for the API server |
| `WORKERS` | `2` | No | Gunicorn worker count (multi-worker mode only) |
| `TIMEOUT` | `150` | No | Gunicorn worker timeout in seconds |
| `CORS_ORIGINS` | (none) | No | Comma-separated allowed CORS origins |
| `SSL` | `false` | No | Enable HTTPS |
| `SSL_CERTFILE` | — | No | Path to TLS certificate |
| `SSL_KEYFILE` | — | No | Path to TLS private key |
| `WORKING_DIR` | `./rag_storage` | No | Directory for file-based storage backends |
| `INPUT_DIR` | `./inputs` | No | Directory scanned for auto-ingested documents |
| `TIKTOKEN_CACHE_DIR` | — | No | Offline tiktoken cache directory |
| `WEBUI_TITLE` | `My Graph KB` | No | Title shown in the WebUI header |
| `WEBUI_DESCRIPTION` | (default) | No | Description shown in the WebUI |
| `MAX_GRAPH_NODES` | `1000` | No | Maximum nodes returned by graph API endpoints |
| `LOG_LEVEL` | `INFO` | No | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `VERBOSE` | `false` | No | Enable verbose debug output |
| `LOG_MAX_BYTES` | `10485760` | No | Log file rotation size (10MB) |
| `LOG_BACKUP_COUNT` | `5` | No | Number of rotated log files to keep |
| `LOG_DIR` | (cwd) | No | Directory for log files |

## Authentication

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `AUTH_ACCOUNTS` | — | No | Comma-separated `user:pass` pairs. If set, auth is enabled. |
| `TOKEN_SECRET` | — | If auth enabled | Secret key for JWT signing (use a long random string) |
| `TOKEN_EXPIRE_HOURS` | `48` | No | JWT token lifetime in hours |
| `GUEST_TOKEN_EXPIRE_HOURS` | `24` | No | Guest JWT token lifetime |
| `JWT_ALGORITHM` | `HS256` | No | JWT signing algorithm |
| `TOKEN_AUTO_RENEW` | `true` | No | Auto-renew tokens on sliding window |
| `TOKEN_RENEW_THRESHOLD` | `0.5` | No | Renew when remaining time < total * threshold |
| `LIGHTRAG_API_KEY` | — | No | Static API key for `X-API-Key` header auth |
| `WHITELIST_PATHS` | `/health,/api/*` | No | Paths that bypass authentication |

## Query Parameters

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_LLM_CACHE` | `true` | Cache LLM responses for query (not for streaming) |
| `TOP_K` | `40` | Default KG entities/relations to retrieve |
| `CHUNK_TOP_K` | `20` | Default text chunks to retrieve |
| `MAX_ENTITY_TOKENS` | `6000` | Max tokens allocated for entity context |
| `MAX_RELATION_TOKENS` | `8000` | Max tokens allocated for relation context |
| `MAX_TOTAL_TOKENS` | `30000` | Total token budget (entity + relation + chunk) |
| `COSINE_THRESHOLD` | `0.2` | Minimum cosine similarity for vector search results |
| `KG_CHUNK_PICK_METHOD` | `VECTOR` | Chunk selection: `VECTOR` (similarity) or `WEIGHT` (entity weight) |
| `RELATED_CHUNK_NUMBER` | `5` | Max chunks per entity/relation in KG retrieval |

## Reranking

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `RERANK_BINDING` | `null` | No | Reranker type: `null`, `cohere`, `jina`, `aliyun` |
| `RERANK_MODEL` | — | If reranking | Reranker model name |
| `RERANK_BINDING_HOST` | — | If reranking | Reranker API endpoint URL |
| `RERANK_BINDING_API_KEY` | — | If reranking | Reranker API key |
| `RERANK_BY_DEFAULT` | `true` | No | Enable reranking by default in query params |
| `MIN_RERANK_SCORE` | `0.0` | No | Minimum score threshold (0.0 = keep all) |
| `RERANK_ENABLE_CHUNKING` | — | No | Split docs before reranking (for ColBERT models) |
| `RERANK_MAX_TOKENS_PER_DOC` | `480` | No | Max tokens per chunk for rerank chunking |

## Document Processing

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `ENABLE_LLM_CACHE_FOR_EXTRACT` | `true` | No | Cache LLM responses during entity extraction |
| `SUMMARY_LANGUAGE` | `English` | No | Language for entity/relation descriptions |
| `MAX_UPLOAD_SIZE` | `104857600` | No | Max upload file size in bytes (100MB). Set to 0 for unlimited. |
| `PDF_DECRYPT_PASSWORD` | — | No | Password for encrypted PDFs |
| `DOCUMENT_LOADING_ENGINE` | `DEFAULT` | No | `DEFAULT` (pypdf) or `DOCLING` (IBM Docling) |
| `ENTITY_TYPES` | (11 defaults) | No | JSON array of entity type strings |
| `CHUNK_SIZE` | `1200` | No | Target chunk size in tokens |
| `CHUNK_OVERLAP_SIZE` | `100` | No | Overlap tokens between consecutive chunks |
| `CHUNKING_METHOD` | `TOKEN_SIZE` | No | `TOKEN_SIZE`, `SEMANTIC`, or `HYBRID` |
| `SEMANTIC_SIMILARITY_THRESHOLD` | `0.8` | No | Percentile threshold for semantic chunking |
| `SEMANTIC_MIN_CHUNK_SIZE` | `100` | No | Minimum tokens per semantic chunk |
| `SEMANTIC_MAX_TOKENS` | `100000` | No | Max tokens before fallback to token chunking |
| `FORCE_LLM_SUMMARY_ON_MERGE` | `8` | No | Description segments to trigger LLM merge summary |
| `SUMMARY_MAX_TOKENS` | `1200` | No | Max tokens in entity description summaries |
| `SUMMARY_LENGTH_RECOMMENDED` | `600` | No | Target length for LLM-generated summaries |
| `SUMMARY_CONTEXT_SIZE` | `12000` | No | Max context tokens for summary generation |
| `MAX_EXTRACT_INPUT_TOKENS` | `20480` | No | Max tokens in entity extraction input |
| `MAX_SOURCE_IDS_PER_ENTITY` | `300` | No | Max source chunk IDs stored per entity |
| `MAX_SOURCE_IDS_PER_RELATION` | `300` | No | Max source chunk IDs stored per relation |
| `SOURCE_IDS_LIMIT_METHOD` | `FIFO` | No | ID eviction policy: `FIFO` or `KEEP` |
| `MAX_FILE_PATHS` | `100` | No | Max file paths stored in entity metadata |

## Vision Model Configuration

Requires `DOCUMENT_LOADING_ENGINE=DOCLING`.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `VISION_ENABLED` | `false` | No | Enable vision model for figure description |
| `VISION_MODEL` | — | If vision | Vision model name (e.g., `google/gemini-2.0-flash-001`) |
| `VISION_API_KEY` | — | If vision | API key for vision model |
| `VISION_BASE_URL` | — | If vision | Base URL for vision API (e.g., `https://openrouter.ai/api/v1`) |
| `VISION_PROMPT` | (default) | No | Prompt for figure description |
| `DOCLING_IMAGES_SCALE` | `2.0` | No | Resolution scale for extracted images |
| `MAX_FIGURES_PER_DOC` | `20` | No | Maximum figures to describe per document |
| `VISION_OCR_PROMPT` | (default) | No | Prompt for OCR fallback via vision model |
| `MAX_VISION_OCR_PAGES` | `50` | No | Max pages to OCR per document |

## Concurrency

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_ASYNC` | `4` | Max concurrent LLM requests (query + extraction) |
| `MAX_PARALLEL_INSERT` | `2` | Max documents processed simultaneously |
| `EMBEDDING_FUNC_MAX_ASYNC` | `8` | Max concurrent embedding requests |
| `EMBEDDING_BATCH_NUM` | `10` | Texts per embedding API batch |

## LLM Configuration

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `LLM_BINDING` | `openai` | Yes | Provider: `openai`, `ollama`, `azure_openai`, `gemini`, `aws_bedrock`, `lollms` |
| `LLM_MODEL` | `gpt-4o` | Yes | Model name/deployment |
| `LLM_BINDING_HOST` | (provider default) | No | API endpoint URL |
| `LLM_BINDING_API_KEY` | — | Usually | API key |
| `LLM_TIMEOUT` | `180` | No | Per-request timeout in seconds |
| `OLLAMA_LLM_NUM_CTX` | `32768` | For Ollama | Context window size (must be > MAX_TOTAL_TOKENS + 2000) |
| `OLLAMA_LLM_NUM_PREDICT` | — | No | Max output tokens for Ollama |
| `OLLAMA_LLM_STOP` | — | No | Stop sequences as JSON array |
| `OPENAI_LLM_MAX_TOKENS` | — | No | Max output tokens for OpenAI-compatible endpoints |
| `OPENAI_LLM_MAX_COMPLETION_TOKENS` | `9000` | No | For newer OpenAI reasoning models |
| `OPENAI_LLM_TEMPERATURE` | — | No | Sampling temperature |
| `OPENAI_LLM_REASONING_EFFORT` | — | No | For o1/o3 models: `minimal`, `medium`, `high` |
| `OPENAI_LLM_EXTRA_BODY` | — | No | Extra JSON body fields (e.g., for OpenRouter) |
| `AZURE_OPENAI_API_VERSION` | — | For Azure | Azure OpenAI API version |
| `AZURE_OPENAI_DEPLOYMENT` | — | For Azure | Deployment name override |
| `GEMINI_LLM_MAX_OUTPUT_TOKENS` | `9000` | No | Max tokens for Gemini |
| `GEMINI_LLM_TEMPERATURE` | `0.7` | No | Temperature for Gemini |
| `GEMINI_LLM_THINKING_CONFIG` | — | No | Thinking budget JSON for Gemini |
| `GOOGLE_GENAI_USE_VERTEXAI` | — | For Vertex AI | Set to `true` |
| `GOOGLE_CLOUD_PROJECT` | — | For Vertex AI | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | — | For Vertex AI | GCP region |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | For Vertex AI | Path to service account JSON |
| `BEDROCK_LLM_TEMPERATURE` | `1.0` | No | Temperature for Bedrock |

## Embedding Configuration

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `EMBEDDING_BINDING` | `openai` | Yes | Provider: `openai`, `ollama`, `azure_openai`, `jina`, `gemini`, `aws_bedrock`, `lollms` |
| `EMBEDDING_MODEL` | `text-embedding-3-large` | Yes | Embedding model name |
| `EMBEDDING_DIM` | `3072` | Yes | Embedding vector dimension (must match model output) |
| `EMBEDDING_BINDING_HOST` | (provider default) | No | API endpoint URL |
| `EMBEDDING_BINDING_API_KEY` | — | Usually | API key |
| `EMBEDDING_TOKEN_LIMIT` | `8192` | No | Max tokens per embedding request |
| `EMBEDDING_SEND_DIM` | `false` | No | Send dimension parameter to API (required for Jina, optional for OpenAI) |
| `EMBEDDING_TIMEOUT` | `30` | No | Per-request timeout in seconds |
| `OLLAMA_EMBEDDING_NUM_CTX` | `8192` | No | Context window for Ollama embedding |
| `AZURE_EMBEDDING_API_VERSION` | — | For Azure | Azure OpenAI API version |
| `AZURE_EMBEDDING_DEPLOYMENT` | — | For Azure | Deployment name override |

## Workspace

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKSPACE` | — | Data isolation prefix. Valid characters: a-z, A-Z, 0-9, _ |

## Storage Backend Selection

| Variable | Default | Options |
|----------|---------|---------|
| `LIGHTRAG_KV_STORAGE` | `JsonKVStorage` | `JsonKVStorage`, `RedisKVStorage`, `PGKVStorage`, `MongoKVStorage` |
| `LIGHTRAG_VECTOR_STORAGE` | `NanoVectorDBStorage` | `NanoVectorDBStorage`, `MilvusVectorDBStorage`, `QdrantVectorDBStorage`, `PGVectorStorage`, `FaissVectorDBStorage` |
| `LIGHTRAG_GRAPH_STORAGE` | `NetworkXStorage` | `NetworkXStorage`, `Neo4JStorage`, `PGGraphStorage`, `MemgraphStorage` |
| `LIGHTRAG_DOC_STATUS_STORAGE` | `JsonDocStatusStorage` | `JsonDocStatusStorage`, `RedisDocStatusStorage`, `PGDocStatusStorage`, `MongoDocStatusStorage` |

## PostgreSQL Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | — | Database username |
| `POSTGRES_PASSWORD` | — | Database password |
| `POSTGRES_DATABASE` | — | Database name |
| `POSTGRES_MAX_CONNECTIONS` | `12` | Connection pool size |
| `POSTGRES_ENABLE_VECTOR` | `true` | Enable pgvector extension |
| `POSTGRES_VECTOR_INDEX_TYPE` | `HNSW` | Vector index: `HNSW`, `IVFFlat`, `VCHORDRQ` |
| `POSTGRES_HNSW_M` | `16` | HNSW M parameter |
| `POSTGRES_HNSW_EF` | `200` | HNSW ef_construction parameter |
| `POSTGRES_CONNECTION_RETRIES` | `10` | HA retry attempts |
| `POSTGRES_CONNECTION_RETRY_BACKOFF` | `3.0` | Initial retry delay (seconds) |
| `POSTGRES_CONNECTION_RETRY_BACKOFF_MAX` | `30.0` | Maximum retry delay (seconds) |
| `POSTGRES_SSL_MODE` | — | SSL mode: `require`, `verify-ca`, `verify-full` |

## Neo4j Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `NEO4J_URI` | — | Bolt URI (e.g., `bolt://localhost:7687` or `neo4j+s://...`) |
| `NEO4J_USERNAME` | `neo4j` | Username |
| `NEO4J_PASSWORD` | — | Password |
| `NEO4J_DATABASE` | `neo4j` | Database name |
| `NEO4J_MAX_CONNECTION_POOL_SIZE` | `100` | Connection pool size |
| `NEO4J_CONNECTION_TIMEOUT` | `30` | Connection timeout (seconds) |
| `NEO4J_MAX_TRANSACTION_RETRY_TIME` | `30` | Max retry time (seconds) |

## Redis Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URI` | `redis://localhost:6379` | Redis connection URI |
| `REDIS_SOCKET_TIMEOUT` | `30` | Socket timeout (seconds) |
| `REDIS_CONNECT_TIMEOUT` | `10` | Connection timeout (seconds) |
| `REDIS_MAX_CONNECTIONS` | `100` | Connection pool size |
| `REDIS_RETRY_ATTEMPTS` | `3` | Retry attempts on failure |

## MongoDB Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://root:root@localhost:27017/` | MongoDB connection URI |
| `MONGO_DATABASE` | `LightRAG` | Database name |

## Milvus Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MILVUS_URI` | `http://localhost:19530` | Milvus endpoint |
| `MILVUS_DB_NAME` | `lightrag` | Database name |
| `MILVUS_USER` | — | Username (optional) |
| `MILVUS_PASSWORD` | — | Password (optional) |
| `MILVUS_TOKEN` | — | Token auth (alternative to user/pass) |

## Qdrant Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `QDRANT_URL` | `http://localhost:6333` | Qdrant endpoint |
| `QDRANT_API_KEY` | — | API key (optional) |

## Memgraph Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMGRAPH_URI` | `bolt://localhost:7687` | Bolt URI |
| `MEMGRAPH_USERNAME` | — | Username |
| `MEMGRAPH_PASSWORD` | — | Password |
| `MEMGRAPH_DATABASE` | `memgraph` | Database name |

## Langfuse Observability

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `LANGFUSE_ENABLE_TRACE` | `false` | No | Enable LLM call tracing |
| `LANGFUSE_SECRET_KEY` | — | If enabled | Langfuse secret key |
| `LANGFUSE_PUBLIC_KEY` | — | If enabled | Langfuse public key |
| `LANGFUSE_HOST` | `https://cloud.langfuse.com` | No | Langfuse instance URL |

## RAGAS Evaluation

| Variable | Default | Description |
|----------|---------|-------------|
| `EVAL_LLM_MODEL` | `gpt-4o-mini` | LLM model for RAGAS evaluation |
| `EVAL_LLM_BINDING_API_KEY` | (fallback: `OPENAI_API_KEY`) | API key for evaluation LLM |
| `EVAL_LLM_BINDING_HOST` | `https://api.openai.com/v1` | Endpoint for evaluation LLM |
| `EVAL_EMBEDDING_MODEL` | `text-embedding-3-large` | Embedding model for RAGAS |
| `EVAL_EMBEDDING_BINDING_API_KEY` | (fallback chain) | API key for evaluation embeddings |
| `EVAL_EMBEDDING_BINDING_HOST` | (fallback) | Endpoint for evaluation embeddings |
| `EVAL_MAX_CONCURRENT` | `2` | Concurrent test case evaluations |
| `EVAL_QUERY_TOP_K` | `10` | TOP_K for evaluation queries |
| `EVAL_LLM_MAX_RETRIES` | `5` | Retry count for evaluation LLM calls |
| `EVAL_LLM_TIMEOUT` | `180` | Timeout for evaluation LLM calls |

## Ollama Emulation

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_EMULATING_MODEL_NAME` | `lightrag` | Model name in Ollama `/api/tags` response |
| `OLLAMA_EMULATING_MODEL_TAG` | `latest` | Model tag in Ollama `/api/tags` response |
