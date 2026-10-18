#!/bin/bash
# Audita vistas del lector que el detector por URL no alcanza (SPA de ruta única).
# Uso: audit-reader.sh <fase>   fases: epub | pdf | tp-epub | tp-pdf | library-light
# Flujo: lanza chromium CDP → agent-browser navega → impeccable detect --cdp → capturas → mata chrome.
set -u
PHASE="${1:-epub}"
CHROME="${CHROME:-$(command -v chromium || command -v google-chrome)}"
IMB=$(ls -d ~/.impeccable/bin/*/impeccable 2>/dev/null | sort -V | tail -1)
[ -n "${IMB:-}" ] && [ -x "$IMB" ] || IMB="$HOME/.agents/skills/impeccable/scripts/impeccable"
PORT=9223
BASE=http://localhost:3000
OUT="$(cd "$(dirname "$0")" && pwd)"
AB="agent-browser --cdp $PORT"

echo "== fase: $PHASE · engine: $IMB"

# 1) Chromium con CDP (vive lo que viva este script)
pkill -f "remote-debugging-port=$PORT" 2>/dev/null
sleep 0.5
setsid "$CHROME" --headless=new --remote-debugging-port=$PORT --no-sandbox --disable-gpu \
  --disable-dbus --user-data-dir=$OUT/audit-profile --window-size=1280,800 about:blank \
  > $OUT/audit-chrome.log 2>&1 < /dev/null &
CHROME_PID=$!
for i in $(seq 1 20); do curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1 && break; sleep 0.5; done
echo "chrome CDP listo (pid $CHROME_PID)"

# 2) Navegación según fase
$AB open "$BASE/" >/dev/null 2>&1
$AB wait --load networkidle >/dev/null 2>&1
sleep 1.5

case "$PHASE" in
  epub)
    $AB find role button click --name "Abrir El mundo de Sofia" >/dev/null 2>&1
    $AB wait --text "670" >/dev/null 2>&1
    sleep 2.5
    ;;
  pdf)
    $AB find role button click --name "Abrir Marco" >/dev/null 2>&1
    sleep 4
    ;;
  tp-epub)
    $AB find role button click --name "Abrir El mundo de Sofia" >/dev/null 2>&1
    $AB wait --text "670" >/dev/null 2>&1
    sleep 2
    $AB find role button click --name "Teleprompter" >/dev/null 2>&1 || true
    sleep 3
    ;;
  tp-pdf)
    $AB find role button click --name "Abrir Marco" >/dev/null 2>&1
    sleep 4
    $AB find role button click --name "Teleprompter" >/dev/null 2>&1 || true
    sleep 3
    ;;
  library-light)
    $AB find role button click --name "Cambiar al tema claro" >/dev/null 2>&1 || true
    sleep 1.5
    ;;
esac

# 3) Detector impeccable sobre la vista renderizada
"$IMB" detect --cdp $PORT --target localhost:3000 --json > $OUT/impeccable-$PHASE.json 2> $OUT/impeccable-$PHASE.txt
echo "exit detect: $?"
cat $OUT/impeccable-$PHASE.txt

# 4) Captura + errores de página
$AB screenshot $OUT/audit-$PHASE.png >/dev/null 2>&1
echo "--- page errors ---"
$AB errors 2>&1 | head -20
echo "--- console (últimas) ---"
$AB console 2>&1 | tail -15

# 5) Limpieza
kill $CHROME_PID 2>/dev/null
pkill -f "remote-debugging-port=$PORT" 2>/dev/null
echo "== fin fase $PHASE"
