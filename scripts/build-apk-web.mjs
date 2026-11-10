#!/usr/bin/env node
/**
 * Build web para el APK (salida estática en out/).
 *
 * `vite build --mode apk` genera la web estática SIN la página de login (la
 * configuración de vite.config.ts la excluye en modo apk): el motor offline
 * (public/athena-offline.js) responde /api/* localmente dentro del WebView.
 * Después del build este script:
 *   1. inyecta en <head> de out/index.html el flag del APK y el motor offline
 *      como scripts SÍNCRONOS — deben instalarse antes de que arranque React
 *      (cualquier fetch de arranque va local);
 *   2. borra de out/ los datos personales que puedan existir en public/
 *      (uploads/, evidencia/): la biblioteca de quien compila jamás viaja
 *      dentro del APK.
 *
 * Uso:  node scripts/build-apk-web.mjs      (o bun run apk:web)
 * Sale: out/  (webDir de Capacitor)
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(raiz, "node_modules", "vite", "bin", "vite.js");

console.log("▸ Athena · build web estática para el APK");

// recursos de pdf.js (cmaps, fuentes, wasm) en public/pdfjs: idempotente
const sinc = spawnSync(process.execPath, [path.join(raiz, "scripts", "sync-pdfjs.mjs")], { stdio: "inherit" });
if (sinc.status !== 0) {
  console.error("✗ No pude preparar los recursos de pdf.js.");
  process.exit(1);
}

const resultado = spawnSync(process.execPath, [viteBin, "build", "--mode", "apk"], {
  cwd: raiz,
  stdio: "inherit",
});

if (!resultado || resultado.status !== 0) {
  console.error("✗ La build estática falló.");
  process.exit(1);
}

const indice = path.join(raiz, "out", "index.html");
if (!existsSync(indice)) {
  console.error("✗ La build no produjo out/index.html.");
  process.exit(1);
}

// 1. motor offline + flag del APK, al principio de <head>, síncronos
let html = readFileSync(indice, "utf8");
const INYECCION =
  "<script>window.__ATHENA_APK__=true;</script>\n    <script src=\"/athena-offline.js\"></script>\n    ";
if (!html.includes("athena-offline.js")) {
  html = html.replace(/<head([^>]*)>/i, `<head$1>\n    ${INYECCION}`);
  writeFileSync(indice, html);
  console.log("  ↳ motor offline inyectado en out/index.html");
}

// 2. la biblioteca de quien compila no viaja en el APK
for (const prohibido of ["uploads", "evidencia"]) {
  const carpeta = path.join(raiz, "out", prohibido);
  if (existsSync(carpeta)) {
    rmSync(carpeta, { recursive: true, force: true });
    console.log(`  ↳ fuera del APK: out/${prohibido}/ (datos personales)`);
  }
}

console.log("✓ Web estática lista en out/ (siguiente paso: bunx cap sync android)");
