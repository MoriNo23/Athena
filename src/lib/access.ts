/**
 * Candado del API (change auth-api, design §1): opt-in por ATENA_PASSWORD.
 * La sesión es stateless: la cookie guarda un hash derivado de la contraseña;
 * la comparación es en tiempo constante vía digest de 32 bytes (design §2).
 * Sin env, las rutas quedan abiertas (comportamiento actual).
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const COOKIE_SESION = "atena_session";
const SEMILLA_COOKIE = "atena-cookie-v1";

/** valor de cookie que deriva de la contraseña (hex) */
export function cookieDe(password: string): string {
  return createHash("sha256").update(`${password}:${SEMILLA_COOKIE}`).digest("hex");
}

/** comparación en tiempo constante de dos strings (digests de igual longitud) */
export function igualEnTiempoConstante(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
