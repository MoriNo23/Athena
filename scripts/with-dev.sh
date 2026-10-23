#!/usr/bin/env bash
# Arranca el dev server (puerto 3000), espera readiness y ejecuta el comando
# recibido; al terminar, apaga el server. Uso: bash scripts/with-dev.sh <cmd...>
cd "$(dirname "$0")/.." || exit 2
# Sondas asumen API abierto: el candado opt-in (auth-api) queda fuera del server de sondas
export ATENA_PASSWORD=""
rm -f dev.log
setsid nohup bun run dev </dev/null >/dev/null 2>&1 &
cleanup() {
  pkill -f "next dev -p 3000" 2>/dev/null
  pkill -f "next-server" 2>/dev/null
}
trap cleanup EXIT
up=0
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 2 2>/dev/null || true)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
if [ "$up" != "1" ]; then
  echo "DEV SERVER NO ARRANCÓ"
  tail -20 dev.log 2>/dev/null
  exit 2
fi
echo "[with-dev] server listo, ejecutando: $*"
"$@"
