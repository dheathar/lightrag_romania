#!/bin/bash
# Build WebUI

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/lightrag_webui"

echo "Installing WebUI dependencies..."
bun install --frozen-lockfile

echo "Building WebUI..."
bun run build

echo "WebUI built successfully!"
