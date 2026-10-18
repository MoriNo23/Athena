#!/usr/bin/env bash
# Dev server + capturas en una sola sesión (el sandbox recoye procesos huérfanos).
set -u
unset DATABASE_URL
cd /home/z/my-project/atena
pkill -f "next dev -p 3000" 2>/dev/null
sleep 1

bunx next dev -p 3000 > /tmp/atena-dev.log 2>&1 &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null' EXIT

# espera a que /api/books responda
for i in $(seq 1 40); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/books 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
done
echo "dev listo (http=$code)"

node scripts/capture-after-tinte.mjs
CAPTURE_EXIT=$?
echo "capturas exit=$CAPTURE_EXIT"
exit $CAPTURE_EXIT
