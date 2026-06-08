# LightRAG Named Entity Recognition (NER) & Entity Types Taxonomy Guide

## Complete Configuration and Customization Reference

**Version:** 1.0
**Last Updated:** February 16, 2026
**Applies to:** LightRAG Multimodal RAG System

---

# PART 1: STRATEGIC ANALYSIS

## Executive Assessment

LightRAG's NER system represents a **paradigm shift from traditional Named Entity Recognition** to LLM-based knowledge extraction. Unlike conventional NER systems that use pre-trained ML models with fixed categories (PERSON, ORG, LOC), LightRAG leverages the LLM itself to extract entities and relationships during document ingestion. This approach offers unprecedented flexibility for domain-specific customization but requires careful taxonomy design to maximize retrieval quality.

The entity types taxonomy functions as a **configurable ontology** that guides the LLM's extraction behavior. Well-designed taxonomies can dramatically improve retrieval performance for domain-specific applications like EU Cohesion Policy monitoring, while poorly designed taxonomies lead to inconsistent entity extraction and degraded query results.

## Architecture Scorecard

| Dimension | Score | Assessment |
|-----------|-------|------------|
| **Flexibility** | 9/10 | Fully configurable via env vars or code |
| **Domain Adaptation** | 9/10 | No retraining required, prompt-based |
| **Extraction Quality** | 8/10 | Dependent on LLM capability and taxonomy design |
| **Performance** | 6/10 | Slower than traditional NER (LLM calls per chunk) |
| **Consistency** | 7/10 | Requires well-defined types to avoid drift |
| **Multilingual Support** | 9/10 | Single LLM handles multiple languages |

## Risk Register

### 🔴 Critical Risks

1. **Re-indexing Requirement**: Changing entity types **requires complete re-ingestion** of all documents. The knowledge graph is built around extracted entities, and type changes invalidate existing extractions.

2. **Type Proliferation**: Too many entity types (>15) can confuse the LLM, leading to inconsistent categorization and missed entities.

### 🟡 Moderate Risks

1. **Semantic Overlap**: Entity types with overlapping definitions (e.g., "Programme" and "Project") cause inconsistent classification.

2. **Cost Implications**: Each document chunk requires an LLM call for entity extraction. Complex taxonomies may require more tokens per extraction.

3. **Fallback to "Other"**: If configured types don't cover document content, entities are classified as "Other", reducing retrieval precision.

### 🟢 Low Risks

1. **Configuration Errors**: JSON parsing errors in ENTITY_TYPES env var are caught at startup.

2. **Case Sensitivity**: Entity types are normalized to lowercase internally.

## Strategic Recommendations

### Quick Wins (This Week)
- [ ] Audit current entity extractions to identify classification gaps
- [ ] Review default types against your document corpus
- [ ] Create domain-specific taxonomy draft

### Short-term (This Month)
- [ ] Test new taxonomy on sample documents before full re-indexing
- [ ] Document taxonomy decisions for team alignment
- [ ] Establish entity type naming conventions

### Medium-term (This Quarter)
- [ ] Implement hierarchical type system if needed
- [ ] Create domain glossary for entity extraction guidance
- [ ] Develop evaluation metrics for extraction quality

---

# PART 2: TECHNICAL DOCUMENTATION

## 1. How NER Works in LightRAG

### 1.1 Overview

LightRAG uses **LLM-based entity extraction** as part of its document ingestion pipeline. When documents are inserted, they flow through the following stages:

```
┌─────────────┐    ┌──────────────┐    ┌────────────────────┐    ┌──────────────┐
│   Document  │───▶│   Chunking   │───▶│  LLM Entity        │───▶│  Knowledge   │
│   (PDF/txt) │    │  (800 tokens)│    │  Extraction        │    │  Graph       │
└─────────────┘    └──────────────┘    └────────────────────┘    └──────────────┘
                                              │
                                              ▼
                                   ┌─────────────────────┐
                                   │ For each chunk:      │
                                   │ • Entities extracted │
                                   │ • Relations extracted│
                                   │ • Embeddings created │
                                   │ • Graph updated      │
                                   └─────────────────────┘
```

