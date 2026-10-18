#!/usr/bin/env bash
# Escaneo impeccable de las capturas after-tinte con el server vivo
# (el CSS debe descargarse de localhost:3000 mientras existe).
set -u
unset DATABASE_URL
cd /home/z/my-project/atena
export IMPECCABLE_BROWSER="$HOME/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome"
pkill -f "next dev -p 3000" 2>/dev/null
sleep 1

bunx next dev -p 3000 > /tmp/atena-dev.log 2>&1 &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null' EXIT

for i in $(seq 1 40); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/books 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
done
echo "dev listo (http=$code)"

OUT="scripts/audit-snapshots"
for raw in "$OUT"/after-tinte-*.raw; do
  n=$(basename "$raw" .raw)
  python3 - "$OUT" "$n" "http://localhost:3000" <<'PY'
import json, re, sys, urllib.request, pathlib
out, name, base = sys.argv[1], sys.argv[2], sys.argv[3]
raw = pathlib.Path(f"{out}/{name}.raw").read_text(encoding="utf-8")
html = json.loads(raw) if raw.lstrip().startswith('"') else raw
html = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.S | re.I)
css_ok = "no"
def fetch_css(m):
    global css_ok
    href = m.group(1)
    if href.startswith("/_next/") or href.startswith("/"):
        try:
            data = urllib.request.urlopen(base + href, timeout=20).read()
            pathlib.Path(f"{out}/{name}.css").write_bytes(data)
            css_ok = "sí"
            return m.group(0).replace(href, f"{name}.css")
        except Exception as e:
            print("CSS fetch falló:", e)
    return m.group(0)
html = re.sub(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', fetch_css, html, flags=re.I)
html = re.sub(r'<link[^>]+href="([^"]+)"[^>]+rel="stylesheet"', fetch_css, html, flags=re.I)
pathlib.Path(f"{out}/{name}.html").write_text(html, encoding="utf-8")
print(f"{name}: html {len(html)} chars, css={css_ok}")
PY
  impeccable detect --json "file://$PWD/$OUT/$n.html" > "docs/auditoria/after-tinte/$n.json" 2>"/tmp/$n.detect.err"
  python3 -c "
import json
d=json.load(open('docs/auditoria/after-tinte/$n.json'))
lc=[x for x in d if x.get('antipattern')=='low-contrast']
print('  →', len(d), 'hallazgos |', len(lc), 'low-contrast')
"
done
