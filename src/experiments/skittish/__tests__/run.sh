#!/usr/bin/env sh
# Bundles with esbuild so the real behaviour runs, not a copy of it.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/../../../.."
npx esbuild "$DIR/../behaviour.ts" --bundle --format=esm --loader:.json=json \
  --outfile="$DIR/.bundle.mjs" --log-level=warning
node "$DIR/behaviour.test.mjs"
rm -f "$DIR"/.bundle.*
# A crash is not a pass: absence of this line is the signal.
echo
echo "SKITTISH SUITE PASSED"