### 1.2 Entity Extraction Process

The LLM receives a **system prompt** and **user prompt** containing:

1. **Entity Types List**: The configured taxonomy (e.g., `["Person", "Organization", "Event"]`)
2. **Chunk Content**: The text to analyze
3. **Extraction Instructions**: How to format output
4. **Examples**: Few-shot examples demonstrating expected output

**Source File:** `lightrag/prompt.py` (lines 11-100)

```python
# System prompt template (simplified)
PROMPTS["entity_extraction_system_prompt"] = """
You are a Knowledge Graph Specialist responsible for extracting entities
and relationships from the input text.

Entity Details:
- entity_name: The name of the entity (title case)
- entity_type: Categorize using: {entity_types}. Use "Other" if none apply.
- entity_description: Concise description based on the text.
"""
```

### 1.3 Extraction Output Format

For each chunk, the LLM outputs structured data:

```
entity<|#|>Joint Secretariat<|#|>organization<|#|>The Joint Secretariat manages...
entity<|#|>Romania<|#|>location<|#|>Romania is a member state participating in...
relation<|#|>Joint Secretariat<|#|>Romania<|#|>manages, coordination<|#|>The JS coordinates...
```

This is parsed into:
- **Entity nodes** stored in the knowledge graph
- **Relationship edges** connecting entities
- **Vector embeddings** for semantic search

### 1.4 Gleaning (Multi-pass Extraction)

LightRAG supports **entity extraction gleaning** - a second pass to catch missed entities:

**Configuration:** `ENTITY_EXTRACT_MAX_GLEANING` (default: 1)

```python
# In operate.py
if entity_extract_max_gleaning > 0:
    # Run continuation prompt to find missed entities
    continuation_result = await use_llm_func(
        entity_continue_extraction_user_prompt,
        history=history
    )
```

---

## 2. Default Entity Types

### 2.1 Built-in Taxonomy

**Source File:** `lightrag/constants.py` (lines 28-41)

```python
DEFAULT_ENTITY_TYPES = [
    "Person",        # Named individuals
    "Creature",      # Animals, fictional beings
    "Organization",  # Companies, institutions, agencies
    "Location",      # Geographic places
    "Event",         # Named events, conferences
    "Concept",       # Abstract ideas, theories
    "Method",        # Procedures, techniques
    "Content",       # Documents, publications
    "Data",          # Datasets, metrics
    "Artifact",      # Physical objects, products
    "NaturalObject", # Natural phenomena, elements
]
```

### 2.2 Type Descriptions and Use Cases

| Type | Description | Best For | Examples |
|------|-------------|----------|----------|
| **Person** | Named individuals | Biographies, news, HR | "John Smith", "CEO Maria Garcia" |
| **Creature** | Animals, beings | Biology, fantasy | "Tiger", "Dragon" |
| **Organization** | Institutions | Business, government | "European Commission", "Acme Corp" |
| **Location** | Places | Geography, logistics | "Tokyo", "Timiș County" |
| **Event** | Happenings | News, history | "World War II", "Annual Conference" |
| **Concept** | Ideas | Academic, policy | "Sustainability", "Cross-border cooperation" |
| **Method** | Procedures | Technical, scientific | "Agile methodology", "PCR testing" |
| **Content** | Media | Publishing, research | "Annual Report 2023", "User Manual" |
| **Data** | Information | Analytics, research | "GDP figures", "Survey results" |
| **Artifact** | Objects | Manufacturing, archaeology | "iPhone 15", "Clay tablet" |
| **NaturalObject** | Nature | Science, environment | "Danube River", "Solar eclipse" |

---

## 3. Customizing Entity Types for Domain-Specific Use

### 3.1 Why Customize?

The default taxonomy is **general-purpose**. Domain-specific applications benefit from:

1. **Better Precision**: Types matching your domain concepts
2. **Improved Recall**: Capturing entities the default types miss
3. **Cleaner Retrieval**: Reduced "Other" classifications
4. **Semantic Coherence**: Types that users naturally query

### 3.2 EU Cohesion Policy Example

