#!/bin/bash
# Paso 5+6+9 de graphify: etiquetar comunidades, regenerar reporte, exportar HTML, manifest+limpieza
set -e
cd "$(dirname "$0")/.."
PY="$PWD/.venv-graphify/bin/python"

echo "=== Paso 5: etiquetas de comunidades ==="
"$PY" - <<'EOF'
import json
from graphify.build import build_from_json
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding='utf-8'))
detection = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
analysis = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding='utf-8'))

G = build_from_json(extraction, root='src', directed=False)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

labels = {
    0: "Vistas raíz de la app",
    1: "Modos de lectura",
    2: "Biblioteca e insignias",
    3: "Visor PDF y OCR",
    4: "Rutas API",
    5: "Ajustes, riel y tipos",
    6: "Sistema de toasts",
    7: "Primitivas Card y menús",
    8: "Primitivas Sidebar",
    9: "Paneles sheet y config",
    10: "Controles misceláneos",
    11: "Primitivas Menubar",
    12: "API de diccionario",
    13: "Primitivas Carousel",
    14: "Primitivas Badge y Toggle",
    15: "Primitivas Form",
    16: "Primitivas Chart",
    17: "Primitivas Drawer",
    18: "Primitivas Select",
    19: "Primitivas NavigationMenu",
    20: "Primitivas Pagination",
    21: "Primitivas Breadcrumb",
    22: "Primitivas Accordion",
    23: "Primitivas InputOTP",
    24: "Primitivas Alert",
    25: "Primitivas Avatar",
    26: "Primitivas Collapsible",
    27: "Toaster sonner",
    28: "Primitiva AspectRatio",
}

questions = suggest_questions(G, communities, labels)
report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, 'src', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding='utf-8')
wrote = to_json(G, communities, 'graphify-out/graph.json', community_labels=labels)
if not wrote:
    print('AVISO: guard de encogimiento no pasó (esperado: mismo grafo)')
print('Reporte actualizado con etiquetas reales')
EOF

echo "=== Paso 6: exportar HTML interactivo ==="
"$PWD/.venv-graphify/bin/graphify" export html

echo "=== Paso 9: manifest + limpieza ==="
"$PY" - <<'EOF'
import json
from pathlib import Path
from datetime import datetime, timezone
from graphify.detect import save_manifest

detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
extract = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding='utf-8'))
all_files = [f for cat in ('code', 'document', 'paper', 'image', 'video') for f in detect['files'].get(cat, [])]
save_manifest(detect['files'], root='src')
manifest = {
    'built_at': datetime.now(timezone.utc).isoformat(),
    'scan_root': 'src',
    'files': len(all_files),
    'nodes': len(extract['nodes']),
    'edges': len(extract['edges']),
}
print('Manifest:', manifest)
EOF
# limpieza de temporales (Step 9)
rm -f graphify-out/.graphify_cached.json graphify-out/.graphify_uncached.txt graphify-out/.graphify_semantic_new.json graphify-out/.graphify_chunk_*.json graphify-out/.graphify_semantic.json graphify-out/.graphify_ast.json
echo "=== COMPLETO ==="
ls -la graphify-out/ | rg -v "graphify_ast|graphify_semantic"
