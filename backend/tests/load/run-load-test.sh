#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
TEST_MANAGER_PIN="${TEST_MANAGER_PIN:-}"
DEVICE_PREFIX="${DEVICE_PREFIX:-LT}"
SUMMARY_PATH="${SUMMARY_PATH:-test-results/load/load-summary}"

mkdir -p "$(dirname "$SUMMARY_PATH")"

echo "═══ MobileToServer-POS Load Test ═══"
echo "  Target:   $BASE_URL"
echo "  Prefix:   $DEVICE_PREFIX"
echo ""

k6 run \
  --env BASE_URL="$BASE_URL" \
  --env TEST_MANAGER_PIN="$TEST_MANAGER_PIN" \
  --env DEVICE_PREFIX="$DEVICE_PREFIX" \
  --summary-export "${SUMMARY_PATH}.json" \
  --out json="${SUMMARY_PATH}.k6.json" \
  tests/load/load-test.js

echo ""
echo "Summary: ${SUMMARY_PATH}.json"
