#!/usr/bin/env bash
# Simulación de "descarga + bun install + uso" en cuarto limpio.
# Valida las instrucciones del LEEME.md ANTES de dárselas al usuario.
set -u
SRC="$(cd "$(dirname "$0")/.." && pwd)"
SIM="$SRC/scripts/clean-test-copy"
LOG=$SIM/test.log
mkdir -p "$SIM"

echo "=== 1. Copiar proyecto (sin node_modules/.next/.git/venv/tools) ==="
rsync -a --exclude node_modules --exclude .next --exclude .git \
  --exclude .venv-graphify --exclude tools --exclude skills \
  --exclude graphify-out --exclude 'tool-results' --exclude 'scripts/*.png' \
  --exclude 'scripts/*.pdf' --exclude dev.log --exclude server.log \
  --exclude tsconfig.tsbuildinfo --exclude '.metrics' \
  "$SRC/" "$SIM/"
echo "copiado: $(du -sh "$SIM" | cut -f1)"

echo "=== 2. Hacer .env portable (ruta relativa al schema) ==="
cat > "$SIM/.env" <<'EOF'
DATABASE_URL=file:../db/custom.db
EOF
cat "$SIM/.env"

echo "=== 3. bun install (postinstall debe ejecutar prisma generate) ==="
cd "$SIM" && bun install 2>&1 | tail -5
echo "--- ¿cliente Prisma tiene Badge? ---"
grep -rl "Badge" "$SIM/node_modules/.prisma/client/" 2>/dev/null | head -2 || echo "NO HAY REFERENCIAS A BADGE (mal)"

echo "=== 4. Arrancar dev en puerto 3100 ==="
cd "$SIM" && nohup bunx next dev -p 3100 > "$SIM/dev-3100.log" 2>&1 &
DEVOK=no
for i in $(seq 1 60); do
  sleep 2
  code=$(curl -s -o "$SIM/api-books.json" -w "%{http_code}" http://localhost:3100/api/books 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then DEVOK=yes; break; fi
done
echo "DEVOK=$DEVOK (http=$code tras $((i*2))s)"
echo "--- libros recibidos ---"
node -e "const b=require('$SIM/api-books.json'); console.log('n libros:', b.length); console.log(b.map(x=>x.title+' '+x.currentPage+'/'+x.totalPages).join(' | '))" 2>&1 | head -5

echo "=== 5. Matar dev, build de producción ==="
pkill -f "clean-test-copy.*next dev" 2>/dev/null; pkill -f "next dev -p 3100" 2>/dev/null; sleep 2
cd "$SIM" && bun run build 2>&1 | tail -8
echo "--- ¿build copió standalone? ---"
ls "$SIM/.next/standalone/server.js" 2>/dev/null && echo OK-standalone || echo FALTA-standalone
echo "--- ¿.env quedó dentro de standalone? ---"
ls -la "$SIM/.next/standalone/.env" 2>/dev/null || echo "no hay .env en standalone"

echo "=== 6. Arrancar producción en puerto 3101 ==="
cd "$SIM" && PORT=3101 HOSTNAME=127.0.0.1 nohup bun .next/standalone/server.js > "$SIM/prod-3101.log" 2>&1 &
PRODOK=no
for i in $(seq 1 45); do
  sleep 2
  code=$(curl -s -o "$SIM/api-books-prod.json" -w "%{http_code}" http://localhost:3101/api/books 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then PRODOK=yes; break; fi
done
echo "PRODOK=$PRODOK (http=$code tras $((i*2))s)"
node -e "const b=require('$SIM/api-books-prod.json'); console.log('n libros (prod):', b.length)" 2>&1 | head -3
echo "--- últimas líneas del log de prod ---"
tail -6 "$SIM/prod-3101.log" 2>/dev/null

echo "=== 7. Limpieza total de la copia de prueba ==="
pkill -f "clean-test-copy" 2>/dev/null; sleep 1
echo "RESULTADO FINAL: DEVOK=$DEVOK PRODOK=$PRODOK"
