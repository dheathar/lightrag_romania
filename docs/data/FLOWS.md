# Data Flows

## Document Ingestion Flow

This is the primary write path. Every document uploaded through the WebUI, REST API, or input directory scan goes through this flow.

```mermaid
flowchart TD
    subgraph Input
        A1[File upload via WebUI]
        A2[POST /documents/upload]
        A3[POST /documents/text]
        A4[POST /documents/url]
        A5[Input dir scan]
    end

    subgraph Queueing
        B1{File type<br/>supported?}
        B2[Compute content MD5 hash]
        B3{Already<br/>indexed?}
        B4[Mark DUPLICATED]
        B5[Enqueue in<br/>background task]
        B6[Mark PENDING]
    end

    subgraph Extraction ["Extraction (background)"]
        C1[Mark PROCESSING]
        C2{Engine?}
        C3["pypdf extraction<br/>(DEFAULT)"]
        C4["IBM Docling extraction<br/>(DOCLING)"]
        C5{Vision<br/>enabled?}
        C6["Vision LLM:<br/>describe each figure<br/>→ inject description<br/>inline as text"]
        C7[Full document text assembled]
    end

    subgraph Chunking
        D1{Chunking method?}
        D2[TOKEN_SIZE:<br/>sliding window<br/>1200 tokens, 100 overlap]
        D3[SEMANTIC:<br/>embed sentences,<br/>find breakpoints<br/>by cosine percentile]
        D4[HYBRID:<br/>token window +<br/>semantic validation]
        D5[Chunks list]
    end

    subgraph "Per-Chunk Processing (parallel, MAX_PARALLEL_INSERT)"
        E1[LLM: extract entities<br/>and relations<br/>from chunk]
        E2[Embed chunk text<br/>for vector search]
        E3[Embed entity<br/>names+descriptions]
        E4[Embed relation<br/>keywords+descriptions]
    end

    subgraph Storage
        F1[KV: store chunk text]
        F2[Vector: upsert chunk embedding]
        F3[Graph: merge entity nodes<br/>and relation edges]
        F4[Vector: upsert entity embeddings]
        F5[Vector: upsert relation embeddings]
        F6[LLM summary triggered<br/>if description count ><br/>FORCE_LLM_SUMMARY_ON_MERGE]
        F7[Mark DONE]
        F8[Mark FAILED + error]
    end

    A1 & A2 & A3 & A4 & A5 --> B1
    B1 -->|No| B8[Return 400 unsupported]
    B1 -->|Yes| B2
    B2 --> B3
    B3 -->|Yes| B4
    B3 -->|No| B5 --> B6

    B6 --> C1
    C1 --> C2
    C2 -->|DEFAULT| C3 --> C7
    C2 -->|DOCLING| C4
    C4 --> C5
    C5 -->|No| C7
    C5 -->|Yes| C6 --> C7

    C7 --> D1
    D1 --> D2 & D3 & D4
    D2 & D3 & D4 --> D5

    D5 --> E1 & E2

    E1 --> E3 & E4
    E2 --> F1 & F2
    E3 --> F4
    E4 --> F5
    E1 --> F3
    F3 --> F6

    F1 & F2 & F3 & F4 & F5 --> F7
    F7 -.->|error during any step| F8
```

## Query Flow (mix mode)

The recommended `mix` mode combines graph-traversal retrieval with pure vector retrieval, then optionally reranks the combined context.

```mermaid
flowchart TD
    subgraph Input
        Q[User query text]
        P["QueryParam:<br/>mode=mix, top_k=40,<br/>chunk_top_k=20, etc."]
    end

    subgraph "Keyword Extraction (LLM)"
        KW1[LLM: extract high-level keywords<br/>and low-level keywords]
        KW2[hl_keywords: broad themes]
        KW3[ll_keywords: specific terms]
    end

    subgraph "Embedding"
        EM1[Embed hl_keywords]
        EM2[Embed ll_keywords]
        EM3[Embed raw query]
    end

    subgraph "Local Arm (entity neighborhood)"
        LA1["Vector: top-K entities<br/>by ll_embedding similarity<br/>(cosine >= threshold)"]
        LA2["Graph: get all relations<br/>for these entities"]
        LA3["KV/Vector: get chunks for<br/>relations (VECTOR or WEIGHT method)"]
        LA4[Local context assembled]
    end

    subgraph "Global Arm (community/relation)"
        GA1["Vector: top-K relations<br/>by hl_embedding similarity"]
        GA2["Graph: get entities<br/>for these relations"]
        GA3["KV/Vector: get chunks<br/>for entities"]
        GA4[Global context assembled]
    end

    subgraph "Naive Arm (vector chunks)"
        NA1["Vector: top chunk_top_k chunks<br/>by raw query embedding"]
        NA2[Chunk context assembled]
    end

    subgraph "Context Assembly"
        CA1["Merge: entity tokens<br/>(capped at max_entity_tokens)"]
        CA2["Merge: relation tokens<br/>(capped at max_relation_tokens)"]
        CA3["Merge: chunk tokens<br/>(fills remaining budget)"]
        CA4{Reranker<br/>enabled?}
        CA5["Reranker scores each chunk<br/>against query<br/>(Cohere/Jina/Aliyun)"]
        CA6["Drop chunks below<br/>MIN_RERANK_SCORE"]
        CA7[Final context]
    end

    subgraph "Answer Generation"
        AG1[LLM: generate answer<br/>from context + query]
        AG2[Stream or complete response]
        AG3[Attach source references]
    end

    Q --> KW1
    P --> KW1
    KW1 --> KW2 & KW3
    KW2 --> EM1
    KW3 --> EM2
    Q --> EM3

    EM2 --> LA1
    LA1 --> LA2 --> LA3 --> LA4

    EM1 --> GA1
    GA1 --> GA2 --> GA3 --> GA4

    EM3 --> NA1 --> NA2

    LA4 --> CA1
    GA4 --> CA2
    NA2 --> CA3
    CA1 & CA2 & CA3 --> CA4
    CA4 -->|Yes| CA5 --> CA6 --> CA7
    CA4 -->|No| CA7

    CA7 --> AG1 --> AG2 --> AG3
```

