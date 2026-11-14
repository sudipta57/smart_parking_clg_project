#!/usr/bin/env bash
# Smart Parking: start the backend (FastAPI :8000) and frontend (Vite :5173).
# Installs dependencies on the first run. Press Ctrl+C to stop both.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PYTHON="${PYTHON:-python3}"
VENV_PY="$BACKEND/.venv/bin/python"

if [ ! -x "$VENV_PY" ]; then
  echo "==> Creating Python virtual environment (backend/.venv)"
  "$PYTHON" -m venv "$BACKEND/.venv"
fi

if ! "$VENV_PY" -c "import fastapi, sqlalchemy, uvicorn" 2>/dev/null; then
  echo "==> Installing backend dependencies"
  "$VENV_PY" -m pip install -r "$BACKEND/requirements.txt"
fi

if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "==> Installing frontend dependencies"
  (cd "$FRONTEND" && npm install)
fi

if [ ! -f "$BACKEND/parking.db" ]; then
  echo "==> First run: loading demo data"
  (cd "$BACKEND" && "$VENV_PY" seed.py)
fi

# Stop both servers when this script exits (Ctrl+C or one server crashing).
trap 'kill $BACK_PID $FRONT_PID 2>/dev/null || true' EXIT

(cd "$BACKEND" && exec "$VENV_PY" -m uvicorn app.main:app --port 8000) &
BACK_PID=$!
(cd "$FRONTEND" && exec ./node_modules/.bin/vite) &
FRONT_PID=$!

# Wait until the API answers before printing the URLs.
for _ in $(seq 1 40); do
  if "$VENV_PY" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" 2>/dev/null; then
    break
  fi
  sleep 0.25
done

echo
echo "  Smart Parking is running"
echo "  App:       http://localhost:5173"
echo "  API docs:  http://localhost:8000/docs"
echo "  Press Ctrl+C to stop."
echo

# Return as soon as either server stops (bash 3 on macOS has no "wait -n").
wait -n 2>/dev/null || wait
