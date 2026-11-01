#!/usr/bin/env bash
# builds server/bin/arutha_lk for this machine (cgo sqlite); the linux binary of the droplet: scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/check-sync.sh
cd server && go build -trimpath -ldflags "-s -w" -o bin/arutha_lk .
echo "built server/bin/arutha_lk"
