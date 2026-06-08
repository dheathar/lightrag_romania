# ADR-009: `<SEP>` as Field Separator for Multi-Value Graph Fields

## Status
Accepted

## Date
2024-01

## Context

Graph storage backends (particularly file-based and some relational backends) need to store multiple values in a single field for:
- `source_ids`: the list of chunk IDs that contributed to an entity or relation
- `description`: multiple description fragments before LLM summary
- `file_path`: source document paths
- Relation `id`: source entity + target entity composite key

Options for multi-value storage:
1. Native arrays (JSON arrays in the field value)
2. Custom string delimiter
3. Separate junction tables/collections

## Decision

Use `"<SEP>"` (the literal string `<SEP>`) as a delimiter for all multi-value fields in the graph layer. This is stored as the constant `GRAPH_FIELD_SEP = "<SEP>"` in `lightrag/constants.py`.

Concatenation: `value = "<SEP>".join([val1, val2, val3])`
Splitting: `values = value.split("<SEP>")`

This applies uniformly across all graph storage backends, including Neo4j, NetworkX, and PostgreSQL.

## Consequences

### Positive
- Simple, readable representation when inspecting storage directly
- No JSON parsing overhead
- Consistent across all storage backends
- Easy to implement in any language (no special parsing library needed)

### Negative
- Cannot be changed after any data has been inserted — a migration would require reading every node and edge, splitting, re-joining, and re-writing
- Entity or relation descriptions that contain `<SEP>` literally would cause corruption (extremely unlikely in practice)
- Array semantics are not natively supported — range queries, indexing, and set operations on individual values require full field scan

### Invariant

The `GRAPH_FIELD_SEP` value is a system-level constant that must never change after deployment. It is documented as an invariant in [Business Rules](../data/BUSINESS_RULES.md).

### Risks
- **Content collision** — `<SEP>` appearing in entity descriptions. Mitigated by the extreme unlikelihood of this string appearing in natural language text.

## Alternatives Considered

1. **JSON arrays** — Rejected: parsing overhead on every read; not natively supported by all graph backends
2. **Pipe `|` separator** — Rejected: pipe may appear in entity descriptions or keywords
3. **Null byte `\x00` separator** — Rejected: not human-readable when inspecting storage directly
4. **Separate junction tables** — Rejected: significant schema complexity for all four storage types; the current approach keeps schemas simple

## References
- `lightrag/constants.py:GRAPH_FIELD_SEP`
- `lightrag/operate.py` — `split_string_by_multi_markers()` usage
- `lightrag/utils.py` — `split_string_by_multi_markers()`