## Retrieval Mode Comparison

| Aspect | naive | local | global | hybrid | mix |
|--------|-------|-------|--------|--------|-----|
| Primary source | Vector chunks | Entity neighborhoods | Relation summaries | local + global | KG + vector |
| Best for | Specific factual recall | Entity-centric questions | Theme/summary questions | Balanced | General purpose (recommended) |
| KG traversal | No | Yes | Yes | Yes | Yes |
| Vector search | Yes (chunks) | Yes (entities) | Yes (relations) | Yes (both) | Yes (all three) |
| Reranker benefit | High | Medium | Medium | High | Highest |
| Token consumption | Low | Medium | Medium | High | Highest |

## Graph Rebuild Flow

When documents are added but the graph becomes inconsistent (e.g., after a storage backend switch), the full graph can be rebuilt from stored chunks.

```mermaid
flowchart LR
    A[POST /graphs/rebuild] --> B[LightRAG.arebuild_graph]
    B --> C[Load all chunks from KV storage]
    C --> D["For each chunk:<br/>re-run entity extraction"]
    D --> E[Merge into fresh graph]
    E --> F[Regenerate entity embeddings]
    F --> G[Regenerate relation embeddings]
    G --> H[Graph rebuild complete]
```

This is an expensive operation (N LLM calls where N = chunk count). Only use when necessary.

## Vision Pipeline Data Flow

When `DOCUMENT_LOADING_ENGINE=DOCLING` and `VISION_ENABLED=true`:

```mermaid
flowchart TD
    A[PDF uploaded] --> B[Docling parses PDF]
    B --> C[Docling extracts text blocks]
    B --> D["Docling detects figures/tables<br/>(up to MAX_FIGURES_PER_DOC)"]
    D --> E[Convert figure to PNG<br/>at DOCLING_IMAGES_SCALE resolution]
    E --> F[PIL image → base64 PNG]
    F --> G["Vision LLM API call:<br/>describe_image_with_vision()"]
    G --> H[Text description returned]
    H --> I["Inject description inline<br/>into document text at figure position"]
    I --> J[Normal chunking continues<br/>with enriched text]

    B --> K{Garbled text detected?<br/>(GLYPH markers)}
    K -->|Yes| L["Tier 1: force_full_page_ocr<br/>(local, free)"]
    L --> M{Still garbled?}
    M -->|Yes| N["Tier 2: Vision LLM OCR<br/>(requires VISION_ENABLED)"]
    M -->|No| J
    N --> J
    K -->|No| J
```

## Evaluation Data Flow

```mermaid
flowchart TD
    A["POST /evaluation/run<br/>{test_cases} or dataset_filename"] --> B[Capture pipeline_config snapshot]
    B --> C[Start background task]
    C --> D["For each test case:<br/>POST /query {question, mode=mix}"]
    D --> E["LightRAG retrieves contexts<br/>and generates answer"]
    E --> F[Collect: question, answer, contexts, ground_truth]
    F --> G["RAGAS evaluate:<br/>faithfulness, answer_relevance,<br/>context_recall, context_precision"]
    G --> H[Accumulate scores]
    H --> I["Save results_YYYYMMDD_HHMMSS.json<br/>with pipeline_config embedded"]
    I --> J["WebUI polls GET /evaluation/status/{id}<br/>until status=completed"]
    J --> K["GET /evaluation/results/{filename}<br/>for detailed breakdown"]
```

## LLM Cache Flow

The LLM response cache (`KV_STORE_LLM_RESPONSE_CACHE`) reduces API costs during repeated extractions of similar content.

```mermaid
flowchart LR
    A[LLM request with<br/>model + messages] --> B[Compute hash of<br/>model + messages]
    B --> C{Cache hit?}
    C -->|Yes| D[Return cached response]
    C -->|No| E[Call LLM API]
    E --> F[Store response in cache]
    F --> G[Return response]
```

Cache can be kept when switching embedding models (since it caches LLM responses, not embeddings). Cache is separate for extraction (`ENABLE_LLM_CACHE_FOR_EXTRACT`) and query (`ENABLE_LLM_CACHE`).
