#!/bin/bash
# Snapshot del DOM renderizado (agent-browser ya navegó a la vista) → HTML estático
# sin <script>, CSS enlazado rescrito a ruta local → escaneo con impeccable detect file://
# Uso: snap-and-detect.sh <nombre>   (requiere que agent-browser esté en la vista deseada)
set -u
NAME="${1:-snap}"
OUT=/home/z/my-project/scripts/audit-snapshots
IMB=$(ls -d ~/.impeccable/bin/*/impeccable | sort -V | tail -1)
CHROME=/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome
mkdir -p "$OUT"

# 1) Volcar el DOM renderizado
timeout 60 agent-browser eval "document.documentElement.outerHTML" > "$OUT/$NAME.raw" 2>/dev/null
if [ ! -s "$OUT/$NAME.raw" ]; then echo "ERROR: snapshot vacío"; exit 1; fi

# 2) Fetch del CSS enlazado y post-proceso (python)
cd /home/z/my-project
python3 - "$OUT" "$NAME" <<'PY'
import json, re, sys, urllib.request, pathlib
out, name = sys.argv[1], sys.argv[2]
raw = pathlib.Path(f"{out}/{name}.raw").read_text(encoding="utf-8")
html = json.loads(raw)  # el eval devuelve un string JSON-encoded
# quitar <script> (no se re-ejecutan en file://, evita reacciones raras del parser)
html = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.S | re.I)
# rescibir el CSS enlazado absoluto y reescribirlo a archivo local
css_local = None
def fetch_css(m):
    global css_local
    href = m.group(1)
    if href.startswith("/_next/") or href.startswith("/"):
        url = "http://localhost:3000" + href
        try:
            data = urllib.request.urlopen(url, timeout=20).read()
            css_local = f"{out}/{name}.css"
            pathlib.Path(css_local).write_bytes(data)
            return m.group(0).replace(href, f"{name}.css")
        except Exception as e:
            print("CSS fetch falló:", e)
    return m.group(0)
html = re.sub(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', fetch_css, html, flags=re.I)
# también href antes de rel
html = re.sub(r'<link[^>]+href="([^"]+)"[^>]+rel="stylesheet"', fetch_css, html, flags=re.I)
pathlib.Path(f"{out}/{name}.html").write_text(html, encoding="utf-8")
print(f"snapshot: {out}/{name}.html ({len(html)} chars, css={'sí' if css_local else 'no'})")
PY

# 3) Escaneo con el motor (file:// se renderiza con Puppeteer)
"$IMB" detect "file://$OUT/$NAME.html" 2> "$OUT/$NAME-findings.txt"
echo "exit detect: $?"
cat "$OUT/$NAME-findings.txt"
