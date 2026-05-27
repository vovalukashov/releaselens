#!/usr/bin/env bash
# Paste this into a Claude Code Routine environment setup script
# (claude.ai/code/routines → Environment → Setup script).
#
# It provisions Node 24 + pnpm 11 + corepack + workspace dependencies.
# Cached for ~7 days, so changes to lockfile require a fresh routine run
# (or use a SessionStart hook to re-run `pnpm install` per session).

set -euo pipefail

echo "→ Installing Node 24 via nvm"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 24
nvm alias default 24
nvm use 24

echo "→ Installing pnpm 11.1.2 + enabling corepack"
npm install -g pnpm@11.1.2
corepack enable

echo "→ Installing workspace dependencies (frozen lockfile)"
pnpm install --frozen-lockfile

echo "→ Building packages so CLI is runnable from routine prompts"
pnpm -w build

echo "→ Making CLI binary executable"
if [ -f packages/cli/dist/index.js ]; then
  chmod +x packages/cli/dist/index.js
fi

echo "✓ Routine environment ready for ReleaseLens."
