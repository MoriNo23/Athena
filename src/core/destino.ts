/**
 * Destino seguro tras el login (`next`): solo rutas relativas internas
 * (empiezan por "/" y sin "//" inicial); cualquier otra cosa → null.
 *
 * Módulo PURO (sin node:*): lo usan el servidor (login.html ya no tiene página
 * de servidor que valide) y el cliente (login-main.tsx) — una sola fuente de
 * verdad para la misma regla. Antes vivía en core/access.ts.
 */
export function siguienteSeguro(v: string | null | undefined): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//")) return null;
  // `new URL` normaliza "\" a "/" — `/\evil.com` acabaría navegando fuera; los
  // caracteres de control no tienen sitio en una URL tecleada por una persona.
  // la regex de control es a propósito: caracteres de control no tienen
  // sitio en una URL tecleada por una persona
  // eslint-disable-next-line no-control-regex
  if (v.includes("\\") || /[\u0000-\u001f]/.test(v)) return null;
  return v;
}
