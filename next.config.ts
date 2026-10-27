import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
