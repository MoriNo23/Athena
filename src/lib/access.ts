/**
 * Candado del API (change auth-api, extendido en candado-completo-y-athena):
 * - la sesión es stateless: la cookie guarda un hash derivado de la contraseña;
 *   comparación en tiempo constante vía digest de 32 bytes.
 * - la contraseña efectiva depende del modo de arranque: ATHENA_PASSWORD del
 *   .env manda (fallback legado ATENA_PASSWORD); en modo lan sin ella se
 *   genera una aleatoria que persiste en db/athena-lock; ATHENA_ABIERTO=1
 *   abre el lan sin candado. El resto = abierto.
 * - nombres renombrados a Athena con fallback de lectura a los viejos:
 *   cookie atena_session sigue vidiendo, y db/atena-lock se transcribe una vez.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, openSync, readFileSync, writeSync, closeSync } from "node:fs";

export const COOKIE_SESION = "athena_session";
export const ARCHIVO_CONTRASEÑA = "db/athena-lock";
const ARCHIVO_LEGADO = "db/atena-lock";
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
 * garantiza la contraseña autogenerada en db/athena-lock y la devuelve.
 * Respeta la instalación vieja: si ya existía db/atena-lock (legado), su
 * contenido manda y se transcribe al nombre nuevo.
 * Race-free: la creación usa flag `wx` (falla si otro proceso ganó) y después
 * se lee el archivo, así varios arranques concurrentes convergen en una sola.
 */
export function garantizaContraseña(): string {
  const nueva = lee(ARCHIVO_CONTRASEÑA);
  if (nueva) return nueva;
  const legada = lee(ARCHIVO_LEGADO);
  mkdirSync("db", { recursive: true });
  try {
    const fd = openSync(ARCHIVO_CONTRASEÑA, "wx", 0o600);
    try {
      writeSync(fd, legada ?? randomBytes(9).toString("base64url"));
    } finally {
      closeSync(fd);
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  return lee(ARCHIVO_CONTRASEÑA) ?? "";
}

function lee(ruta: string): string | null {
  try {
    const contenido = readFileSync(ruta, "utf8").trim();
    return contenido || null;
  } catch {
    return null;
  }
}

/** env renombrado con fallback de lectura al nombre legado */
function envDe(nueva: string, legada: string): string | undefined {
  const v = process.env[nueva];
  if (v !== undefined) return v;
  return process.env[legada];
}

/**
 * contraseña que rige el candado en este arranque:
 * 1. ATHENA_PASSWORD (o ATENA_PASSWORD legado) no vacía → esa, aunque haya
 *    ABIERTO=1 (la elección explícita de la dueña manda).
 * 2. modo lan: ATHENA_ABIERTO=1 (o ATENA_ABIERTO) → abierto sin candado;
 *    sin ella → autogenerada y persistida (garantizaContraseña).
 * 3. resto (modo normal sin contraseña) → "" = abierto, solo localhost.
 */
export function contraseñaEfectiva(): string {
  const fija = (envDe("ATHENA_PASSWORD", "ATENA_PASSWORD") ?? "").trim();
  if (fija) return fija;
  if ((envDe("ATHENA_MODO", "ATENA_MODO") ?? "offline") === "lan") {
    if (envDe("ATHENA_ABIERTO", "ATENA_ABIERTO") === "1") return "";
    return garantizaContraseña();
  }
  return "";
}

/**
 * destino seguro tras el login (`next`): solo rutas relativas internas
 * (empiezan por "/" y sin "//" inicial); cualquier otra cosa → null.
 */
export function siguienteSeguro(v: string | null | undefined): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//")) return null;
  return v;
}

/** un recurso estático es una ruta cuyo último tramo lleva extensión */
export function esRecursoEstático(pathname: string): boolean {
  const tramo = pathname.split("/").pop() ?? "";
  return tramo.includes(".") ;
}
