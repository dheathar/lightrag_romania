#!/bin/bash
# Stop LightRAG server

echo "Stopping LightRAG server..."

# Find and kill uvicorn/lightrag-server processes
pkill -f "lightrag.api.lightrag_server" 2>/dev/null
pkill -f "uvicorn.*lightrag" 2>/dev/null
pkill -f "gunicorn.*lightrag" 2>/dev/null

# Check if any processes were killed
if [ $? -eq 0 ]; then
    echo "LightRAG server stopped."
else
    echo "No LightRAG server process found."
fi
