# ADR-008: Workspace-Based Multi-Tenant Isolation

## Status
Accepted

## Date
2024-04

## Context

A single DocForge deployment may need to serve multiple isolated knowledge bases:
- Different document collections (e.g., project documents vs. regulatory documents)
- Different client organizations using a shared infrastructure
- Development/staging/production environments sharing the same storage backend

Different storage backends implement isolation differently:
- File-based: naturally isolated by directory structure
- Collection-based (Milvus, Qdrant): collections can be prefixed
- Relational (PostgreSQL): requires schema-level or row-level isolation
- Graph (Neo4j): requires label prefixing

## Decision

Implement a `workspace` parameter that:
1. Accepts a string of `[a-zA-Z0-9_]` characters
2. Is applied as a prefix/suffix/column value in each storage backend's isolation mechanism
3. Defaults to empty string (no isolation) for backward compatibility

Each storage backend implements workspace isolation in the most natural way for its technology:

| Backend | Isolation Method |
|---------|----------------|
| File-based | Subdirectory `{working_dir}/{workspace}/` |
| NetworkX / NanoVDB | Subdirectory |
| PostgreSQL | `workspace` column filter on all queries |
| Neo4j | Node label prefix |
| Redis | Key prefix `{workspace}:` |
| Milvus / Qdrant | Collection name prefix |
| MongoDB | Database name prefix |

The workspace is configurable via `WORKSPACE` env var or LightRAG constructor `workspace` parameter. Each backend also accepts a backend-specific override (`POSTGRES_WORKSPACE`, `NEO4J_WORKSPACE`, etc.) for legacy compatibility, though this is discouraged in favor of the unified `WORKSPACE` setting.

## Consequences

### Positive
- Multiple knowledge bases can share the same storage infrastructure
- Development and production can share infrastructure with different workspaces
- Clean separation — deleting a workspace requires only deleting/dropping namespaced data
- No schema migration needed for new workspaces

### Negative
- Added complexity in every storage backend implementation
- Backend-specific workspace overrides create potential for configuration confusion
- Cross-workspace queries are not supported (by design)

### Risks
- **Workspace collisions** — two instances using the same workspace name on the same storage will share data. Mitigated by documentation and naming conventions.
- **Character set restriction** — workspace names must be valid identifiers in all backend systems. The `[a-zA-Z0-9_]` restriction ensures compatibility across Neo4j labels, PostgreSQL identifiers, and Redis key prefixes.

## Alternatives Considered

1. **Separate database instances per tenant** — Rejected: operationally expensive for many tenants
2. **Schema-based isolation (PostgreSQL schemas)** — Considered but rejected because it only helps PostgreSQL, not the other backends
3. **No multi-tenancy** — Rejected: the use case clearly requires isolated knowledge bases

## References
- `lightrag/kg/shared_storage.py` — `get_default_workspace()`, `set_default_workspace()`
- `lightrag/namespace.py` — `NameSpace` enum
- `env.example` — `WORKSPACE` variable and backend-specific workspace overrides
