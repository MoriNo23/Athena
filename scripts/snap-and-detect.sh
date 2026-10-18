#!/bin/bash
# Snapshot del DOM renderizado → HTML estático sin <script>, CSS enlazado
# rescrito a ruta local → escaneo con impeccable detect file://
# Uso: snap-and-detect.sh <nombre> [archivo.html]
#   - con archivo.html: usa ese DOM ya renderizado (p. ej. de scripts/cdp-capture.mjs)
#   - sin él: vuelca el DOM de la vista actual con agent-browser eval
set -u
NAME="${1:-snap}"
RAW_FILE="${2:-}"
OUT="$(cd "$(dirname "$0")" && pwd)/audit-snapshots"
IMB=$(ls -d ~/.impeccable/bin/*/impeccable 2>/dev/null | sort -V | tail -1)
[ -n "${IMB:-}" ] && [ -x "$IMB" ] || IMB="$HOME/.agents/skills/impeccable/scripts/impeccable"
CHROME="${CHROME:-$(command -v chromium || command -v google-chrome)}"
mkdir -p "$OUT"

# 1) Volcar el DOM renderizado
if [ -n "$RAW_FILE" ]; then
  cp "$RAW_FILE" "$OUT/$NAME.raw"
else
  timeout 60 agent-browser eval "document.documentElement.outerHTML" > "$OUT/$NAME.raw" 2>/dev/null
fi
if [ ! -s "$OUT/$NAME.raw" ]; then echo "ERROR: snapshot vacío"; exit 1; fi

# 2) Fetch del CSS enlazado y post-proceso (python)
cd "$(dirname "$0")/.."
python3 - "$OUT" "$NAME" <<'PY'
import json, re, sys, urllib.request, pathlib
out, name = sys.argv[1], sys.argv[2]
raw = pathlib.Path(f"{out}/{name}.raw").read_text(encoding="utf-8")
html = json.loads(raw) if raw.lstrip().startswith('"') else raw  # agent-browser devuelve JSON-encoded
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
