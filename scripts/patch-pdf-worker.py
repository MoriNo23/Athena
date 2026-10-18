#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parche idempotente: inyecta el polyfill Map.getOrInsert/getOrInsertComputed
AL PRINCIPIO de public/pdf.worker.min.mjs.

Causa raíz (cazada con superpowers systematic-debugging + probe-pdf-load.js):
pdf.js v6 usa el upsert de TC39 en Map EN DOS REALMS:
  - hilo principal  → cubierto por src/lib/map-get-or-insert-polyfill.ts
  - el Worker       → NADIE lo parcheaba: en Chromium algo viejos
    «this._requestsByChunk.getOrInsertComputed is not a function» (pdf.worker.mjs:3106)
    y la carga del PDF falla con UnknownErrorException al reabrir un libro
    (peticiones por rangos). Síntoma del usuario: «muchos fallos».

Idempotente: si el archivo ya trae el marcador «atena-polyfill», no toca nada.
Re-ejecutar si algún día se vuelve a copiar el worker desde node_modules.
"""
from pathlib import Path

WORKER = Path(__file__).resolve().parent.parent / "public" / "pdf.worker.min.mjs"
MARKER = "atena-polyfill"
HEADER = """/* atena-polyfill: Map.getOrInsert/getOrInsertComputed (TC39 upsert) para
 * Chromium viejos. Inyectado por scripts/patch-pdf-worker.py — NO copiar
 * pdf.worker.min.mjs desde node_modules sin re-ejecutar ese script. */
if (typeof Map.prototype.getOrInsert !== "function") {
  Map.prototype.getOrInsert = function (k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); };
}
if (typeof Map.prototype.getOrInsertComputed !== "function") {
  Map.prototype.getOrInsertComputed = function (k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); };
}
"""

data = WORKER.read_text(encoding="utf-8")
if MARKER in data[:400]:
    print("ya-parcheado: el worker ya trae el polyfill, nada que hacer")
else:
    WORKER.write_text(HEADER + data, encoding="utf-8")
    print(f"parcheado: {WORKER} ({len(data)} -> {len(HEADER) + len(data)} bytes)")
