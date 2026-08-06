#!/usr/bin/env bash
# Prepare ecommerce-java dashboard + record feature demo + burn captions.
#
# Usage (from repo root):
#   ./docs/videos/record-feature-demo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
REPO="${RGBUILDER_DEMO_REPO:-$ROOT/rgbuilder-tests/ecommerce-java}"
PORT="${DASHBOARD_PORT:-8080}"
URL="http://127.0.0.1:${PORT}/"

if [[ -x "$ROOT/target/release/rgbuilder" ]]; then
  export PATH="$ROOT/target/release:$PATH"
fi
if ! command -v rgbuilder >/dev/null 2>&1; then
  echo "error: rgbuilder not on PATH — cargo build --release" >&2
  exit 1
fi

echo "==> discover + dashboard bundle ($REPO)"
rgbuilder -r "$REPO" discover . -l java -e target \
  --with-cfg --with-security --with-taint --with-dashboard --with-harmonic \
  --export-migration-hints

echo "==> semantic index (vocab)"
rgbuilder -r "$REPO" semantic index --embedder vocab --dimensions 256

echo "==> serve on :$PORT"
rgbuilder -r "$REPO" serve --port "$PORT" &
SERVE_PID=$!
cleanup() { kill "$SERVE_PID" 2>/dev/null || true; }
trap cleanup EXIT

# Wait for HTTP
for i in $(seq 1 60); do
  if curl -sf "$URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
curl -sf "$URL" >/dev/null

echo "==> record (Playwright)"
cd "$ROOT/dashboard"
if [[ ! -d node_modules/playwright ]]; then
  npm ci
fi
DASHBOARD_URL="$URL" node scripts/record-feature-demo.mjs

echo "==> burn captions"
"$ROOT/docs/videos/burn-feature-demo-captions.sh"

echo "==> done"
ls -lh "$ROOT/docs/videos/rgbuilder-feature-demo"*.mp4 "$ROOT/docs/videos/rgbuilder-feature-demo.srt"
