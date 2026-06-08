# Extending the System

This guide covers the primary extension points in DocForge. Each section explains where to add code, which interfaces to implement, and what conventions must be followed.

## Adding a Storage Backend

Storage backends are the most common extension point. To add a new backend, implement one or more of the four abstract base classes in `lightrag/base.py`.

### Step 1: Choose Which Storage Types to Implement

You can implement any combination of the four storage types:

| Base Class | Required Methods | Purpose |
|------------|-----------------|---------|
| `BaseKVStorage` | `get`, `set`, `delete`, `get_all`, `upsert` | Key-value pairs (chunks, cache) |
| `BaseVectorStorage` | `upsert`, `query`, `delete_entity` | Dense vector similarity search |
| `BaseGraphStorage` | `upsert_node`, `upsert_edge`, `get_node`, `get_edge`, `delete_node`, `nodes_data`, `edges_data` | Entity-relation graph |
| `DocStatusStorage` | `get`, `set`, `delete`, `get_all` | Document processing state |

### Step 2: Create the Implementation File

Place your file in `lightrag/kg/` following the naming convention `{name}_impl.py`:

```python
# lightrag/kg/my_backend_impl.py

from dataclasses import dataclass, field
from typing import Any, Optional
from lightrag.base import BaseKVStorage, StorageNameSpace

@dataclass
class MyBackendKVStorage(BaseKVStorage):
    """My custom KV storage backend."""

    # Add your connection fields here
    _connection_url: str = field(default="")

    def __post_init__(self):
        # Initialize connection from environment or config
        import os
        self._connection_url = os.getenv("MY_BACKEND_URL", "")
        super().__post_init__()

    async def initialize(self):
        """Called once during LightRAG.initialize_storages()."""
        await self._connect()

    async def finalize(self):
        """Called during LightRAG.finalize_storages()."""
        await self._disconnect()

    async def get(self, id: str) -> Optional[Any]:
        # Return None if not found
        ...

    async def set(self, id: str, data: dict):
        ...

    async def delete(self, ids: list[str]):
        ...

    async def get_all(self) -> dict[str, Any]:
        ...

    async def upsert(self, data: dict[str, Any]):
        # data is {id: value_dict}
        ...
```

### Step 3: Register the Backend

Add your class to the `STORAGES` registry in `lightrag/kg/__init__.py`:

```python
# lightrag/kg/__init__.py

STORAGES = {
    # ... existing entries ...
    "MyBackendKVStorage": ("lightrag.kg.my_backend_impl", "MyBackendKVStorage"),
}
```

### Step 4: Configure and Use

```bash
# In .env
LIGHTRAG_KV_STORAGE=MyBackendKVStorage
MY_BACKEND_URL=http://my-backend:8080
```

Or in Python:
```python
rag = LightRAG(
    kv_storage="MyBackendKVStorage",
    working_dir="./storage"
)
```

### Critical: Workspace Isolation

Your backend must implement workspace isolation. Use `self.namespace` (available via the base class) as a prefix for all keys/collections:

```python
def _make_key(self, id: str) -> str:
    return f"{self.namespace}:{id}"
```

See `lightrag/kg/redis_impl.py` for a complete reference implementation with workspace isolation.

### Critical: Async Generator Lock Management

If your backend iterates over stored data and yields chunks, never hold a lock across a yield:

```python
# WRONG — deadlock risk:
async def get_all(self):
    async with self._lock:
        for k, v in self._data.items():
            yield k, v  # Lock still held!

# CORRECT — snapshot under lock, iterate outside:
async def get_all(self):
    async with self._lock:
        snapshot = list(self._data.items())
    for k, v in snapshot:  # Lock released
        yield k, v
```

---

## Adding an LLM Provider

LLM providers are async functions that accept a prompt and return a string.

### Step 1: Create the Provider File

