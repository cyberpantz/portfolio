#!/usr/bin/env sh
# Bundles with esbuild so the real components run, not a mock of them.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/../../../.."
npx esbuild "$DIR/render.test.tsx" --bundle --platform=node --format=cjs \
  --jsx=automatic --target=node20 --loader:.css=empty --loader:.json=json \
  --outfile="$DIR/.bundle.cjs" --log-level=warning
node "$DIR/.bundle.cjs"
rm -f "$DIR/.bundle.cjs"
# A crash is not a pass: absence of this line is the signal.
echo
echo "TILT SUITE PASSED"
