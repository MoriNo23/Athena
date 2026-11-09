import { existsSync, mkdirSync, readFileSync, readdirSync } from "fs";
import { createHash, randomUUID } from "crypto";
import path from "path";
import { ficheroDb } from "./data-home";

/**
 * BD sin fricción (change bd-cero-config): el servidor se auto-sirve.
 *
 * Antes, un arranque desde fuente pedía `cp .env.example .env` (con
 * DATABASE_URL) y `bunx prisma db push` — dos pasos técnicos que un
 * lector cualquiera no debería tocar. Ahora:
 *
 *  - `asegurarUrlDb()` (síncrono, antes de construir el PrismaClient):
 *    si no hay DATABASE_URL la fija apuntando a la casa de datos
 *    (XDG/ATHENA_HOME/legacy — ver data-home.ts) y crea la carpeta.
 *    Si la URL ya venía del entorno (Docker, bundle, CLI) se respeta.
 *  - `asegurarEsquemaDb()` (arranque del servidor, antes de listen):
 *    aplica `prisma/migrations/**` a la BD si faltan, con el mismo
 *    registro de `_prisma_migrations` que usa `prisma migrate deploy`
 *    (checksum sha256 del .sql) — así el CLI de Prisma sigue viendo un
 *    estado consistente y `athena init`/`db push` nunca pisan nada.
 *
 * Con esto `bun install && bun run dev` es TODO el onboarding desde
 * fuente: la biblioteca nace en su casa (~/.local/share/athena) sin
 * copiar ni pegar nada.
 */

/** lo mínimo de PrismaClient que el ensure necesita (testeable sin Prisma) */
export interface ClienteSql {
  $queryRawUnsafe(sql: string): Promise<unknown>;
  $executeRawUnsafe(sql: string): Promise<number>;
}

export interface InfoUrlDb {
  /** ruta absoluta (o tal cual vino) del fichero SQLite */
  fichero: string;
  /** true si esta llamada fijó DATABASE_URL (venía vacía) */
  fijada: boolean;
}

/** Fijar DATABASE_URL si nadie la trajo. SIN tocar el esquema. */
export function asegurarUrlDb(): InfoUrlDb {
  const actual = (process.env.DATABASE_URL ?? "").trim();
  if (actual) {
    return { fichero: urlAFichero(actual) ?? actual, fijada: false };
  }
  const fichero = ficheroDb();
  const carpeta = path.dirname(fichero);
  if (!existsSync(carpeta)) mkdirSync(carpeta, { recursive: true });
  process.env.DATABASE_URL = "file:" + fichero;
  return { fichero, fijada: true };
}

/** "file:ruta" → ruta; cualquier otra cosa → null */
export function urlAFichero(url: string): string | null {
  const t = url.trim();
  if (!t.startsWith("file:")) return null;
  return t.slice("file:".length) || null;
}

export interface Migracion {
  /** nombre de la carpeta (0001_init, …) — clave en _prisma_migrations */
  nombre: string;
  sql: string;
  /** sha256 del .sql, el mismo que registra prisma migrate */
  checksum: string;
}

