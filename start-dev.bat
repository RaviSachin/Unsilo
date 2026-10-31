@echo off
REM Starts the Unsilo backend (port 8000) and the React UI (port 5173) in two windows.
cd /d "%~dp0"
start "Unsilo backend" cmd /k "call .venv\Scripts\activate.bat && cd src && uvicorn app.main:app --reload --port 8000"
start "Unsilo UI" cmd /k "cd frontend && (if not exist node_modules npm install) && npm run dev"
timeout /t 6 >nul
start http://localhost:5173