```python
# lightrag/llm/my_provider.py

from lightrag.utils import logger

async def my_provider_complete(
    prompt: str,
    system_prompt: str | None = None,
    history_messages: list | None = None,
    keyword_extraction: bool = False,
    **kwargs
) -> str:
    """
    Call your LLM provider and return the completion text.

    Args:
        prompt: The user message
        system_prompt: Optional system message override
        history_messages: Previous turns in the conversation
        keyword_extraction: If True, structured JSON output is expected

    Returns:
        str: The model's text response
    """
    # Build your messages list
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if history_messages:
        messages.extend(history_messages)
    messages.append({"role": "user", "content": prompt})

    # Call your API
    response = await your_api_client.complete(messages=messages, **kwargs)
    return response.text
```

### Step 2: Add an Embedding Function (if needed)

```python
from lightrag.utils import wrap_embedding_func_with_attrs
import numpy as np

@wrap_embedding_func_with_attrs(embedding_dim=1024, max_token_size=8192)
async def my_provider_embed(texts: list[str]) -> np.ndarray:
    """Return (n_texts, embedding_dim) float32 array."""
    embeddings = await your_embedding_api(texts)
    return np.array(embeddings, dtype=np.float32)
```

The `@wrap_embedding_func_with_attrs` decorator is required — it adds the `embedding_dim` and `max_token_size` attributes that LightRAG reads.

**Important:** When wrapping an already-decorated function, use `.func` to access the underlying function:

```python
# WRONG — double-wrapping:
@wrap_embedding_func_with_attrs(embedding_dim=3072, max_token_size=8192)
async def my_embed(texts):
    return await openai_embed(texts)  # openai_embed is already wrapped!

# CORRECT — call the underlying function:
@wrap_embedding_func_with_attrs(embedding_dim=3072, max_token_size=8192)
async def my_embed(texts):
    return await openai_embed.func(texts)  # Access .func
```

### Step 3: Integrate with the API Server (optional)

To make your provider available via `LLM_BINDING=my_provider`, add binding options in `lightrag/llm/binding_options.py` and a case in `lightrag/api/lightrag_server.py` where LLM functions are selected based on `global_args.llm_binding`.

---

## Adding a New API Endpoint

### Step 1: Add to an Existing Router

If the endpoint belongs to an existing concern (query, documents, graph, config, evaluation), add it to the appropriate file in `lightrag/api/routers/`.

```python
# In lightrag/api/routers/query_routes.py

@router.get("/query/history")
async def get_query_history(
    auth=Depends(get_combined_auth_dependency(router))
) -> list[QueryHistoryItem]:
    """Return recent query history."""
    ...
```

### Step 2: Create a New Router (for a new concern)

```python
# lightrag/api/routers/my_routes.py

from fastapi import APIRouter, Depends
from lightrag.api.utils_api import get_combined_auth_dependency

router = APIRouter(tags=["my-feature"])

@router.get("/my-feature/status")
async def get_status(auth=Depends(get_combined_auth_dependency(router))):
    return {"status": "ok"}

def create_my_feature_routes(app, rag, auth_dependency):
    """Register routes with the FastAPI app."""
    @router.get("/my-feature/something")
    async def do_something(auth=Depends(auth_dependency)):
        # Use rag instance here
        result = await rag.some_operation()
        return result

    app.include_router(router, prefix="/my-feature")
```

### Step 3: Register in `lightrag_server.py`

```python
# In create_lightrag_app() or the lifespan
from lightrag.api.routers.my_routes import create_my_feature_routes
create_my_feature_routes(app, rag_instance, auth_dependency)
```

### Auth Dependency Pattern

All protected endpoints must use `get_combined_auth_dependency`:

```python
from lightrag.api.utils_api import get_combined_auth_dependency

@router.get("/protected")
async def protected_endpoint(auth=Depends(get_combined_auth_dependency(router))):
    # auth is None if no auth is configured
    ...
```

---

## Adding a WebUI Feature

### Step 1: Create a Feature Component