For the World Bank Romania project analyzing EU structural funds documents:

```json
{
  "ENTITY_TYPES": [
    "Programme",
    "ManagingAuthority",
    "Beneficiary",
    "Project",
    "Indicator",
    "Budget",
    "Country",
    "Region",
    "Regulation",
    "Recommendation",
    "ThematicObjective",
    "Priority",
    "Document",
    "Event",
    "Organization",
    "Person"
  ]
}
```

### 3.3 Taxonomy Design Principles

#### Principle 1: Mutual Exclusivity
Types should not overlap semantically:
- ❌ Bad: "Programme" and "Project" (overlapping scope)
- ✅ Good: "Programme" (funding framework) vs "Project" (funded initiative)

#### Principle 2: Exhaustive Coverage
Types should cover all important entities in your corpus:
- Analyze sample documents to identify entity categories
- Include a catch-all type if needed (retain "Concept" or "Other")

#### Principle 3: Balanced Granularity
- Too broad: Entities grouped inappropriately
- Too narrow: Entity types unused, LLM confusion
- Aim for 8-15 types for most domains

#### Principle 4: Clear Definitions
Document each type's meaning for consistency:

```markdown
| Type | Definition | Includes | Excludes |
|------|------------|----------|----------|
| Programme | EU funding framework | Interreg, ERDF, ESF+ | Individual projects |
| Project | Funded initiative | Grant recipients | Programme-level activities |
```

### 3.4 Migration Strategy

When changing entity types on an existing system:

```
1. Export current documents list
2. Clear storage directories:
   - graph_chunk_entity_relation.graphml
   - vdb_entities.json
   - vdb_relationships.json
   - vdb_chunks.json
3. Update ENTITY_TYPES configuration
4. Re-ingest all documents
5. Verify extraction quality
```

**Warning:** This process can take hours for large document sets. Plan for maintenance window.

---

## 4. Configuration Options

### 4.1 Environment Variable Configuration

**File:** `.env`

```bash
### Entity types that the LLM will attempt to recognize
### Format: JSON array of strings
ENTITY_TYPES='["Programme", "ManagingAuthority", "Beneficiary", "Project", "Indicator", "Budget", "Country", "Region", "Regulation", "Recommendation", "Document", "Event", "Organization", "Person"]'
```

**Parsing:** The value is parsed as JSON. Ensure:
- Valid JSON array syntax
- Strings are double-quoted
- No trailing commas

### 4.2 Programmatic Configuration

**Direct instantiation:**

```python
from lightrag import LightRAG
from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed

# Custom entity types for Cohesion Policy domain
COHESION_POLICY_ENTITIES = [
    "Programme",
    "ManagingAuthority",
    "Beneficiary",
    "Project",
    "Indicator",
    "Budget",
    "Country",
    "Region",
    "Regulation",
    "Recommendation",
    "Document",
    "Event",
    "Organization",
    "Person"
]

rag = LightRAG(
    working_dir="./cohesion_policy_rag",
    llm_model_func=gpt_4o_mini_complete,
    embedding_func=openai_embed,
    addon_params={
        "language": "English",
        "entity_types": COHESION_POLICY_ENTITIES
    }
)

await rag.initialize_storages()
```

### 4.3 API Server Configuration

**File:** `lightrag/api/config.py`

```python
args.entity_types = get_env_value("ENTITY_TYPES", DEFAULT_ENTITY_TYPES, list)
```

The server passes entity types to LightRAG via `addon_params`:

```python
# In lightrag_server.py
rag = LightRAG(
    addon_params={
        "entity_types": args.entity_types,
    }
)
```

### 4.4 Configuration Precedence

1. **Constructor argument** (highest priority)
2. **Environment variable** (`ENTITY_TYPES`)
3. **Default value** (`DEFAULT_ENTITY_TYPES` in constants.py)

---

## 5. Impact on Retrieval Quality

### 5.1 How Entity Types Affect Queries

