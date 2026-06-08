# ADR-002: Pluggable Storage Backends via Abstract Base Classes

## Status
Accepted

## Date
2024-01

## Context

Different deployment environments have radically different storage requirements:

- **Development:** Developers need to get started in minutes with no external services. File-based storage is ideal.
- **Single-server production:** A small team may prefer PostgreSQL as a single backend for everything.
- **High-scale production:** A platform serving many users needs specialized stores — Neo4j for graph traversal, Milvus for billion-scale vector search, Redis for low-latency caching.

Hardcoding a single storage backend would make the system either require complex infrastructure for development or perform poorly at scale.

## Decision

Define four abstract base classes in `lightrag/base.py`:
- `BaseKVStorage` — key-value pairs
- `BaseVectorStorage` — dense vector similarity search
- `BaseGraphStorage` — entity-relation graph
- `DocStatusStorage` — document processing state

Each abstract class defines a minimal async interface. Concrete implementations live in `lightrag/kg/` and are selected at runtime via `LIGHTRAG_*_STORAGE` environment variables.

A registry (`STORAGES` dict in `lightrag/kg/__init__.py`) maps storage class names to their import paths, allowing new backends to be registered by adding a single line to the registry.

## Consequences

### Positive
- Development setup requires no external services (default JSON/NetworkX/NanoVDB backends)
- Production deployments can select optimal backends per storage type
- New backends can be added without modifying existing code
- Testing can use in-memory or file-based backends
- Different tenants can use different backends via workspace isolation

### Negative
- Increased complexity: four separate concerns to configure
- Backend selection requires understanding the trade-offs (see Deployment Guide)
- Some features may not be supported by all backends (e.g., full-text search in graph storage)

### Risks
- **Interface drift** — a new storage feature may be needed that isn't in the abstract interface. Mitigated by keeping the interface minimal and using `kwargs` for backend-specific options.
- **Backup complexity** — backing up four separate storage backends requires a coordinated strategy

## Alternatives Considered

1. **Single mandatory storage (e.g., PostgreSQL)** — Rejected because it burdens development setup and PostgreSQL isn't optimal for graph traversal at scale
2. **Configuration file (config.ini) only** — Rejected in favor of env vars + args as they integrate better with Docker and CI environments
3. **Abstract factory pattern** — Considered but the current registry approach is simpler and achieves the same goal

## References
- `lightrag/base.py` — abstract base classes
- `lightrag/kg/__init__.py` — storage registry
- `lightrag/kg/shared_storage.py` — workspace isolation implementation
