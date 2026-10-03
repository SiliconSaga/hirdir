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
  keywords=()
  for selector in "$@"; do
    target="${selector%%::*}" # drop a ::nodeid suffix before testing the path
    case "$selector" in
      # Anything under web/ is the field app; everything else is Python. A
      # selector that looks like a path but is not one is a typo, not a
      # keyword — saying so beats a green run of something else entirely.
      web/*)
        [ -e "$target" ] || { echo "no such file: $target" >&2; exit 2; }
        js+=("$selector")
        ;;
      */* | *.py)
        [ -e "$target" ] || { echo "no such file: $target" >&2; exit 2; }
        py+=("$selector")
        ;;
      *)
        if [ -e "$target" ]; then py+=("$selector"); else keywords+=("$selector"); fi
        ;;
    esac
  done
  # pytest keeps only the last -k, so several keywords have to become one
  # expression or all but one would be silently dropped.
  if [ "${#keywords[@]}" -gt 0 ]; then
    expression=""
    for keyword in "${keywords[@]}"; do
      if [ -z "$expression" ]; then expression="$keyword"; else expression="$expression or $keyword"; fi
    done
    py+=(-k "$expression")
  fi
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