```
Query: "What is the JS satisfaction rate?"
         │
         ▼
┌─────────────────────────────┐
│ Keyword Extraction          │
│ • "JS" → maps to entities   │
│ • "satisfaction rate" →     │
│   maps to metrics           │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Entity Vector Search        │
│ • Find "Joint Secretariat"  │
│   (type: organization)      │
│ • Find "satisfaction survey"│
│   (type: indicator)         │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Graph Traversal             │
│ • JS → satisfaction survey  │
│ • Survey → 83% rate         │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Context Assembly            │
│ • Entity descriptions       │
│ • Related chunks            │
│ • Relationship context      │
└─────────────────────────────┘
```

### 5.2 RAGAS Evaluation Impact

From the RAGAS evaluation report (92.13% overall score):

| Metric | Score | Entity Type Contribution |
|--------|-------|--------------------------|
| **Context Recall** | 98.33% | Graph traversal finds related entities |
| **Faithfulness** | 94.75% | Entity descriptions provide grounded facts |
| **Answer Relevance** | 88.16% | Entity relationships guide focused answers |
| **Context Precision** | 87.26% | Type-based filtering reduces noise |

### 5.3 Quality Indicators

**Good taxonomy signs:**
- Low "Other" classification rate (<5%)
- Consistent entity naming across documents
- High retrieval precision for domain queries

**Problem signs:**
- Many entities classified as "Other"
- Same entity gets different types in different chunks
- Domain-specific queries return generic results

---

## 6. Best Practices for Taxonomy Design

### 6.1 Discovery Phase

Before designing your taxonomy:

1. **Sample Analysis**: Read 10-20 representative documents
2. **Entity Inventory**: List all important entity types found
3. **Relationship Mapping**: Note common entity relationships
4. **Query Anticipation**: Consider what users will ask

### 6.2 Design Guidelines

#### For Government/Policy Domains:

```json
["Agency", "Programme", "Regulation", "Policy", "Budget", "Beneficiary",
 "Indicator", "Report", "Country", "Region", "Official", "Event"]
```

#### For Technical/Software Domains:

```json
["Component", "API", "Service", "Database", "User", "Feature",
 "Bug", "Release", "Documentation", "Configuration"]
```

#### For Healthcare Domains:

```json
["Patient", "Condition", "Treatment", "Medication", "Provider",
 "Facility", "Procedure", "Diagnosis", "Test", "Outcome"]
```

#### For Financial Domains:

```json
["Company", "Security", "Index", "Indicator", "Transaction",
 "Account", "Regulation", "Report", "Person", "Market"]
```

### 6.3 Testing Your Taxonomy

Before full deployment:

```python
# Test extraction on sample documents
test_docs = [
    "Sample document 1...",
    "Sample document 2...",
]

for doc in test_docs:
    await rag.ainsert(doc)

# Query and inspect extracted entities
entities = await rag.get_entities()
for entity in entities:
    print(f"{entity['name']}: {entity['type']}")

# Check for:
# - Appropriate type assignments
# - Low "Other" rate
# - Consistent naming
```

### 6.4 Documentation Template

Create a taxonomy reference for your team:

```markdown
# [Domain] Entity Taxonomy v1.0

## Entity Types

### Programme
- **Definition:** EU funding framework or scheme
- **Examples:** Interreg-IPA CBC, ERDF, ESF+
- **Distinguishing Features:** Has budget allocation, multi-year period
- **Related Types:** Project (child), ManagingAuthority (manages)

### Project
- **Definition:** Individual funded initiative
- **Examples:** Cross-border tourism project, SME digitalization grant
- **Distinguishing Features:** Has beneficiary, deliverables, timeline
- **Related Types:** Programme (parent), Beneficiary (receives)

[Continue for all types...]
```

---

## 7. Re-indexing Requirements

### 7.1 When Re-indexing is Required

| Change | Re-indexing Needed? |
|--------|---------------------|
| Add new entity type | Yes |
| Remove entity type | Yes |
| Rename entity type | Yes |
| Change type definitions | Yes |
| Change TOP_K parameters | No |
| Change embedding model | Yes |
| Change LLM model | Recommended |
| Change chunk size | Yes |

### 7.2 Re-indexing Process

#### Step 1: Backup Current State

