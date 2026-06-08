@echo off
REM Start LightRAG server

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

REM Start the server
echo Starting LightRAG server on http://localhost:9621
lightrag-server
