#!/usr/bin/env sh
# All chatbots checks. Bundles with esbuild so the render test runs the
# real components rather than a mock of them.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$DIR/../../../.."
cd "$ROOT"

node "$DIR/lint.mjs"
node --experimental-strip-types --import "$DIR/register.mjs" "$DIR/verify.mjs"
node --experimental-strip-types --import "$DIR/register.mjs" "$DIR/calendar.test.mjs"

npx esbuild "$DIR/render.test.tsx" --bundle --platform=node --format=cjs \
  --jsx=automatic --target=node20 --loader:.css=empty \
  --outfile="$DIR/.render.bundle.cjs" --log-level=warning
node "$DIR/.render.bundle.cjs"
rm -f "$DIR/.render.bundle.cjs"

# A crash is not a pass.
#
# `set -e` stops the run, but a caller grepping the output for "FAIL"
# sees none and reads that as green — which happened, and hid a
# TypeError for a whole turn. Say it plainly at the end so the absence
# of this line is itself the signal.
echo
echo "ALL SUITES PASSED"
