#!/usr/bin/env bash
set -euo pipefail

# Idempotent Cloud Agent bootstrap for TR-08.
# Installs repo-required toolchains (bun, GitButler but CLI) then refreshes dependencies.
#
# Do NOT set install to bare "bun install" in the dashboard — bun is not on the base
# image. This script installs bun first, then runs bun install.

export PATH="${HOME}/.local/bin:${HOME}/.bun/bin:${PATH}"

if ! command -v bun >/dev/null 2>&1; then
  echo "Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="${HOME}/.bun/bin:${PATH}"
fi

if ! command -v but >/dev/null 2>&1; then
  echo "Installing GitButler CLI (but)..."
  curl -fsSL https://gitbutler.com/install.sh | sh
  export PATH="${HOME}/.local/bin:${PATH}"
fi

# Ensure agent shells inherit toolchain paths
PROFILE_MARKER="# tr-08-cloud-agent-path"
if ! grep -qF "${PROFILE_MARKER}" "${HOME}/.bashrc" 2>/dev/null; then
  cat >>"${HOME}/.bashrc" <<'EOF'
# tr-08-cloud-agent-path
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
EOF
fi

echo "Toolchain versions:"
bun --version
but --version

echo "Installing project dependencies..."
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "${ROOT}"
bun install --frozen-lockfile
