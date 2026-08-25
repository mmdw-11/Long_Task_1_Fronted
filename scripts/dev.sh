#!/usr/bin/env bash
set -euo pipefail

FRONTEND_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_ROOT="$(dirname "$FRONTEND_ROOT")/long_task_1"
PYTHON="${PYTHON:-python}"

test_backend_ready() {
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://127.0.0.1:8000/api/system/status" 2>/dev/null || echo "000")
  [[ "$status" == "200" || "$status" == "401" || "$status" == "403" ]]
}

if ! test_backend_ready; then
  if [[ ! -d "$BACKEND_ROOT" ]]; then
    echo "Backend directory not found: $BACKEND_ROOT" >&2
    exit 1
  fi

  RUN_ROOT="$BACKEND_ROOT/runs"
  mkdir -p "$RUN_ROOT"

  (cd "$BACKEND_ROOT" && $PYTHON -m engine.server \
    > "$RUN_ROOT/server.out.log" \
    2> "$RUN_ROOT/server.err.log" &)

  DEADLINE=$((SECONDS + 20))
  while ! test_backend_ready; do
    if (( SECONDS >= DEADLINE )); then
      echo "--- server.err.log (last 80 lines) ---"
      tail -n 80 "$RUN_ROOT/server.err.log" 2>/dev/null || true
      echo "FastAPI backend failed to start on http://127.0.0.1:8000" >&2
      exit 1
    fi
    sleep 0.5
  done
fi

echo "✅ FastAPI backend ready: http://127.0.0.1:8000"
cd "$FRONTEND_ROOT"
npm run dev:web
