#!/usr/bin/env node
/**
 * Dev de la casa: dos procesos con un solo comando.
 *  - API: Bun ejecutando server/index.ts en el 3001 (con --watch).
 *  - Web: Vite dev-server en el 3000 que proxya /api al 3001.
 *
 * Uso:  node scripts/dev.mjs [--host]     (o bun run dev / dev:lan)
 * [--host] abre la web a la LAN (0.0.0.0) — el modo/candado lo marca
 * ATHENA_MODO del entorno (dev = offline, dev:lan = lan).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lan = process.argv.includes("--host");

const viteBin = path.join(raiz, "node_modules", "vite", "bin", "vite.js");
if (!existsSync(viteBin)) {
  console.error("Falta vite (node_modules). Ejecuta antes: bun install");
  process.exit(1);
}

// recursos de pdf.js (cmaps, fuentes, wasm) en public/pdfjs: idempotente
spawnSync(process.execPath, [path.join(raiz, "scripts", "sync-pdfjs.mjs")], { stdio: "inherit" });

const hijos = [];

function lanzar(nombre, comando, args, env = {}) {
  const p = spawn(comando, args, {
    cwd: raiz,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  hijos.push(p);
  p.on("exit", (code) => {
    console.log(`▸ ${nombre} terminó (${code ?? "señal"})`);
  });
  return p;
}

console.log("▸ Athena dev · API (Bun) en 127.0.0.1:3001 · web (Vite) en http://localhost:3000");
lanzar("api", "bun", ["--watch", "server/index.ts"], {
  PORT: "3001",
  ATHENA_HOST: "127.0.0.1",
});
lanzar("web", process.execPath, [viteBin, ...(lan ? ["--host", "0.0.0.0"] : [])]);

// Ctrl+C: se lo pasamos a los hijos y esperamos a que bajen limpios
for (const señal of ["SIGINT", "SIGTERM"]) {
  process.on(señal, () => {
    for (const h of hijos) h.kill(señal);
  });
}

const pendientes = new Set(hijos);
for (const h of hijos) {
  h.on("exit", () => {
    pendientes.delete(h);
    if (pendientes.size === 0) process.exit(0);
  });
}
