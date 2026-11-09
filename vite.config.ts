import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * Vite reemplaza a Next.js: la web de Athena es una SPA cliente (la única
 * página de verdad es la biblioteca + lector; /login es la puerta del
 * candado y solo existe en el servidor self-host).
 *
 * Dos builds con la misma config:
 *  - self-host (default)      → dist/ (index.html + login.html) que sirve
 *    Express (server/index.ts);
 *  - APK (`--mode apk`)       → out/ (solo index.html, sin login ni API) que
 *    sincroniza Capacitor; el motor offline (public/athena-offline.js) se
 *    inyecta como script síncrono desde scripts/build-apk-web.mjs.
 */
export default defineConfig(({ mode }) => {
  const esApk = mode === "apk";
  // entradas: la app siempre; el login solo en el servidor self-host (el
  // APK no tiene candado ni página de login)
  const input: Record<string, string> = { main: path.resolve(__dirname, "index.html") };
  if (!esApk) input.login = path.resolve(__dirname, "login.html");
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    build: {
      outDir: esApk ? "out" : "dist",
      emptyOutDir: true,
      rollupOptions: { input },
    },
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        // en dev el API corre en Bun (server/index.ts) y Vite solo proxya
        "/api": { target: "http://127.0.0.1:3001", changeOrigin: false },
      },
    },
  };
});
