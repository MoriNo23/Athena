#!/usr/bin/env bash
# Simulación de "descarga + instalación" en cuarto limpio: replica al pie de la
# letra el instructivo de LEEME.md (cp .env.example .env → bun install →
# bunx prisma db push → dev) y además el modo producción standalone.
# Valida las instrucciones ANTES de dárselas al usuario.
set -u
# Simula un entorno limpio: nada de DATABASE_URL heredada del shell (el CLI y
# el runtime deben resolver la ruta relativa del .env del clon, no otra cosa).
unset DATABASE_URL || true
SRC="$(cd "$(dirname "$0")/.." && pwd)"
SIM="$SRC/scripts/clean-test-copy"
LOG=$SIM/test.log
mkdir -p "$SIM"

echo "=== 1. Copiar proyecto (sin node_modules/.next/.git/venv/tools) ==="
rsync -a --exclude node_modules --exclude .next --exclude .git \
  --exclude tools --exclude skills \
  --exclude 'tool-results' --exclude 'scripts/*.png' \
  --exclude 'scripts/*.pdf' --exclude dev.log --exclude server.log \
  --exclude tsconfig.tsbuildinfo --exclude '.metrics' \
  --exclude 'db/custom.db' --exclude 'scripts/clean-test-copy' \
  "$SRC/" "$SIM/"
echo "copiado: $(du -sh "$SIM" | cut -f1)"

echo "=== 2. Instrucción LEEME: cp .env.example .env ==="
cp "$SIM/.env.example" "$SIM/.env"
cat "$SIM/.env"

echo "=== 3. bun install (postinstall debe ejecutar prisma generate) ==="
cd "$SIM" && bun install 2>&1 | tail -5
echo "--- ¿cliente Prisma tiene Badge? ---"
grep -rl "Badge" "$SIM/node_modules/.prisma/client/" 2>/dev/null | head -2 || echo "NO HAY REFERENCIAS A BADGE (mal)"

echo "=== 3b. Instrucción LEEME: bunx prisma db push (clon sin BD) ==="
cd "$SIM" && "$SRC/node_modules/.bin/prisma" db push --skip-generate 2>&1 | tail -3
echo "--- ¿la biblioteca quedó en <raíz>/db/custom.db? ---"
ls -la "$SIM/db/custom.db" 2>/dev/null && echo OK-db-en-raiz || echo FALTA-db-en-raiz
[ ! -e "$SIM/prisma/db" ] && echo OK-sin-prisma/db || echo MAL-existe-prisma/db

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
node -e "const b=require('$SIM/api-books.json'); console.log('n libros:', (b.books||b).length)" 2>&1 | head -2

echo "=== 5. Matar dev, build de producción ==="
pkill -f "clean-test-copy.*next dev" 2>/dev/null; pkill -f "next dev -p 3100" 2>/dev/null; sleep 2
cd "$SIM" && bun run build 2>&1 | tail -8
# server.js puede quedar anidado si Next infiere un workspace root por encima
# de la copia (bun.lock del repo contenedor): se localiza dinámicamente.
SERVER_JS="$(find "$SIM/.next/standalone" -maxdepth 4 -name server.js 2>/dev/null | head -1)"
echo "--- ¿build copió standalone? ---"
[ -n "$SERVER_JS" ] && echo "OK-standalone: $SERVER_JS" || echo FALTA-standalone
SERVER_DIR="$(dirname "$SERVER_JS")"
echo "--- ¿.env quedó dentro de standalone? ---"
ls -la "$SERVER_DIR/.env" 2>/dev/null || { echo "no hay .env en standalone: se copia"; cp "$SIM/.env" "$SERVER_DIR/.env"; }

echo "=== 6. Arrancar producción en puerto 3101 ==="
# Despliegue real del standalone: DATABASE_URL absoluta explícita (el cliente
# embebido del standalone resuelve las rutas relativas desde su propio dir,
# no desde la raíz del clon; en dev y en `next start` la relativa canónica
# funciona sin tocar nada — este paso prueba el servidor compilado en sí).
cd "$SERVER_DIR" && PORT=3101 HOSTNAME=127.0.0.1 DATABASE_URL="file:$SIM/db/custom.db" nohup bun "$SERVER_JS" > "$SIM/prod-3101.log" 2>&1 &
PRODOK=no
for i in $(seq 1 45); do
  sleep 2
  code=$(curl -s -o "$SIM/api-books-prod.json" -w "%{http_code}" http://localhost:3101/api/books 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then PRODOK=yes; break; fi
done
echo "PRODOK=$PRODOK (http=$code tras $((i*2))s)"
node -e "const b=require('$SIM/api-books-prod.json'); console.log('n libros (prod):', (b.books||b).length)" 2>&1 | head -3
echo "--- últimas líneas del log de prod ---"
tail -6 "$SIM/prod-3101.log" 2>/dev/null

echo "=== 7. Limpieza total de la copia de prueba ==="
pkill -f "clean-test-copy" 2>/dev/null; sleep 1
# El install del ensayo enterra un node_modules de >1 GB dentro: hay que
# borrar la copia entera, no solo matar procesos (regenera el ensayo en 1 cmd).
rm -rf "$SIM"
echo "RESULTADO FINAL: DEVOK=$DEVOK PRODOK=$PRODOK"
