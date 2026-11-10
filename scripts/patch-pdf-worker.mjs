#!/usr/bin/env node
/**
 * Parchea pdf.worker.min.mjs con el polyfill de Map.getOrInsert /
 * Map.getOrInsertComputed (propuesta TC39 upsert) que pdf.js v6 usa y los
 * Chromium algo viejos no tienen — sin él, el visor explota en
 * WorkerTransport con «getOrInsertComputed is not a function».
 *
 * Lee el worker limpio de node_modules/pdfjs-dist, antepone el polyfill y
 * escribe public/pdf.worker.min.mjs. Actualizar pdfjs-dist = re-ejecutar:
 *
 *   node scripts/patch-pdf-worker.mjs
 *
 * (El worker de la web se carga desde public/, no desde node_modules, para
 * que el APK offline y las instalaciones sin build lo sirvan igual.)
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMPIO = path.join(raiz, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const DESTINO = path.join(raiz, "public", "pdf.worker.min.mjs");

if (!existsSync(LIMPIO)) {
  console.error("✗ Falta node_modules/pdfjs-dist — ejecuta antes: bun install");
  process.exit(1);
}

const POLYFILL = `/* atena-polyfill: Map.getOrInsert/getOrInsertComputed (TC39 upsert) para
 * Chromium viejos. Inyectado por scripts/patch-pdf-worker.mjs — NO copiar
 * pdf.worker.min.mjs desde node_modules sin re-ejecutar ese script. */
if (typeof Map.prototype.getOrInsert !== "function") {
  Map.prototype.getOrInsert = function (k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); };
}
if (typeof Map.prototype.getOrInsertComputed !== "function") {
  Map.prototype.getOrInsertComputed = function (k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); };
}
`;

const limpio = readFileSync(LIMPIO, "utf8");
if (limpio.includes("atena-polyfill")) {
  // el paquete ya trae el parche (versión futura que lo integra): copia directa
  copyFileSync(LIMPIO, DESTINO);
  console.log("✓ pdf.worker.min.mjs copiado (el polyfill ya viene integrado)");
  process.exit(0);
}

// conserva el parche si ya está y el worker de abajo no cambió
if (existsSync(DESTINO) && readFileSync(DESTINO, "utf8") === POLYFILL + limpio) {
  console.log("✓ pdf.worker.min.mjs ya está parcheado y al día");
  process.exit(0);
}

writeFileSync(DESTINO, POLYFILL + limpio);
console.log("✓ pdf.worker.min.mjs parcheado (polyfill getOrInsert antepuesto)");
