#!/usr/bin/env bash
# Runs both suites: Python (workbook generator) and JavaScript (field app).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== python =="
uv run --frozen pytest

echo "== javascript syntax =="
find web/src web/tests -name '*.js' -print0 | xargs -0 -n1 node --check

echo "== javascript =="
node --test web/tests
