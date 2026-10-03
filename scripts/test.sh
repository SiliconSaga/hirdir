#!/usr/bin/env bash
# Runs both suites: Python (workbook generator) and JavaScript (field app).
#
# With selectors, runs only what they name, so `ws test hirdir <selector>`
# reaches one file instead of the lot:
#   bash scripts/test.sh web/tests/roster.test.js   # just that JS file
#   bash scripts/test.sh tests/unit/test_config.py  # just that Python file
#   bash scripts/test.sh fair_share                 # pytest -k fair_share
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "$#" -gt 0 ]; then
  js=()
  py=()
  for selector in "$@"; do
    case "$selector" in
      # Anything under web/ is the field app; everything else is Python, as a
      # path or nodeid when one exists on disk and a -k keyword otherwise.
      web/*) js+=("$selector") ;;
      *)
        if [ -e "${selector%%::*}" ]; then py+=("$selector"); else py+=(-k "$selector"); fi
        ;;
    esac
  done
  status=0
  if [ "${#py[@]}" -gt 0 ]; then uv run --frozen pytest "${py[@]}" || status=1; fi
  if [ "${#js[@]}" -gt 0 ]; then node --test "${js[@]}" || status=1; fi
  exit "$status"
fi

echo "== python =="
uv run --frozen pytest

echo "== javascript syntax =="
find web/src web/tests -name '*.js' -print0 | xargs -0 -n1 node --check

echo "== javascript =="
node --test web/tests
