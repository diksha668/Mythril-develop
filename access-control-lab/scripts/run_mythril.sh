#!/usr/bin/env bash
#
# Run Mythril on every contract and save a Markdown report per file.
# Vulnerable contracts are analysed first, then the fixed ones, so you can
# diff the two sets of reports.
#
# Requires Mythril installed (pip install mythril) and solc 0.4.25 available
# to it (Mythril fetches it automatically via the --solv flag below).
#
# -t 3  : explore up to 3 transactions deep. Several of these bugs are a
#         two-step attack (become owner in tx 1, withdraw in tx 2), which a
#         single-transaction analysis will not see.

set -u
SOLV="0.4.25"
TXDEPTH=3
OUT="mythril/reports"
mkdir -p "$OUT"

analyse () {
  local dir="$1" tag="$2"
  for f in "$dir"/*.sol; do
    [ -e "$f" ] || continue
    local base
    base="$(basename "${f%.sol}")"
    echo ">> Mythril: $tag/$base"
    myth analyze "$f" --solv "$SOLV" -t "$TXDEPTH" -o markdown \
      > "$OUT/${tag}_${base}.md" 2>&1
    echo "   report -> $OUT/${tag}_${base}.md"
  done
}

echo "=== Analysing VULNERABLE contracts ==="
analyse contracts/vulnerable vuln

echo "=== Analysing FIXED contracts ==="
analyse contracts/fixed fixed

echo
echo "Done. Compare, e.g.:"
echo "  less $OUT/vuln_Phishable.md"
echo "  less $OUT/fixed_Phishable.md"
