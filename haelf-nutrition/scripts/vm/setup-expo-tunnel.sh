#!/usr/bin/env bash
# One-time setup on Ubuntu 22.04/24.04 VM (e.g. Oracle Cloud Always Free).
# Usage: bash scripts/vm/setup-expo-tunnel.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> Node.js"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs git
fi
node -v
npm -v

echo "==> pm2"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "==> Dependencies"
npm ci 2>/dev/null || npm install

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and set Supabase keys:"
  echo "  cp .env.example .env && nano .env"
  exit 1
fi

if [[ ! -f .env.vm ]]; then
  cat > .env.vm <<'EOF'
# https://expo.dev/accounts/[user]/settings/access-tokens
EXPO_TOKEN=your_expo_access_token_here
EOF
  echo "Created .env.vm — set EXPO_TOKEN before starting pm2."
  exit 1
fi

if grep -q 'your_expo_access_token_here' .env.vm; then
  echo "Edit .env.vm and set a real EXPO_TOKEN."
  exit 1
fi

echo "==> pm2 start"
pm2 delete haelf-expo-tunnel 2>/dev/null || true
pm2 start scripts/vm/ecosystem.config.cjs
pm2 save
pm2 startup | tail -1 | bash || true

echo ""
echo "Done. Watch logs for the exp:// tunnel URL:"
echo "  pm2 logs haelf-expo-tunnel --lines 80"
echo ""
echo "In Expo Go: Projects → Enter URL manually (paste exp://... from logs)."
