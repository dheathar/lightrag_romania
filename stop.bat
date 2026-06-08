@echo off
REM Stop LightRAG server

echo Stopping LightRAG server...

REM Find and kill python processes running lightrag server
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" /fo list ^| find "PID:"') do (
    wmic process where "ProcessId=%%a" get commandline 2>nul | find "lightrag" >nul && taskkill /pid %%a /f 2>nul
)

REM Also try to kill uvicorn directly
taskkill /f /im uvicorn.exe 2>nul

echo LightRAG server stopped (if it was running).