```bash
# Backup working directory
cp -r ./rag_storage ./rag_storage_backup_$(date +%Y%m%d)
```

#### Step 2: Clear Storage

```bash
# Remove graph and vector stores
rm -rf ./rag_storage/graph_chunk_entity_relation.graphml
rm -rf ./rag_storage/vdb_*.json
rm -rf ./rag_storage/kv_*.json

# Keep LLM cache if using same model (optional)
# rm -rf ./rag_storage/kv_store_llm_response_cache.json
```

#### Step 3: Update Configuration

```bash
# Update .env with new entity types
ENTITY_TYPES='["Programme", "ManagingAuthority", ...]'
```

#### Step 4: Re-ingest Documents

```python
import asyncio
from lightrag import LightRAG

async def reindex():
    rag = LightRAG(working_dir="./rag_storage")
    await rag.initialize_storages()

    # Re-ingest all documents
    for doc_path in document_paths:
        with open(doc_path, 'r') as f:
            content = f.read()
        await rag.ainsert(content, file_paths=[doc_path])

    await rag.finalize_storages()

asyncio.run(reindex())
```

#### Step 5: Validate

```python
# Run test queries
test_queries = [
    "What programmes are mentioned?",
    "List all beneficiaries",
    "What are the main recommendations?"
]

for query in test_queries:
    result = await rag.aquery(query)
    print(f"Q: {query}")
    print(f"A: {result[:200]}...")
```

### 7.3 Estimating Re-indexing Time

| Document Count | Chunk Size | Estimated Time |
|----------------|------------|----------------|
| 10 docs | 800 tokens | ~5 minutes |
| 100 docs | 800 tokens | ~45 minutes |
| 1,000 docs | 800 tokens | ~8 hours |
| 10,000 docs | 800 tokens | ~3 days |

Factors affecting time:
- LLM API rate limits
- `MAX_PARALLEL_INSERT` setting
- Network latency
- Document complexity

---

## Appendix A: Complete Configuration Reference

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENTITY_TYPES` | JSON array | See constants.py | Entity types for extraction |
| `SUMMARY_LANGUAGE` | string | "English" | Output language |
| `ENTITY_EXTRACT_MAX_GLEANING` | int | 1 | Additional extraction passes |
| `CHUNK_SIZE` | int | 1200 | Document chunk size |
| `MAX_EXTRACT_INPUT_TOKENS` | int | 20480 | Max tokens for extraction |

### Code References

| File | Purpose |
|------|---------|
| `lightrag/constants.py` | Default entity types definition |
| `lightrag/prompt.py` | Extraction prompt templates |
| `lightrag/operate.py` | Entity extraction logic |
| `lightrag/lightrag.py` | LightRAG configuration |
| `lightrag/api/config.py` | API server configuration |

---

## Appendix B: Troubleshooting

### Problem: High "Other" Classification Rate

**Symptoms:** Many entities classified as "Other" instead of specific types.

**Solutions:**
1. Add missing entity types to taxonomy
2. Provide clearer type definitions in documentation
3. Consider more specific types for your domain

### Problem: Inconsistent Entity Naming

**Symptoms:** Same entity appears with different names (e.g., "JS", "Joint Secretariat", "the Secretariat").

**Solutions:**
1. LightRAG handles some normalization automatically
2. Consider preprocessing documents to standardize abbreviations
3. Use the entity summary feature for consolidation

### Problem: Missing Relationships

**Symptoms:** Entities extracted but relationships not captured.

**Solutions:**
1. Increase `ENTITY_EXTRACT_MAX_GLEANING` to 2+
2. Reduce `CHUNK_SIZE` for more focused extraction
3. Review documents for implicit vs. explicit relationships

### Problem: Slow Extraction

**Symptoms:** Document ingestion takes too long.

**Solutions:**
1. Increase `MAX_PARALLEL_INSERT` (max 10)
2. Reduce `ENTITY_EXTRACT_MAX_GLEANING` to 0
3. Simplify taxonomy to reduce token usage

---

*Documentation generated by Athena - Strategic Analysis & Documentation Agent*
*LightRAG Multimodal RAG System - World Bank Romania Project*
