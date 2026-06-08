# Code Patterns and Conventions

## Python Patterns

### Async-First

Everything in LightRAG core is async. Never use synchronous I/O in a coroutine that holds a lock or semaphore.

```python
# Correct
async def get_document(self, doc_id: str) -> Optional[dict]:
    async with self._connection_pool.acquire() as conn:
        return await conn.fetchrow("SELECT * FROM docs WHERE id=$1", doc_id)

# Wrong — blocks the event loop
def get_document(self, doc_id: str) -> Optional[dict]:
    return requests.get(f"/docs/{doc_id}").json()
```

### Always Await Before Calling Methods on Coroutines

```python
# Wrong — calls method on a coroutine object
cursor = self._collection.list_indexes()
result = cursor.to_list()

# Correct
cursor = await self._collection.list_indexes()
result = await cursor.to_list()
```

### Dataclass Initialization Pattern

`LightRAG` and all storage backends are `@dataclass` classes. Use `field()` for mutable defaults and `__post_init__` for initialization logic:

```python
@dataclass
class MyStorage(BaseKVStorage):
    _data: dict = field(default_factory=dict)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def __post_init__(self):
        # Don't open connections here — use initialize()
        super().__post_init__()

    async def initialize(self):
        # Open connections here — called by LightRAG.initialize_storages()
        self._connection = await create_connection()
```

### EmbeddingFunc Decorator

All embedding functions must be decorated with `@wrap_embedding_func_with_attrs` to attach dimension metadata:

```python
from lightrag.utils import wrap_embedding_func_with_attrs
import numpy as np

@wrap_embedding_func_with_attrs(embedding_dim=1536, max_token_size=8192)
async def my_embed(texts: list[str]) -> np.ndarray:
    # Must return shape (len(texts), embedding_dim) as float32
    result = await my_embedding_api(texts)
    return np.array(result, dtype=np.float32)
```

### Logging Convention

Use `lightrag.utils.logger` (a standard Python `logging.Logger`), not `print`:

```python
from lightrag.utils import logger

logger.info("Starting document ingestion for %s", file_path)
logger.warning("Vision description failed for image %d: %s", i, error)
logger.debug("Chunk %d has %d tokens", chunk_idx, token_count)
```

### ID Computation

```python
from lightrag.utils import compute_mdhash_id

# Content-addressable ID (deterministic for same input)
doc_id = compute_mdhash_id(document_text)

# Chunk ID (unique per position)
chunk_id = compute_mdhash_id(chunk_content + str(chunk_order_index))
```

### Retry Pattern

Use `tenacity` for LLM API calls:

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    retry=retry_if_exception_type((RateLimitError, APIConnectionError)),
)
async def call_llm_with_retry(prompt: str) -> str:
    return await my_llm_api(prompt)
```

### Cache Pattern

LLM response caching is built in. To cache an LLM call:

```python
from lightrag.utils import handle_cache, save_to_cache, compute_args_hash, CacheData

# Compute cache key
cache_key = compute_args_hash(model_name, prompt_messages)

# Check cache
cached = await handle_cache(kv_storage, cache_key, namespace)
if cached:
    return cached

# Call LLM
result = await call_llm(prompt_messages)

# Save to cache
await save_to_cache(kv_storage, CacheData(args_hash=cache_key, return_value=result), namespace)

return result
```

### Sorted Lock Keys

Always sort entity pairs when generating lock keys:

```python
# Correct — prevents deadlock from concurrent A→B and B→A
a, b = "Entity A", "Entity B"
lock_key = "-".join(sorted([a, b]))

# Wrong — different keys for same edge in different directions
lock_key = f"{a}-{b}"  # Different from f"{b}-{a}"
```

## TypeScript/React Patterns

### Functional Components with Hooks

```tsx
// Correct
export default function MyComponent({ title }: { title: string }) {
  const [count, setCount] = useState(0)

  return <div>{title}: {count}</div>
}

// Avoid class components
```

### useTranslation for All Strings

```tsx
import { useTranslation } from 'react-i18next'

