@echo off
rem Smart Parking: start the backend (FastAPI :8000) and frontend (Vite :5173).
rem Installs dependencies on the first run. Close the two server windows to stop.
setlocal
cd /d "%~dp0"

set "PY=python"
where python >nul 2>nul || set "PY=py -3"
set "VENV_PY=%~dp0backend\.venv\Scripts\python.exe"

if not exist "%VENV_PY%" (
  echo ==^> Creating Python virtual environment ^(backend\.venv^)
  %PY% -m venv backend\.venv
  if errorlevel 1 goto :error
)

"%VENV_PY%" -c "import fastapi, sqlalchemy, uvicorn" >nul 2>nul
if errorlevel 1 (
  echo ==^> Installing backend dependencies
  "%VENV_PY%" -m pip install -r backend\requirements.txt
  if errorlevel 1 goto :error
)

if not exist frontend\node_modules (
  echo ==^> Installing frontend dependencies
  pushd frontend
  call npm install
  popd
)

if not exist backend\parking.db (
  echo ==^> First run: loading demo data
  pushd backend
  "%VENV_PY%" seed.py
  popd
)

start "Smart Parking - Backend" /D "%~dp0backend" "%VENV_PY%" -m uvicorn app.main:app --port 8000
start "Smart Parking - Frontend" /D "%~dp0frontend" cmd /k npm run dev

echo.
echo   Smart Parking is starting in two new windows
echo   App:       http://localhost:5173
echo   API docs:  http://localhost:8000/docs
echo   Close both server windows to stop.
echo.
goto :eof

:error
echo.
echo Setup failed. Check that Python 3.11+ and Node.js 18+ are installed.
exit /b 1
