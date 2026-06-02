#!/usr/bin/env bash
# Apply each broken-PR patch, run releaselens, then revert — leaving the working
# tree unchanged. Run from the demo directory: ./broken-prs/demo.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# Override with RELEASELENS_BIN if the CLI is not on PATH (e.g. a monorepo build:
# RELEASELENS_BIN="node ../../packages/cli/dist/index.js" ./broken-prs/demo.sh)
CLI="${RELEASELENS_BIN:-npx releaselens}"

for patch in broken-prs/*.patch; do
  echo "════════════════════════════════════════════════════════"
  echo "Applying $(basename "$patch")"
  echo "────────────────────────────────────────────────────────"
  patch -p1 --quiet <"$patch"
  $CLI check || true
  patch -R -p1 --quiet <"$patch"
  echo
done

echo "Baseline restored — working tree unchanged."
