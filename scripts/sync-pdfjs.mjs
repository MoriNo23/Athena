#!/usr/bin/env node
/**
 * Sincroniza los recursos de pdf.js (cmaps, standard_fonts, wasm) desde
 * node_modules/pdfjs-dist a public/pdfjs.
 *
 * Esos ~200 ficheros son idénticos a los del paquete npm: ya no viven en el
 * repo (se ignoran en .gitignore) y este script los deja listos para:
 *   - `bun run dev`  (Vite sirve public/ tal cual)
 *   - `bun run build` y el APK (Vite los copia a dist/ / out/)
 * Lo llama postinstall, dev.mjs, build y build-apk-web.mjs.
 *
 * Idempotente: si el sello (.version) coincide con el paquete instalado, no
 * copia nada. Uso:  node scripts/sync-pdfjs.mjs [--fuerza]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE = path.join(raiz, "node_modules", "pdfjs-dist");
const DESTINO = path.join(raiz, "public", "pdfjs");
const CARPETAS = ["cmaps", "standard_fonts", "wasm"];
const SELLO = path.join(DESTINO, ".version");

const fuerza = process.argv.includes("--fuerza");

if (!existsSync(path.join(FUENTE, "package.json"))) {
  console.error("✗ Falta node_modules/pdfjs-dist — ejecuta antes: bun install");
  process.exit(1);
}

const version = JSON.parse(readFileSync(path.join(FUENTE, "package.json"), "utf8")).version;

if (!fuerza && existsSync(SELLO) && readFileSync(SELLO, "utf8") === version) {
  console.log(`▸ pdf.js assets ya sincronizados (${version})`);
  process.exit(0);
}

rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });
for (const carpeta of CARPETAS) {
  const de = path.join(FUENTE, carpeta);
  if (!existsSync(de)) continue;
  cpSync(de, path.join(DESTINO, carpeta), { recursive: true });
}
writeFileSync(SELLO, version);
console.log(`✓ pdf.js assets (${CARPETAS.join(", ")}) → public/pdfjs [${version}]`);
