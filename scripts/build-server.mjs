#!/usr/bin/env node
/**
 * Compila el servidor (server/index.ts + server/api.ts) a un único bundle
 * CommonJS para Node: server-dist/server.cjs.
 *
 * Todo el árbol (Express incluido) se empaqueta; solo @prisma/client y
 * .prisma/client quedan externos — su motor binario y su cierre viven en
 * node_modules (los empaquetados standalone y Docker los llevan consigo).
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
  target: "node20",
  format: "cjs",
  outfile: path.join(raiz, "server-dist", "server.cjs"),
  external: ["@prisma/client", ".prisma/client", "prisma"],
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
