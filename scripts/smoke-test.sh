#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"

fail() {
  echo "smoke-test: $*" >&2
  exit 1
}

echo "smoke-test: $BASE_URL"

health="$(curl -sfS --max-time 15 "$BASE_URL/health")" || fail "GET /health unreachable"
echo "$health" | grep -q '"status":"ok"' || fail "GET /health unexpected body: $health"
echo "  OK /health"

ready="$(curl -sfS --max-time 15 "$BASE_URL/ready")" || fail "GET /ready unreachable"
echo "$ready" | grep -q '"database":true' || fail "GET /ready database not ready: $ready"
echo "  OK /ready (database)"

config="$(curl -sfS --max-time 15 "$BASE_URL/v1/config")" || fail "GET /v1/config unreachable"
echo "$config" | grep -q 'minSupportedVersion' || fail "GET /v1/config unexpected body: $config"
echo "  OK /v1/config"

echo "smoke-test: all checks passed"
