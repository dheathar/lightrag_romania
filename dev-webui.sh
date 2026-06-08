#!/bin/bash
# Start WebUI in development mode

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/lightrag_webui"

echo "Starting WebUI dev server..."
bun run dev
