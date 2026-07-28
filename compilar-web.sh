#!/bin/bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
WEBSITE_SRC="$APP_DIR/website"
WEBSITE_DIR="$APP_DIR/server/src/website"

echo "=== Compilando sitio web (Vite) ==="
cd "$WEBSITE_SRC"

if ! command -v npm &>/dev/null; then
  echo "npm no instalado -- instalá Node.js 20+ antes de correr esto."
  exit 1
fi

npm install
npm run build
echo "=== Sitio compilado ==="

rm -rf "$WEBSITE_DIR"
cp -r dist "$WEBSITE_DIR"
echo "=== Sitio copiado a $WEBSITE_DIR ==="
echo "Ejecuta: sudo systemctl restart supermercado-go"
