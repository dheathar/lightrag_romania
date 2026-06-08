# Changelog

All notable changes to LightRAG will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2026-02-16

#### WebUI Enhancements

**Enhanced Citations Display**
- Added "Show Chunk Content" toggle in Query Settings to display actual chunk text content
- Implemented expandable/collapsible citation entries for better UX
- Added entity statistics summary (total entities, relations, chunks used)
- Organized citations by type (entities, relations, chunks) with counts
- Added support for `include_chunk_content` parameter in API queries
- Citations now follow RAG 2026 best practices for verifiability and transparency

**Enhanced Knowledge Graph Legend**
- Added statistics dashboard showing total entities and connections
- Display entity counts for each type extracted from documents
- Interactive tooltips with user-friendly descriptions for each entity type
- Built-in help section with interaction instructions for non-technical users
- Sorted entity types by frequency (most common first)
- Plain-language descriptions for all entity types:
  - Person: People, names, individuals
  - Organization: Companies, institutions, groups
  - Location: Places, addresses, geographical locations
  - Event: Actions, occurrences, meetings
  - Concept: Ideas, theories, abstract topics
  - Method: Processes, techniques, procedures
  - Content: Data, information, content items
  - Data: Numerical data, statistics
  - Artifact: Objects, tools, products
  - Natural Object: Natural phenomena
  - Creature: Animals, organisms

### Changed - 2026-02-16

**TypeScript API Updates**
- Enhanced `QueryRequest` interface to include `include_chunk_content` optional parameter
- Updated settings store with proper initialization for `include_chunk_content` field

**Component Improvements**
- `ChatMessage.tsx`: Refactored state management from IIFE to component-level hooks
- `Legend.tsx`: Fixed graph store access pattern to use `sigmaGraph` property
- `QuerySettings.tsx`: Added new checkbox control for chunk content display

### Fixed - 2026-02-16

- Fixed duplicate citations display caused by incorrect state management pattern
- Fixed JavaScript error accessing non-existent `graph()` function in graph store
- Fixed missing TypeScript type definition preventing API parameter from working
- Fixed missing initial state in settings store causing checkbox to not persist

### Technical Details

**Files Modified:**
- `lightrag_webui/src/api/lightrag.ts` - Added TypeScript type for include_chunk_content
- `lightrag_webui/src/stores/settings.ts` - Added field to querySettings initial state
- `lightrag_webui/src/components/retrieval/QuerySettings.tsx` - Added UI control
- `lightrag_webui/src/components/retrieval/ChatMessage.tsx` - Enhanced citations display
- `lightrag_webui/src/components/graph/Legend.tsx` - Complete enhancement with statistics
- `lightrag_webui/README.md` - Added documentation for new features

**Dependencies:**
- React 19 with functional components and hooks
- Zustand state management with selector pattern
- TypeScript for type safety
- Tailwind CSS for styling

## [Previous Releases]

See README.md News section for historical changes before 2026-02-16.
