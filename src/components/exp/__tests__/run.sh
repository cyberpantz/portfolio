#!/usr/bin/env sh
# No bundler: the script under test is pulled out of the .astro file itself.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/../../../.."
node "$DIR/handheld.test.mjs"
# A crash is not a pass: absence of this line is the signal.
echo
echo "HANDHELD NOTICE PASSED"
