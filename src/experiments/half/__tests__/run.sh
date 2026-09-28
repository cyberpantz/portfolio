#!/usr/bin/env sh
# Kept for `pnpm test:half`; the work is in run.mjs.
set -e
node "$(cd "$(dirname "$0")" && pwd)/run.mjs"
