@echo off
REM Start WebUI in development mode

cd /d "%~dp0lightrag_webui"

echo Starting WebUI dev server...
call bun run dev
