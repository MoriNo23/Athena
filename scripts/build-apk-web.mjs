#!/usr/bin/env node
/**
 * Build web para el APK (salida estática en out/).
 *
 * La app self-host tiene API (src/app/api), candado (src/proxy.ts) y página
 * de login con server components — nada de eso existe en un export estático.
 * En la build del APK esos ficheros se APARTAN temporalmente, `next build`
 * genera la web estática (el motor offline public/athena-offline.js responde
 * /api/* localmente dentro del WebView) y al final TODO vuelve a su sitio,
 * incluso si el build falla.
 *
 * Uso:  node scripts/build-apk-web.mjs      (o bun run apk:web)
 * Sale: out/  (webDir de Capacitor)
 */
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = path.join(raiz, ".apk-tmp");

/** [origen, destino-tmp] de lo que se aparta solo para la build estática */
const APARTADOS = [
  ["src/app/api", "api"],
  ["src/proxy.ts", "proxy.ts"],
  ["src/app/login", "login"],
];

function apartar() {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  for (const [origen, nombre] of APARTADOS) {
    const de = path.join(raiz, origen);
    if (existsSync(de)) {
      renameSync(de, path.join(tmp, nombre));
      console.log(`  ↳ apartado ${origen}`);
    }
  }
}

function restaurar() {
  for (const [origen, nombre] of APARTADOS) {
    const de = path.join(tmp, nombre);
    const a = path.join(raiz, origen);
    if (existsSync(de) && !existsSync(a)) {
      renameSync(de, a);
      console.log(`  ↳ restaurado ${origen}`);
    }
  }
  rmSync(tmp, { recursive: true, force: true });
}

console.log("▸ Athena · build web estática para el APK");
apartar();
let resultado;
try {
  resultado = spawnSync(
    process.execPath,
    [path.join(raiz, "node_modules", "next", "dist", "bin", "next"), "build"],
    {
      cwd: raiz,
      stdio: "inherit",
      env: { ...process.env, ATHENA_STATIC: "1", NEXT_PUBLIC_ATHENA_APK: "1" },
    }
  );
} finally {
  restaurar();
}

if (!resultado || resultado.status !== 0) {
  console.error("✗ La build estática falló; el repo quedó restaurado.");
  process.exit(1);
}
if (!existsSync(path.join(raiz, "out", "index.html"))) {
  console.error("✗ La build no produjo out/index.html.");
  process.exit(1);
}
console.log("✓ Web estática lista en out/ (siguiente paso: bunx cap sync android)");
