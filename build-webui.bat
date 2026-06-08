@echo off
REM Build WebUI

cd /d "%~dp0lightrag_webui"

echo Installing WebUI dependencies...
call bun install --frozen-lockfile

echo Building WebUI...
call bun run build

echo WebUI built successfully!
