#!/usr/bin/env node
/**
 * Compila el servidor (server/index.ts + server/api.ts) a un único bundle
 * CommonJS para Node: server-dist/server.cjs.
 *
 * Todo el árbol (Express incluido) se empaqueta; el SQLite viene del propio
 * runtime (node:sqlite / bun:sqlite, ver src/lib/db.ts), así que el bundle
 * no necesita externos ni node_modules a su lado.
 *
 * Uso:  node scripts/build-server.mjs     (lo llama `bun run build`)
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const resultado = await build({
  entryPoints: [path.join(raiz, "server", "index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: path.join(raiz, "server-dist", "server.cjs"),
  external: ["bun:sqlite"],
  tsconfig: path.join(raiz, "tsconfig.json"),
  sourcemap: false,
  minify: false,
  logLevel: "info",
  absWorkingDir: raiz,
});

if (!resultado || resultado.errors.length > 0) {
  console.error("✗ La compilación del servidor falló.");
  process.exit(1);
}
console.log("✓ Servidor listo: server-dist/server.cjs (node server-dist/server.cjs)");