/** Leer las migraciones de una carpeta, ordenadas por nombre. */
export function leerMigraciones(dir: string): Migracion[] {
  if (!existsSync(dir)) return [];
  const out: Migracion[] = [];
  for (const nombre of readdirSync(dir).sort()) {
    const sqlPath = path.join(dir, nombre, "migration.sql");
    if (!existsSync(sqlPath)) continue;
    const sql = readFileSync(sqlPath, "utf8");
    out.push({
      nombre,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }
  return out;
}

/** Carpetas donde buscar `prisma/migrations` según dónde corre el servidor. */
export function carpetasMigraciones(): string[] {
  const candidatos = [
    path.join(process.cwd(), "prisma", "migrations"), // repo y bundle standalone
    path.join(process.cwd(), "..", "prisma", "migrations"),
  ];
  // server-dist/ corriendo desde la raíz del repo ya cae en el primer caso;
  // añadimos el vecino de server-dist por si arrancan desde otra cwd.
  try {
    const propio = path.dirname(typeof __dirname === "string" ? __dirname : "");
    if (propio) {
      candidatos.push(path.resolve(propio, "..", "prisma", "migrations"));
      candidatos.push(path.resolve(propio, "..", "..", "prisma", "migrations"));
    }
  } catch {
    /* ESM puro sin __dirname: los candidatos de cwd bastan */
  }
  return [...new Set(candidatos)];
}

/**
 * Partir un .sql en sentencias sueltas: respeta strings '…' (con escape '')
 * y comentarios `--` de línea. Cada sentencia sale recortada y sin
 * comentarios, lista para $executeRawUnsafe (una sentencia por llamada).
 */
export function partirSql(sql: string): string[] {
  const out: string[] = [];
  let actual = "";
  let enString = false;
  let enComentario = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (enComentario) {
      if (c === "\n") {
        enComentario = false;
        actual += c;
      }
      continue;
    }
    if (enString) {
      actual += c;
      if (c === "'") {
        if (sql[i + 1] === "'") {
          actual += "'";
          i++;
        } else {
          enString = false;
        }
      }
      continue;
    }
    if (c === "-" && sql[i + 1] === "-") {
      enComentario = true;
      i++;
      continue;
    }
    if (c === "'") {
      enString = true;
      actual += c;
      continue;
    }
    if (c === ";") {
      const s = actual.trim();
      if (s) out.push(s);
      actual = "";
      continue;
    }
    actual += c;
  }
  const resto = actual.trim();
  if (resto) out.push(resto);
  return out;
}

/** La tabla de registro de prisma migrate, tal como la crea el CLI. */
const SQL_TABLA_MIGRACIONES = `CREATE TABLE "_prisma_migrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

export interface InfoEsquemaDb {
  /** true si esta llamada creó tablas / registró migraciones */
  aplicado: boolean;
  /** migraciones aplicadas ahora mismo (nombres) */
  migraciones: string[];
  /** carpeta de migraciones usada */
  dirMigraciones: string;
}

async function tablasDe(cliente: ClienteSql): Promise<Set<string>> {
  const filas = (await cliente.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table'"
  )) as { name?: string }[] | Record<string, unknown>[];
  const nombres = new Set<string>();
  if (Array.isArray(filas)) {
    for (const f of filas) {
      const n = (f as Record<string, unknown>)?.name;
      if (typeof n === "string") nombres.add(n);
    }
  }
  return nombres;
}

/**
 * Aplicar el esquema si falta. Idempotente: con la BD al día no escribe
 * nada. Si hay tablas pero falta el registro de prisma (BD creada con
 * `db push` en su día) lo sana registrando las migraciones como aplicadas
 * — el mismo arreglo que hacía `athena migrate-home` a mano.
 */
export async function asegurarEsquemaDb(
  cliente: ClienteSql,
  dirMigraciones?: string
): Promise<InfoEsquemaDb> {
  const dir =
    dirMigraciones ?? carpetasMigraciones().find((d) => existsSync(d)) ?? "";
  const migraciones = leerMigraciones(dir);
  if (migraciones.length === 0) {
    const tablas = await tablasDe(cliente);
    if (tablas.has("Book")) {
      // BD ya viva y sin carpeta de migraciones a la vista (bundle con
      // db push propio): nada que hacer aquí.
      return { aplicado: false, migraciones: [], dirMigraciones: dir };
    }
    throw new Error(
      `No encontré prisma/migrations (busqué en ${carpetasMigraciones().join(", ")}) ` +
        "y la BD está vacía: no puedo crear el esquema. Arranca desde la raíz del repo o usa bin/athena init."
    );
  }

  const tablas = await tablasDe(cliente);
  const tieneRegistro = tablas.has("_prisma_migrations");
  const tieneBook = tablas.has("Book");

  // BD sana y registrada: aplicar solo lo que falte (como migrate deploy)
  const aplicadas = new Set<string>();
  if (tieneRegistro) {
    const filas = (await cliente.$queryRawUnsafe(
      'SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL'
    )) as unknown[];
    for (const f of filas) {
      const n = (f as Record<string, unknown>)?.migration_name;
      if (typeof n === "string") aplicadas.add(n);
    }
  }

  const pendientes = migraciones.filter((m) => !aplicadas.has(m.nombre));
  if (!tieneRegistro && tieneBook && pendientes.length === migraciones.length) {
    // legacy por db push: tablas ya presentes, registro ausente → sanar
    await cliente.$executeRawUnsafe(SQL_TABLA_MIGRACIONES);
    for (const m of migraciones) {
      await registrar(cliente, m);
    }
    return { aplicado: true, migraciones: migraciones.map((m) => m.nombre), dirMigraciones: dir };
  }

  if (pendientes.length === 0) {
    return { aplicado: false, migraciones: [], dirMigraciones: dir };
  }

  if (!tieneRegistro) {
    await cliente.$executeRawUnsafe(SQL_TABLA_MIGRACIONES);
  }
  for (const m of pendientes) {
    for (const sentencia of partirSql(m.sql)) {
      await cliente.$executeRawUnsafe(sentencia);
    }
    await registrar(cliente, m);
  }
  return {
    aplicado: true,
    migraciones: pendientes.map((m) => m.nombre),
    dirMigraciones: dir,
  };
}

/** dejar la migración anotada como aplicada, como haría migrate deploy */
async function registrar(cliente: ClienteSql, m: Migracion): Promise<void> {
  await cliente.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" ("id","checksum","finished_at","migration_name","logs","applied_steps_count") ` +
      `VALUES ('${randomUUID()}','${m.checksum}','${new Date()
        .toISOString()
        .replace("T", " ")
        .replace("Z", "")}','${m.nombre}',NULL,0)`
  );
}
