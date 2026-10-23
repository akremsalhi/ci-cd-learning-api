#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"

if [[ -z "$BASE_URL" ]]; then
  echo "Usage: bash scripts/smoke-test.sh https://your-service.onrender.com" >&2
  exit 1
fi

BASE_URL="${BASE_URL%/}"

echo "Waiting for $BASE_URL/health (free Render services can take about a minute to wake up)..."
curl --fail --silent --show-error --max-time 120 "$BASE_URL/health"
echo
echo "Smoke test passed."