export default function MyPanel() {
  const { t } = useTranslation()

  return <h1>{t('myPanel.title')}</h1>
}
```

Never hardcode English strings in JSX. Add to both `en.json` and `ro.json`.

### Zustand Store Pattern

State that must persist across tab navigation goes in a Zustand store:

```typescript
// stores/myFeature.ts
import { create } from 'zustand'

interface MyFeatureState {
  data: MyData | null
  isLoading: boolean
  setData: (data: MyData) => void
  setLoading: (loading: boolean) => void
}

export const useMyFeatureStore = create<MyFeatureState>((set) => ({
  data: null,
  isLoading: false,
  setData: (data) => set({ data }),
  setLoading: (isLoading) => set({ isLoading }),
}))
```

Local component state (ephemeral UI state) stays in `useState`.

### API Client Pattern

Use the `apiClient` (Axios instance) configured in `lightrag_webui/src/api/lightrag.ts`:

```typescript
// Add to lightrag_webui/src/api/lightrag.ts
export const getMyData = async (params: MyParams): Promise<MyData> => {
  const response = await apiClient.get('/my-feature/data', { params })
  return response.data
}
```

The `apiClient` automatically attaches auth tokens and handles 401 redirects to login.

### shadcn/ui Component Conventions

Use existing `@/components/ui/` components for consistency:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
```

Do not use raw HTML elements for these primitives — always use the UI library components.

### Tab Visibility Pattern

For panels that poll the API, use the `useTabVisibility` hook to pause polling when the tab is hidden:

```tsx
import { useTabVisibility } from '@/contexts/useTabVisibility'

export default function PollingPanel() {
  const isVisible = useTabVisibility()

  useEffect(() => {
    if (!isVisible) return
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [isVisible])
}
```

### Bun for All Package Operations

```bash
# Install a new package
bun add lucide-react

# Add a dev dependency
bun add -d @types/something

# Never use npm or yarn
```

## File Naming Conventions

### Python

| Type | Convention | Example |
|------|-----------|---------|
| Storage implementation | `{name}_impl.py` | `redis_impl.py` |
| LLM provider | `{provider}.py` | `openai.py`, `ollama.py` |
| Route file | `{concern}_routes.py` | `document_routes.py` |
| Test file | `test_{feature}.py` | `test_chunking.py` |
| Utility | `utils_{concern}.py` | `utils_api.py`, `utils_vision.py` |

### TypeScript

| Type | Convention | Example |
|------|-----------|---------|
| Page/feature component | `PascalCase.tsx` | `GraphViewer.tsx` |
| UI component | `PascalCase.tsx` | `Button.tsx`, `Card.tsx` |
| Store | `camelCase.ts` | `graph.ts`, `settings.ts` |
| API types file | `camelCase.ts` | `lightrag.ts` |

## Configuration Pattern

Environment variables are the primary configuration mechanism. CLI arguments (via `argparse` in `config.py`) provide the same options for server startup but fall back to env vars via `get_env_value()`:

```python
from lightrag.utils import get_env_value

# Pattern: get from env, with type coercion and default
value = get_env_value("MY_SETTING", default_value, int)  # int, float, bool, str
```

All environment variables are documented in [Configuration Reference](../operations/CONFIGURATION.md).

## Test Patterns

### Test Structure

```python
# tests/test_my_feature.py
import pytest
from unittest.mock import AsyncMock, MagicMock

@pytest.mark.asyncio
async def test_my_feature_success():
    """Test that my feature returns correct result for valid input."""
    mock_storage = AsyncMock()
    mock_storage.get.return_value = {"key": "value"}

    result = await my_function(storage=mock_storage)

    assert result == expected_result
    mock_storage.get.assert_called_once_with("expected_key")
```

### Markers

```python
@pytest.mark.offline   # No external services required (default, always run)
@pytest.mark.integration  # Requires external services (only with --run-integration)
@pytest.mark.requires_db  # Requires specific DB
```

### Running Tests

```bash
# Fast: offline tests only (~3s)
python -m pytest tests

# Full: including integration tests
python -m pytest tests --run-integration

# Specific file
python -m pytest tests/test_chunking.py -v
```
