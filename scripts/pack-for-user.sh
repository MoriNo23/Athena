#!/usr/bin/env bash
# Empaqueta el proyecto para que el usuario se lo lleve a su máquina.
# Produce: download/riel-de-la-lectura-app.tar.gz (con LEEME.md dentro)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT=$ROOT/download/riel-de-la-lectura-app.tar.gz

cd "$ROOT"
rm -f "$OUT"
tar czf "$OUT" \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.git' \
  --exclude='./skills' \
  --exclude='./tool-results' \
  --exclude='./.zscripts' \
  --exclude='./.metrics' \
  --exclude='./upload' \
  --exclude='./download' \
  --exclude='./examples' \
  --exclude='./tests' \
  --exclude='./mini-services' \
  --exclude='./Caddyfile' \
  --exclude='./tsconfig.tsbuildinfo' \
  --exclude='./dev.log' \
  --exclude='./dev-keepalive.log' \
  --exclude='./server.log' \
  --exclude='./scripts/*.png' \
  --exclude='./scripts/*.pdf' \
  .
cp -f "$ROOT/LEEME.md" "$ROOT/download/LEEME.md"

echo "=== tamaño del paquete ==="
du -sh "$OUT"
echo "=== contenido clave (muestra) ==="
tar -tzf "$OUT" | grep -E "LEEME.md|\.env$|custom.db|package.json|bun.lock|schema.prisma|uploads/.*\.pdf$|CRAPPER.md" | head -12
echo "=== nº total de archivos ==="
tar -tzf "$OUT" | grep -vc '/$'
echo "=== comprobaciones de oro ==="
for f in ./LEEME.md ./.env ./db/custom.db ./package.json ./bun.lock ./prisma/schema.prisma ./public/pdf.worker.min.mjs ./CRAPPER.md; do
  tar -tzf "$OUT" "$f" > /dev/null 2>&1 && echo "OK  $f" || echo "FALTA  $f"
done
