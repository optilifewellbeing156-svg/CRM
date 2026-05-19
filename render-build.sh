#!/usr/bin/env bash
# Render.com build script for the OPLERP monorepo.
#
# Render runs this as the single Build Command. It:
#   1. Installs all workspace dependencies via pnpm (no frozen lockfile so
#      Render can recover from minor drift between local and remote envs).
#   2. Explicitly approves bcrypt's build scripts so its native bindings
#      compile (pnpm v10 blocks postinstall scripts by default — without
#      this, `require('bcrypt')` fails at runtime because the .node binary
#      was never built).
#   3. Builds the @workspace/api-server package via esbuild, producing
#      ./artifacts/api-server/dist/index.mjs (the file Render's start
#      command launches).

set -euo pipefail

echo "==> Node:  $(node --version)"
echo "==> pnpm:  $(corepack pnpm --version 2>/dev/null || pnpm --version)"

echo "==> Installing workspace dependencies"
pnpm install --no-frozen-lockfile

echo "==> Approving bcrypt build scripts (compiles native bindings)"
# `pnpm approve-builds` is interactive; use `rebuild` to deterministically
# run install scripts for bcrypt so the prebuilt/native binary is in place.
pnpm rebuild bcrypt || pnpm rebuild -r bcrypt || true

echo "==> Building @workspace/api-server"
pnpm --filter @workspace/api-server build

echo "==> Verifying build output"
test -f ./artifacts/api-server/dist/index.mjs
ls -lh ./artifacts/api-server/dist/index.mjs

echo "==> Build complete"
