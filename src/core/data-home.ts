import { existsSync } from "fs";
import os from "os";
import path from "path";

/**
 * ATHENA_HOME — la casa de los datos (change athena-home-cli).
 *
 * Hoy todo vive DENTRO del repo: la BD en `db/custom.db`, la config en
 * `db/config.json`, los ficheros subidos en `public/uploads/`. Eso está bien
 * para quien desarrolla, pero un instalador del tarball/.deb no debería
 * escribir datos dentro del árbol del programa (se pisa con cada `git pull`,
 * se va con cada clonación y complica los backups).
 *
 * Resolución (en orden, la primera que aplica gana):
 *  1. `ATHENA_HOME` definido → esa carpeta (se crea bajo demanda).
 *  2. Modo test (`bun test` / NODE_ENV=test) → rutas legacy relativas: los
 *     tests hacen chdir a su sandbox y el patrón relativo se conserva.
 *  3. Datos legacy en el repo (`db/custom.db` existe) → rutas legacy
 *     relativas: una instalación existente NO se mueve sola nunca.
 *  4. Docker (`/.dockerenv`) → legacy: el contenedor fija su DATABASE_URL y
 *     sus volúmenes (ver docker-compose.yml).
 *  5. Default XDG: `$XDG_DATA_HOME/athena` o `~/.local/share/athena`.
 *
 * En modo home: la BD en `<home>/db/custom.db`, la config en `<home>/db/`,
 * los subidos en `<home>/uploads`. Los URLs de la app NO cambian:
 * `/uploads/<nombre>` sigue siendo el identificador lógico que el API sirve
 * por stream (nunca estático) — solo cambia dónde toca el disco el servidor.
 *
 * El CLI `bin/athena` (init · start · doctor · backup · migrate-home) usa la
 * MISMA resolución y orquesta la migración de una instalación legacy.
 */

export interface EntradasCasa {
  /** env ATHENA_HOME (gana siempre si viene definida) */
  athenaHome?: string;
  /** env XDG_DATA_HOME (base del default XDG) */
  xdgDataHome?: string;
  /** env HOME (fallback del default XDG) */
  home?: string;
  /** ¿existe db/custom.db bajo el cwd? (instalación legacy en el repo) */
  hayLegacy: boolean;
  /** ¿corre dentro de un contenedor Docker? */
  esDocker: boolean;
  /** ¿bajo `bun test` o NODE_ENV=test? */
  esTest: boolean;
}

export const NOMBRE_DB = "custom.db";
export const NOMBRE_CASA = "athena";

/**
 * Resolver PURO (sin tocar env ni disco): devuelve la carpeta casa, o null
 * en modo legacy. Las rutas legacy se devuelven RELATIVAS a propósito (se
 * re-resuelven contra el cwd en cada llamada — el patrón de config-file.ts
 * que permite a los tests apuntar a su sandbox con chdir).
 */
export function resuelveCasa(e: EntradasCasa): string | null {
  const explicita = e.athenaHome?.trim();
  if (explicita) return path.resolve(explicita);
  if (e.esTest) return null;
  if (e.hayLegacy) return null;
  if (e.esDocker) return null;
  const base = e.xdgDataHome?.trim() || path.join(e.home || os.homedir(), ".local", "share");
  return path.join(base, NOMBRE_CASA);
}

/** ¿bajo un runner de tests? (bun test fija NODE_ENV=test; por si acaso,
    también se pregunta al runtime de Bun directamente) */
export function esTest(): boolean {
  if (process.env.NODE_ENV === "test") return true;
  const bun = (globalThis as { Bun?: { isTest?: boolean } }).Bun;
  return bun?.isTest === true;
}

/** entradas reales del proceso (el único punto que toca env/disco) */
function entradas(): EntradasCasa {
  return {
    athenaHome: process.env.ATHENA_HOME,
    xdgDataHome: process.env.XDG_DATA_HOME,
    home: process.env.HOME,
    hayLegacy: existsSync(path.join(process.cwd(), "db", NOMBRE_DB)),
    esDocker: existsSync("/.dockerenv"),
    esTest: esTest(),
  };
}

/** carpeta casa resuelta para este proceso, o null = modo legacy */
export function casaDatos(): string | null {
  return resuelveCasa(entradas());
}

export function esModoHome(): boolean {
  return casaDatos() !== null;
}

/** Raíz de datos: "db" (legacy, relativa) o <casa>/db (absoluta). De aquí
    cuelgan config.json, athena-lock, undo/, undo-trash/. */
export function raizDatos(): string {
  const casa = casaDatos();
  return casa ? path.join(casa, "db") : "db";
}

/** Raíz de ficheros subidos: "public/uploads" (legacy, relativa) o
    <casa>/uploads (absoluta). El URL lógico /uploads/<nombre> no cambia. */
export function raizUploads(): string {
  const casa = casaDatos();
  return casa ? path.join(casa, "uploads") : path.join("public", "uploads");
}

/** Fichero SQLite ABSOLUTO (para DATABASE_URL=file:...). */
export function ficheroDb(): string {
  const casa = casaDatos();
  return casa
    ? path.join(casa, "db", NOMBRE_DB)
    : path.resolve(process.cwd(), "db", NOMBRE_DB);
}
