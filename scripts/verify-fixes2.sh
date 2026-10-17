#!/bin/bash
# Ronda 2 de verificación: overflow móvil restante de la biblioteca + fixes epub (h3, quote, medida)
set -u
cd /home/z/my-project
CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
IMB=$(ls -d ~/.impeccable/bin/*/impeccable | sort -V | tail -1)
OUT=/home/z/my-project/scripts

pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null; sleep 1
setsid bunx next dev -p 3000 > /home/z/my-project/dev.log 2>&1 < /dev/null &
SRV=$!
for i in $(seq 1 25); do code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ --max-time 3); [ "$code" = "200" ] && break; sleep 2; done
echo "server: $code"

ab() { timeout 60 agent-browser "$@" 2>&1; }

echo "=== biblioteca móvil 390: overflow restante ==="
ab close >/dev/null; sleep 1
ab set viewport 390 844 >/dev/null
ab open http://127.0.0.1:3000/ >/dev/null
ab wait --load networkidle >/dev/null; ab wait --text "Sofia" >/dev/null; sleep 1.2
ab eval "JSON.stringify({scrollW:document.documentElement.scrollW||document.documentElement.scrollWidth,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,culprits:(()=>{const vw=document.documentElement.clientWidth;const out=[];document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect();if(r.right>vw+1&&r.width>2&&r.height>2&&out.length<8)out.push({t:el.tagName,cls:(el.className||'').toString().slice(0,60),right:Math.round(r.right),w:Math.round(r.width)})});return out})()})" | head -3
echo "=== detector móvil ==="
IMPECCABLE_BROWSER=$CHROME "$IMB" detect --viewport 390x844 http://127.0.0.1:3000/ 2> $OUT/verify-library-mobile2.txt
echo "exit: $?"; head -8 $OUT/verify-library-mobile2.txt

echo "=== epub página 6 (texto): h3, quote, medida, 12px ==="
ab set viewport 1280 800 >/dev/null
ab find role button click --name "Abrir El mundo de Sofia" >/dev/null; sleep 4
ab mouse move 640 200 >/dev/null
REFS=$(ab snapshot -i | rg "spinbutton" | rg -o "@e[0-9]+")
ab fill "$REFS" "6" >/dev/null; ab press Enter >/dev/null; sleep 1.5
ab mouse move 640 200 >/dev/null
ab eval "JSON.stringify({h3:!!document.querySelector('.epub-page h3.epub-h3'),h4:!!document.querySelector('.epub-page h4'),maxW:getComputedStyle(document.querySelector('.epub-page')).maxWidth,measure:Math.round(document.querySelector('.epub-page').getBoundingClientRect().width)})" | head -2

echo "=== página 5 (cita de Goethe): borde del quote ==="
ab mouse move 640 200 >/dev/null; REFS=$(ab snapshot -i | rg "spinbutton" | rg -o "@e[0-9]+")
ab fill "$REFS" "5" >/dev/null; ab press Enter >/dev/null; sleep 1.2
ab eval "JSON.stringify({quote:!!document.querySelector('.epub-quote'),quoteBorder:getComputedStyle(document.querySelector('.epub-quote')||document.body).borderLeftWidth,quoteBorderColor:getComputedStyle(document.querySelector('.epub-quote')||document.body).borderLeftColor})" | head -2
ab mouse move 640 200 >/dev/null
ab screenshot $OUT/verify-epub-p6.png >/dev/null

echo "=== apagar ==="
kill $SRV 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
echo OK
