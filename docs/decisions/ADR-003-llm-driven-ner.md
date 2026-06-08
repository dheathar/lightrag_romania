# ADR-003: LLM-Driven Entity Extraction over Traditional NER

## Status
Accepted

## Date
2024-02

## Context

Building the knowledge graph requires extracting named entities and their relationships from document text. Two approaches are available:

1. **Traditional NER:** Pre-trained ML models (spaCy, BERT-based) identify fixed entity types (PERSON, ORG, LOC, DATE, etc.) using token classification
2. **LLM-driven extraction:** Prompt an LLM to extract entities and relationships according to a configurable taxonomy

The use case — EU structural funds documents in Romanian and English, with specialized entity types like FundingProgramme, BeneficiaryOrganization, and ImplementationBody — is poorly served by standard NER models.

## Decision

Use the LLM already required for answer generation to also perform entity extraction. Pass each text chunk to the LLM with a structured prompt (`entity_extraction_system_prompt` in `lightrag/prompt.py`) that:

1. Instructs the LLM to identify entities from a configurable taxonomy (`ENTITY_TYPES`)
2. Instructs the LLM to identify binary relationships between entities
3. Returns structured output using custom delimiters (`<|#|>` for fields, `<|COMPLETE|>` as end signal)

The `json_repair` library handles malformed output from weaker models.

Entity types are fully configurable via `ENTITY_TYPES` environment variable — no model retraining required to add domain-specific types.

## Consequences

### Positive
- Zero retraining or labeled data required
- Entity types are a configuration change, not a model change
- Works in any language the LLM supports (including Romanian)
- Can extract complex relationships, not just entity spans
- Handles domain-specific terminology naturally

### Negative
- Slower than traditional NER (one LLM call per chunk vs. local model inference)
- More expensive (LLM API costs per document chunk)
- Quality depends on LLM capability (stronger models extract better entities)
- Non-deterministic (same chunk may yield different entities on different runs)

### Risks
- **Type proliferation confusion** — too many entity types (>15) confuse the LLM, leading to inconsistent classification. See NER Entity Types Guide.
- **Re-indexing requirement** — changing entity types requires full document re-ingestion. Document in business rules to prevent accidental type changes.
- **LLM extraction drift** — different LLMs may interpret the same type differently. Mitigate with clear type descriptions in the prompt.

## Alternatives Considered

1. **spaCy NER** — Rejected: fixed to standard types, no relationship extraction, requires training for domain-specific types
2. **Fine-tuned BERT NER** — Rejected: requires labeled training data for each domain adaptation, doesn't extract relationships
3. **Regex + heuristics** — Rejected: fragile, domain-specific, not maintainable
4. **Hybrid: traditional NER + LLM for relations** — Rejected: adds complexity without sufficient benefit given the LLM is already required

## References
- `lightrag/prompt.py` — `entity_extraction_system_prompt`
- `lightrag/constants.py` — `DEFAULT_ENTITY_TYPES`
- `docs/NER_ENTITY_TYPES_GUIDE.md` — full taxonomy guide
- `lightrag/operate.py` — `extract_entities()` implementation
