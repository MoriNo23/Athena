#!/bin/bash
# Verificación post-fixes de la auditoría impeccable (Task 41).
# El dev server muere entre tool calls → todo el flujo vive DENTRO de este script.
set -u
cd /home/z/my-project
CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
IMB=$(ls -d ~/.impeccable/bin/*/impeccable | sort -V | tail -1)
OUT=/home/z/my-project/scripts

echo "=== 1) arrancar dev server ==="
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null; sleep 1
setsid bunx next dev -p 3000 > /home/z/my-project/dev.log 2>&1 < /dev/null &
SRV=$!
for i in $(seq 1 25); do code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ --max-time 3); [ "$code" = "200" ] && break; sleep 2; done
echo "server HTTP: $code (pid $SRV)"

ab() { timeout 60 agent-browser "$@" 2>&1; }

echo "=== 2) biblioteca móvil 390px (sin kicker, sin overflow, cubiertas brutal) ==="
ab close >/dev/null; sleep 1
ab set viewport 390 844 >/dev/null
ab open http://127.0.0.1:3000/ >/dev/null
ab wait --load networkidle >/dev/null
ab wait --text "Sofia" >/dev/null; sleep 1
ab storage local clear >/dev/null 2>&1 || true
ab open http://127.0.0.1:3000/ >/dev/null
ab wait --load networkidle >/dev/null
ab wait --text "Sofia" >/dev/null; sleep 1.2
ab eval "JSON.stringify({hScroll:document.documentElement.scrollWidth>document.documentElement.clientWidth,scrollW:document.documentElement.scrollWidth,kicker:!!document.querySelector('p[class*=tracking-]'),coverBorder:getComputedStyle(document.querySelector('article button')).borderWidth,coverShadow:getComputedStyle(document.querySelector('article button')).boxShadow.slice(0,40)})" | head -2

echo "=== 3) lector EPUB móvil: header envuelve, sin scroll horizontal ==="
ab find role button click --name "Abrir El mundo de Sofia" >/dev/null; sleep 4
ab eval "JSON.stringify({hScroll:document.documentElement.scrollW>document.documentElement.clientWidth,hScroll2:document.documentElement.scrollWidth>document.documentElement.clientWidth,scrollW:document.documentElement.scrollWidth,headerH:Math.round(document.querySelector('[data-chrome-kind=header]').getBoundingClientRect().height),h3:!!document.querySelector('.epub-h3'),h4:!!document.querySelector('.epub-page h4')})" | head -2
ab screenshot $OUT/verify-epub-mobile.png >/dev/null

echo "=== 4) lector EPUB desktop: medida ~70ch, h3, textos 12px ==="
ab set viewport 1280 800 >/dev/null
ab eval "location.reload()" >/dev/null; sleep 5
ab wait --text "Sofia" >/dev/null
ab find role button click --name "Abrir El mundo de Sofia" >/dev/null; sleep 4
ab mouse move 640 200 >/dev/null
ab eval "JSON.stringify((()=>{const pg=document.querySelector('.epub-page');const cs=getComputedStyle(pg);const span=document.createElement('span');span.textContent='n'.repeat(80);span.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font:inherit';pg.appendChild(span);const nW=span.getBoundingClientRect().width/80;span.remove();const p=document.querySelector('.epub-p');const probe=document.createElement('span');probe.textContent='o'.repeat(80);probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font:inherit';(p||pg).appendChild(probe);const oW=probe.getBoundingClientRect().width/80;probe.remove();const inner=pg.getBoundingClientRect().width;const sub=document.querySelector('[data-chrome-kind=header] p');return {maxW:cs.maxWidth,measureN:Math.round(inner/nW),measureO:Math.round(inner/oW),subFont:getComputedStyle(sub).fontSize,h3:!!document.querySelector('.epub-h3'),quoteBorder:getComputedStyle(document.querySelector('.epub-quote')||document.body).borderLeftWidth}})())" | head -2
ab screenshot $OUT/verify-epub-desktop.png >/dev/null

echo "=== 5) Tab despierta el chrome inmerso (fix a11y) ==="
sleep 8  # reposo → auto-ocultado (idleSeconds por defecto)
ab eval "JSON.stringify({hiddenBefore:document.querySelector('[data-chrome-kind=header]').offsetParent===null||getComputedStyle(document.querySelector('[data-chrome-kind=header]')).visibility==='hidden'})" | head -2
ab press Tab >/dev/null; sleep 0.8
ab eval "JSON.stringify({visibleAfterTab:getComputedStyle(document.querySelector('[data-chrome-kind=header]')).visibility==='visible'})" | head -2

echo "=== 6) detector impeccable: biblioteca (URL, oscuro) ==="
IMPECCABLE_BROWSER=$CHROME "$IMB" detect --viewport 1280x800 http://127.0.0.1:3000/ 2> $OUT/verify-library-findings.txt
echo "exit: $?"
cat $OUT/verify-library-findings.txt | head -14

echo "=== 7) detector impeccable: biblioteca móvil (URL, oscuro) ==="
IMPECCABLE_BROWSER=$CHROME "$IMB" detect --viewport 390x844 http://127.0.0.1:3000/ 2> $OUT/verify-library-mobile-findings.txt
echo "exit: $?"
cat $OUT/verify-library-mobile-findings.txt | head -14

echo "=== 8) capturas de evidencia (claro/oscuro) ==="
ab open http://127.0.0.1:3000/ >/dev/null; ab wait --text "Sofia" >/dev/null; sleep 1
ab screenshot $OUT/verify-library-dark.png >/dev/null
ab find role button click --name "Cambiar a tema claro" >/dev/null; sleep 1
ab screenshot $OUT/verify-library-light.png >/dev/null

echo "=== fin: apagar server ==="
kill $SRV 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
echo "OK"
