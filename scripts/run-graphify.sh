#!/bin/bash
# Pipeline graphify para el corpus de código de Riel (src/) — sigue SKILL.md v0.9.88
# Corpus 100% código → extracción AST determinista, sin LLM ni API keys.
set -e
cd /home/z/my-project
PY=/home/z/my-project/.venv-graphify/bin/python
mkdir -p graphify-out
echo "$PY" > graphify-out/.graphify_python
INPUT=/home/z/my-project/src

echo "=== Paso 2: detect ==="
"$PY" - <<'EOF'
import json
from graphify.detect import detect
from pathlib import Path
result = detect(Path('/home/z/my-project/src'))
Path('graphify-out/.graphify_detect.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
cats = {k: len(v) for k, v in result.get('files', {}).items()}
print('Corpus:', result['total_files'], 'archivos ·', result.get('total_words'), 'palabras ·', cats)
EOF

echo "=== Paso 3A: extracción AST ==="
"$PY" - <<'EOF'
import json
from graphify.extract import collect_files, extract
from pathlib import Path
detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
code_files = []
for f in detect.get('files', {}).get('code', []):
    p = Path(f)
    code_files.extend(collect_files(p) if p.is_dir() else [p])
if code_files:
    result = extract(code_files, cache_root=Path('/home/z/my-project/src'), root=Path('/home/z/my-project/src'))
    Path('graphify-out/.graphify_ast.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
    print('AST:', len(result['nodes']), 'nodos,', len(result['edges']), 'aristas')
else:
    Path('graphify-out/.graphify_ast.json').write_text(json.dumps({'nodes': [], 'edges': [], 'input_tokens': 0, 'output_tokens': 0}), encoding='utf-8')
    print('Sin archivos de código')
EOF

echo "=== Paso 3B: semántica vacía (corpus solo-código) ==="
"$PY" -c "
import json
from pathlib import Path
Path('graphify-out/.graphify_semantic.json').write_text(json.dumps({'nodes': [], 'edges': [], 'hyperedges': [], 'input_tokens': 0, 'output_tokens': 0}), encoding='utf-8')
"

echo "=== Paso 3C: merge AST + semántica ==="
"$PY" - <<'EOF'
import json
from pathlib import Path
ast = json.loads(Path('graphify-out/.graphify_ast.json').read_text(encoding='utf-8'))
sem = json.loads(Path('graphify-out/.graphify_semantic.json').read_text(encoding='utf-8'))
for n in sem['nodes']:
    n.setdefault('_origin', 'semantic')
for e in sem['edges']:
    e.setdefault('_origin', 'semantic')
seen = {n['id'] for n in ast['nodes']}
merged_nodes = list(ast['nodes'])
for n in sem['nodes']:
    if n['id'] not in seen:
        merged_nodes.append(n)
        seen.add(n['id'])
merged = {
    'nodes': merged_nodes,
    'edges': ast['edges'] + sem['edges'],
    'hyperedges': sem.get('hyperedges', []),
    'input_tokens': sem.get('input_tokens', 0),
    'output_tokens': sem.get('output_tokens', 0),
}
Path('graphify-out/.graphify_extract.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Merge: {len(merged_nodes)} nodos, {len(merged["edges"])} aristas')
EOF

echo "=== Paso 4: construir grafo + clustering + reporte ==="
"$PY" - <<'EOF'
import json
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding='utf-8'))
detection = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
G = build_from_json(extraction, root='/home/z/my-project/src', directed=False)
if G.number_of_nodes() == 0:
    raise SystemExit('ERROR: grafo vacío')
communities = cluster(G)
cohesion = score_all(G, communities)
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
labels = {cid: 'Community ' + str(cid) for cid in communities}
questions = suggest_questions(G, communities, labels)
wrote = to_json(G, communities, 'graphify-out/graph.json')
if not wrote:
    raise SystemExit('ERROR: se negó a encoger graph.json')
report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens, '/home/z/my-project/src', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
analysis = {
    'communities': {str(k): v for k, v in communities.items()},
    'cohesion': {str(k): v for k, v in cohesion.items()},
    'gods': gods,
    'surprises': surprises,
    'questions': questions,
}
Path('graphify-out/.graphify_analysis.json').write_text(json.dumps(analysis, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Grafo: {G.number_of_nodes()} nodos, {G.number_of_edges()} aristas, {len(communities)} comunidades')
EOF

echo "=== Paso 4.5: diagnóstico de salud ==="
"$PY" - <<'EOF'
import json
from graphify.diagnostics import diagnose_extraction, format_diagnostic_report
from pathlib import Path
extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding='utf-8'))
summary = diagnose_extraction(extraction, directed=False, root='/home/z/my-project/src')
print(format_diagnostic_report(summary))
EOF

echo "=== LISTO: sigue etiquetado de comunidades (manual) y export HTML ==="
