import type { NextConfig } from "next";

/**
 * Dos builds de la casa:
 *
 *  - Self-host (normal): `output: "standalone"` con API y proxy — el servidor
 *    de siempre (`bun run dev` / `bun run build` + `start`).
 *
 *  - APK (ATHENA_STATIC=1): export estático sin servidor. Las rutas api/, el
 *    proxy y la página de login se apartan en el build (scripts/build-apk-web.mjs)
 *    y el motor offline (public/athena-offline.js) responde /api/* localmente
 *    dentro del WebView de Capacitor: IndexedDB para datos, OPFS para ficheros.
 */
const esApk = process.env.ATHENA_STATIC === "1";

const nextConfig: NextConfig = esApk
  ? {
      output: "export",
      reactStrictMode: true,
      // sin optimizador de imágenes: no hay servidor que ejecute sharp
      images: { unoptimized: true },
    }
  : {
      output: "standalone",
      reactStrictMode: true,
      experimental: {
        // El candado (src/proxy.ts) corre en Node.js y en Next 16 cada POST que
        // pasa por el proxy clona su body con un tope por defecto de 10MB
        // (proxyClientMaxBodySize), aunque el proxy solo lea cookies. Un libro
        // de más de 10MB llegaba truncado a POST /api/books y formData() fallaba:
        // ni PDF ni EPUB pesados subían (error 500). Damos margen sobre el tope
        // de 200MB del API (fichero + portada + sobrecoste de multipart).
        proxyClientMaxBodySize: "256mb",
      },
    };

export default nextConfig;
