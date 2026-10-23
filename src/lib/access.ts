/**
 * Candado del API (change auth-api, extendido en modo-normal-lan):
 * - la sesión es stateless: la cookie guarda un hash derivado de la contraseña;
 *   comparación en tiempo constante vía digest de 32 bytes.
 * - la contraseña efectiva depende del modo de arranque (design §2 del change
 *   modo-normal-lan): `ATENA_PASSWORD` del .env manda; en modo lan sin ella se
 *   genera una aleatoria que persiste en db/atena-lock; el resto = abierto.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, openSync, readFileSync, writeSync, closeSync } from "node:fs";

export const COOKIE_SESION = "atena_session";
export const ARCHIVO_CONTRASEÑA = "db/atena-lock";
const SEMILLA_COOKIE = "atena-cookie-v1";

/** valor de cookie que deriva de la contraseña (hex) */
export function cookieDe(password: string): string {
  return createHash("sha256").update(`${password}:${SEMILLA_COOKIE}`).digest("hex");
}

/** comparación en tiempo constante de dos strings (digests de igual longitud) */
export function igualEnTiempoConstante(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/**
 * garantiza la contraseña autogenerada en db/atena-lock y la devuelve.
 * Race-free: la creación usa flag `wx` (falla si otro proceso ganó) y después
 * se lee el archivo, así varios arranques concurrentes convergen en una sola.
 */
export function garantizaContraseña(): string {
  try {
    return readFileSync(ARCHIVO_CONTRASEÑA, "utf8").trim();
  } catch {
    // no existe aún: crearla
  }
  mkdirSync("db", { recursive: true });
  const generada = randomBytes(9).toString("base64url");
  try {
    const fd = openSync(ARCHIVO_CONTRASEÑA, "wx", 0o600);
    writeSync(fd, generada);
    closeSync(fd);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  return readFileSync(ARCHIVO_CONTRASEÑA, "utf8").trim();
}

/**
 * contraseña que rige el candado en este arranque (design §2):
 * 1. ATENA_PASSWORD no vacía → esa (elección del usuario, cualquier modo).
 * 2. modo lan sin contraseña → autogenerada y persistida (garantizaContraseña).
 * 3. resto (modo normal sin contraseña) → "" = abierto, solo localhost.
 */
export function contraseñaEfectiva(): string {
  const fija = (process.env.ATENA_PASSWORD ?? "").trim();
  if (fija) return fija;
  if ((process.env.ATENA_MODO ?? "offline") === "lan") return garantizaContraseña();
  return "";
}
