@echo off
REM Start LightRAG server in development mode with auto-reload

cd /d "%~dp0"

REM Activate virtual environment
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

REM Check if .env exists
if not exist ".env" (
    echo Warning: .env file not found. Copying from env.example...
    copy env.example .env
)

REM Start the server with auto-reload
echo Starting LightRAG server in DEV mode on http://localhost:9621
uvicorn lightrag.api.lightrag_server:app --reload --host 0.0.0.0 --port 9621
