#!/bin/bash
# Start LightRAG server in development mode with auto-reload

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Copying from env.example..."
    cp env.example .env
fi

# Start the server with auto-reload
echo "Starting LightRAG server in DEV mode on http://localhost:9621"
uvicorn lightrag.api.lightrag_server:app --reload --host 0.0.0.0 --port 9621