Add a new file in `lightrag_webui/src/features/`:

```tsx
// lightrag_webui/src/features/MyFeature.tsx

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function MyFeature() {
  const { t } = useTranslation()
  const [data, setData] = useState(null)

  useEffect(() => {
    // Fetch data from API
    fetch('/my-feature/status')
      .then(r => r.json())
      .then(setData)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('myFeature.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Your UI here */}
      </CardContent>
    </Card>
  )
}
```

### Step 2: Add i18n Strings

Add to both locale files:

```json
// lightrag_webui/src/locales/en.json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This feature does something useful."
  }
}

// lightrag_webui/src/locales/ro.json
{
  "myFeature": {
    "title": "Funcția Mea",
    "description": "Această funcție face ceva util."
  }
}
```

### Step 3: Add API Client Function

```typescript
// lightrag_webui/src/api/lightrag.ts

export type MyFeatureStatus = {
  status: string
}

export const getMyFeatureStatus = async (): Promise<MyFeatureStatus> => {
  const response = await apiClient.get('/my-feature/status')
  return response.data
}
```

### Step 4: Register the Route

```tsx
// lightrag_webui/src/AppRouter.tsx

import MyFeature from '@/features/MyFeature'

// Add inside your router:
<Route path="/my-feature" element={<MyFeature />} />
```

### Conventions

- Use `useTranslation()` for all user-facing strings
- Use `@/components/ui/` components for consistent styling
- Use Zustand stores for state that needs to persist across tab navigations
- Use `axios` (via the `apiClient`) for API calls, not raw `fetch`
- Use Bun for all package management: `bun add <package>` (never `npm` or `yarn`)

---

## Adding a New Chunking Strategy

```python
# lightrag/chunking.py — extend ChunkingMethod enum
class ChunkingMethod(str, Enum):
    TOKEN_SIZE = "TOKEN_SIZE"
    SEMANTIC = "SEMANTIC"
    HYBRID = "HYBRID"
    MY_STRATEGY = "MY_STRATEGY"  # Add here

# Implement the factory function
def create_my_strategy_chunking_func(
    embedding_func,
    my_param: float = 0.5
) -> Callable:
    """Return an async chunking function compatible with the chunking interface."""

    async def chunk(
        content: str,
        split_by_character: str | None = None,
        split_by_character_only: bool = False,
        chunk_token_size: int | None = None,
        chunk_overlap_token_size: int | None = None,
        tiktoken_model: str = "gpt-4o",
    ) -> list[dict]:
        """Return list of {tokens, content, chunk_order_index}."""
        # Your chunking logic here
        ...

    return chunk
```

Then register it in `lightrag/lightrag.py` where `ChunkingMethod` is handled.

---

## Adding Evaluation Metrics

RAGAS metrics are configured in `lightrag/evaluation/eval_rag_quality.py`. To add a custom metric:

```python
from ragas.metrics import faithfulness, answer_relevancy, context_recall, context_precision

# Add your custom metric to the metrics list:
METRICS = [
    faithfulness,
    answer_relevancy,
    context_recall,
    context_precision,
    # your_custom_metric,  # Add here
]
```

Custom RAGAS metrics must implement the RAGAS `Metric` interface. See the [RAGAS documentation](https://docs.ragas.io/) for details.

---

## Deployment Extension: Kubernetes

See the existing Kubernetes manifests in `k8s-deploy/` for a starting point. Key considerations when extending:

1. **Shared storage:** Multiple API server replicas must use external storage backends (PostgreSQL, Redis, Neo4j, Milvus) — not JSON/NetworkX file-based backends
2. **Workspace isolation:** Set `WORKSPACE` per deployment to isolate data
3. **Secret management:** Use Kubernetes Secrets for `LLM_BINDING_API_KEY`, `POSTGRES_PASSWORD`, etc.
4. **Liveness/readiness:** Use `GET /health` as the health check endpoint
