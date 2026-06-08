# LightRAG WebUI

LightRAG WebUI is a React 19-based web interface for interacting with the LightRAG system. It provides a user-friendly interface for querying, managing, and exploring LightRAG's functionalities.

## Recent Features

### Enhanced Citations Display (February 2026)
- **Show Chunk Content**: Optional toggle to display actual chunk text content in citations for transparency
- **Expandable References**: Click to expand/collapse individual citation entries
- **Entity Statistics**: Summary of entities and relations used in each response
- **Grouped by Type**: Citations organized by entity type (entities, relations, chunks) with counts
- **RAG Best Practices**: Follows 2026 standards for verifiability and trust building in RAG systems

### Enhanced Knowledge Graph Legend (February 2026)
- **Statistics Dashboard**: Shows total entities and connections at a glance
- **Entity Counts**: Displays count for each entity type extracted from documents
- **Interactive Tooltips**: Hover over entity types to see user-friendly descriptions
- **Help Section**: Built-in instructions for non-technical users
- **Sorted Display**: Entity types sorted by frequency (most common first)
- **Descriptions**: Plain-language explanations for each entity type (Person, Organization, Location, Event, Concept, etc.)

## Installation

1. **Install Bun:**

    If you haven't already installed Bun, follow the official documentation: [https://bun.sh/docs/installation](https://bun.sh/docs/installation)

2. **Install Dependencies:**

    In the `lightrag_webui` directory, run the following command to install project dependencies:

    ```bash
    bun install --frozen-lockfile
    ```

3. **Build the Project:**

    Run the following command to build the project:

    ```bash
    bun run build
    ```

    This command will bundle the project and output the built files to the `lightrag/api/webui` directory.

## Development

- **Start the Development Server:**

  If you want to run the WebUI in development mode, use the following command:

  ```bash
  bun run dev
  ```

## Features Guide

### Using Enhanced Citations

1. Navigate to the **Retrieval** tab
2. In **Query Settings**, enable the **"Show Chunk Content"** checkbox
3. Submit your query
4. In the response, click **"Show Citations"** to expand the citations section
5. Click on individual entity types to expand and see the actual chunk text content
6. Use citations to verify the source of information and build trust in RAG responses

**Benefits:**
- Full transparency into retrieval context
- Source verification for fact-checking
- Better understanding of how the answer was generated
- Compliance with RAG best practices for verifiability

### Using the Knowledge Graph Legend

1. Navigate to the **Knowledge Graph** tab
2. The legend appears automatically on the left side (if data is available)
3. View statistics at the top: Total Entities and Connections
4. See each entity type with its count and color
5. Hover over entity types to see descriptions
6. Use the help section at the bottom for interaction tips

**Benefits:**
- Non-technical users can understand the graph
- Quick overview of knowledge structure
- Clear explanations for each entity type
- Easier navigation and exploration

## Script Commands

The following are some commonly used script commands defined in `package.json`:

- `bun install`: Installs project dependencies.
- `bun run dev`: Starts the development server.
- `bun run build`: Builds the project.
- `bun run lint`: Runs the linter.

## Technology Stack

- **React 19**: Modern React with functional components and hooks
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Zustand**: State management with selector pattern
- **Tailwind CSS**: Utility-first styling
- **Sigma.js + Graphology**: Knowledge graph visualization
- **React-i18next**: Internationalization support
