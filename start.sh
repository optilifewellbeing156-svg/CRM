#!/bin/bash
# Start the OptiLife ERP locally.
# Usage: ./start.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$ROOT/artifacts/api-server"
FE_DIR="$ROOT/artifacts/optilife"

# Rebuild API server bundle
echo "Building API server..."
cd "$API_DIR" && env $(grep -v '^#' .env | xargs) node build.mjs

# Start API server
echo "Starting API server on port 8080..."
env $(grep -v '^#' "$API_DIR/.env" | xargs) \
  node --enable-source-maps "$API_DIR/dist/index.mjs" &
API_PID=$!
echo "  API PID: $API_PID"

sleep 1

# Start frontend dev server
echo "Starting frontend on http://localhost:5173 ..."
cd "$FE_DIR"
env $(grep -v '^#' "$FE_DIR/.env" | xargs) pnpm exec vite &
VITE_PID=$!
echo "  Vite PID: $VITE_PID"

echo ""
echo "  Frontend: http://localhost:5173"
echo "  API:      http://localhost:8080"
echo "  Health:   http://localhost:8080/api/healthz"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $API_PID $VITE_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
