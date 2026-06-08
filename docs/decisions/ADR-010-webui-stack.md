# ADR-010: React 19 + Sigma.js WebUI with Warm Light Theme

## Status
Accepted

## Date
2024-08

## Context

The DocForge system requires a web interface that can:
1. Visualize large knowledge graphs interactively (thousands of nodes/edges)
2. Stream LLM responses in real-time
3. Display evaluation results with metric breakdowns
4. Allow live configuration of complex pipeline settings
5. Support internationalization (English + Romanian)
6. Work in dark and light themes

The graph visualization requirement is the key technical constraint. The graph can have hundreds to thousands of nodes and edges. This requires a WebGL-based renderer with good performance, layout algorithms, and interactive features.

## Decision

**Core stack:**
- **React 19** — latest stable version with concurrent features
- **Vite** — fast build tool, dev server with HMR
- **Bun** — fast JavaScript runtime for package management and build
- **TypeScript** — for type safety across the codebase
- **Tailwind CSS v4** — utility-first CSS with minimal configuration

**Graph visualization:**
- **Sigma.js** via `@react-sigma/core` — WebGL-based graph renderer, handles 10K+ nodes smoothly
- `@react-sigma/graph-search` — search within graph
- `@sigma/node-border`, `@sigma/edge-curve` — visual enhancements

**UI Component System:**
- **shadcn/ui** — accessible, composable components built on Radix UI primitives
- Components live in `lightrag_webui/src/components/ui/`
- Customized to match the warm light theme

**State Management:**
- **Zustand** — lightweight store for graph data, settings, auth state
- `useState`/`useEffect` for component-local state

**Internationalization:**
- **react-i18next** — translation strings in `src/locales/en.json` and `src/locales/ro.json`

**Theme:**
- Claude-inspired warm light theme with HSL variables
- Primary: `hsl(18 55% 50%)` (warm terracotta)
- Background: `hsl(40 33% 97.5%)` (warm off-white)
- Defined in `lightrag_webui/src/index.css` as CSS custom properties

**Build output:** Compiled into `lightrag/api/webui/` and served as static files by the FastAPI server at `/webui`. No separate frontend server required in production.

## Consequences

### Positive
- Sigma.js handles large graphs (10K+ nodes) with WebGL acceleration
- Bun is significantly faster than npm/yarn for CI and local installs
- Tailwind v4 reduces CSS bundle size vs. custom CSS
- shadcn/ui components are accessible by default (ARIA, keyboard navigation)
- Single deployable artifact — WebUI is baked into the Python package

### Negative
- React 19 is newer and some ecosystem libraries lag in React 19 compatibility
- Bun requirement is an additional tool for contributors (npm can be used as fallback but is not recommended)
- Warm light theme is a strong aesthetic choice that may not suit all deployments

### Risks
- **Sigma.js API changes** — Sigma.js v3 has different APIs from v2. Components target Sigma.js v3 via `@react-sigma/core`.
- **Graph performance limits** — Beyond ~10K nodes with complex layouts, frame rates may drop. `MAX_GRAPH_NODES` env var (default 1000) limits nodes returned by the API to maintain UI performance.

## Alternatives Considered

1. **D3.js** — Considered: more flexible but much slower for large graphs (SVG-based, not WebGL)
2. **Cytoscape.js** — Considered: good features but Sigma.js has better WebGL performance
3. **React Flow** — Considered: excellent for flowcharts but not optimized for large-scale knowledge graphs
4. **Vue.js** — Rejected: team familiarity with React is higher
5. **Server-side rendering (Next.js)** — Rejected: SSR adds complexity for a primarily interactive app with no SEO requirement

## References
- `lightrag_webui/src/index.css` — theme variable definitions
- `lightrag_webui/src/features/GraphViewer.tsx` — Sigma.js integration
- `lightrag_webui/package.json` — full dependency list
- `lightrag_webui/src/locales/` — i18n translation files
