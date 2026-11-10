/**
 * Athena · capa de datos — SQLite puro, sin ORM ni generación de código.
 *
 * Por qué existe (change bd-sin-prisma): el stack anterior (Prisma + engines
 * + postinstall + migraciones) era fricción técnica para quien solo quiere
 * leer. Ahora la BD se abre con el SQLite que YA viene dentro del runtime:
 *   - Node ≥ 23.4  → node:sqlite (integrado, sin dependencias)
 *   - Bun          → bun:sqlite  (nativo de Bun)
 * y el esquema vive AQUÍ como SQL embebido: la BD se crea sola al primer uso.
 *
 * Compatibilidad con bibliotecas anteriores (las creadas por Prisma):
 *   - mismas tablas y columnas (ver ESQUEMA abajo);
 *   - DateTime se guarda como INTEGER de ms desde epoch (formato Prisma);
 *   - los JSON (extras) se guardan como TEXT, como los escribía Prisma;
 *   - una tabla _prisma_migrations preexistente se deja quieta.
 *
 * La API expuesta imita la porción de Prisma que usa server/api.ts y
 * src/lib/library-folder.ts (findMany/findFirst/findUnique/create/update/
 * updateMany/delete/deleteMany/createMany/upsert/count/$queryRaw/
 * $transaction), para que el contrato de /api/** no cambie ni una coma.
 */
import path from "node:path";
import { mkdirSync } from "node:fs";
import { ficheroDb } from "@/core/data-home";

/* ──────────────────────────── conductor SQLite ─────────────────────────── */

/** la mínima interfaz común entre node:sqlite y bun:sqlite */
interface Sentencia {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): unknown;
}
interface Conductor {
  exec(sql: string): void;
  prepare(sql: string): Sentencia;
}

/** cargar el SQLite del runtime SIN import estático (esbuild no debe
    intentar resolver el módulo del runtime que no es el suyo) */
function cargarConductor(fichero: string): Conductor {
  type Req = (modulo: string) => Record<string, unknown>;
  const req: Req | undefined =
    typeof require === "function" ? (require as Req) : undefined;
  if (req) {
    try {
      const C = req("node:sqlite").DatabaseSync as new (f: string) => Conductor;
      return new C(fichero);
    } catch {
      try {
        const C = req("bun:sqlite").Database as new (f: string) => Conductor;
        return new C(fichero);
      } catch {
        /* sigue al error final */
      }
    }
  }
  throw new Error(
    "Este runtime no trae SQLite integrado: usa Node ≥ 23.4 o Bun para Athena."
  );
}

/* ───────────────────────────── fichero y apertura ──────────────────────── */

/** "file:ruta" → ruta; cualquier otra cosa → null (mismo contrato viejo) */
function urlAFichero(url: string): string | null {
  const t = url.trim();
  if (!t.startsWith("file:")) return null;
  return t.slice("file:".length) || null;
}

/** fichero SQLite efectivo: DATABASE_URL (si la traen) o la casa de datos */
function resolverFichero(): string {
  const traida = (process.env.DATABASE_URL ?? "").trim();
  if (traida) return urlAFichero(traida) ?? traida;
  return ficheroDb();
}

interface InfoApertura {
  fichero: string;
  /** true si esta apertura tuvo que crear tablas (BD recién nacida) */
  creada: boolean;
}

let conductor: Conductor | null = null;
let infoApertura: InfoApertura | null = null;

/** conexión (se abre al primer uso, no al importar: los tests hacen chdir) */
function conexion(): Conductor {
  if (conductor) return conductor;
  const fichero = resolverFichero();
  mkdirSync(path.dirname(fichero), { recursive: true });
  conductor = cargarConductor(fichero);
  conductor.exec("PRAGMA journal_mode = WAL");
  conductor.exec("PRAGMA foreign_keys = ON");
  infoApertura = { fichero, creada: aplicarEsquema(conductor) };
  return conductor;
}

/** abre ya (para el banner de arranque); devuelve cómo quedó la BD */
export function iniciarDb(): InfoApertura {
  conexion();
  return infoApertura!;
}

/* ──────────────────────────────── esquema ──────────────────────────────── */

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "coverPath" TEXT,
    "totalPages" INTEGER NOT NULL,
    "currentPage" INTEGER NOT NULL DEFAULT 1,
    "milestones" INTEGER,
    "dailyGoal" INTEGER,
    "companionPath" TEXT,
    "companionPages" INTEGER,
    "extras" JSONB,
    "finishedAt" DATETIME,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" DATETIME,
    "origin" TEXT NOT NULL DEFAULT 'subido',
    "fileHash" TEXT,
    "fileBytes" INTEGER,
    "fileMtime" REAL,
    "fileMissingAt" DATETIME
)`,
  `CREATE TABLE IF NOT EXISTS "Vocab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "bookId" TEXT,
    "bookTitle" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  `CREATE TABLE IF NOT EXISTS "Badge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "readings" INTEGER NOT NULL DEFAULT 1,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Badge_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS "ReadingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "pagesRead" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingSession_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`,
  `CREATE INDEX IF NOT EXISTS "Vocab_createdAt_idx" ON "Vocab"("createdAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Vocab_word_lang_key" ON "Vocab"("word", "lang")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Badge_bookId_key" ON "Badge"("bookId")`,
  `CREATE INDEX IF NOT EXISTS "ReadingSession_bookId_date_idx" ON "ReadingSession"("bookId", "date")`,
];

/** aplica el esquema si falta; devuelve true si creó alguna tabla */
function aplicarEsquema(c: Conductor): boolean {
  const filas = c.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
    name?: string;
  }[];
  const tablas = new Set(filas.map((f) => f.name));
  const faltaba = !tablas.has("Book") || !tablas.has("Vocab") || !tablas.has("Badge") || !tablas.has("ReadingSession");
  for (const sql of ESQUEMA) c.exec(sql);
  return faltaba;
}

/* ─────────────────────────── tipos de las columnas ────────────────────── */

/** columna → cómo se lee/escribe (formato Prisma en SQLite) */
interface Col {
  fecha?: boolean; // DATETIME: ms desde epoch al escribir, Date al leer
  json?: boolean; // JSONB: TEXT al escribir, objeto al leer
}
const FECHA: Col = { fecha: true };
const JSONB: Col = { json: true };

const COLUMNAS: Record<string, Record<string, Col>> = {
  Book: {
    finishedAt: FECHA, createdAt: FECHA, lastReadAt: FECHA, fileMissingAt: FECHA,
    extras: JSONB, fileMtime: {},
  },
  Vocab: { createdAt: FECHA },
  Badge: { earnedAt: FECHA, updatedAt: FECHA },
  ReadingSession: { date: FECHA },
};

/** filas leídas: convierte al tipo que devolvería Prisma */
function filaAMapa(tabla: string, fila: Record<string, unknown>): Record<string, unknown> {
  const tipos = COLUMNAS[tabla];
  const out: Record<string, unknown> = {};
  for (const [col, valor] of Object.entries(fila)) {
    const t = tipos?.[col];
    if (valor === null || valor === undefined) {
      out[col] = null;
    } else if (t?.fecha) {
      out[col] = valor instanceof Date ? valor : new Date(typeof valor === "number" ? valor : Date.parse(String(valor)));
    } else if (t?.json) {
      try {
        out[col] = typeof valor === "string" ? JSON.parse(valor) : valor;
      } catch {
        out[col] = null;
      }
    } else {
      out[col] = valor;
    }
  }
  return out;
}

/** valor TS → valor SQL (formato Prisma) */
function valorASql(tabla: string, col: string, valor: unknown): unknown {
  const t = COLUMNAS[tabla]?.[col];
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  if (valor instanceof Date) return valor.getTime(); // ms epoch, como Prisma
  if (t?.json) return JSON.stringify(valor);
  return valor;
}

/* ─────────────────────────────── utilidades SQL ───────────────────────── */

function idNuevo(): string {
  return "c" + crypto.randomUUID().replace(/-/g, "");
}

function todos<T = unknown>(sql: string, params: unknown[] = []): T[] {
  return conexion().prepare(sql).all(...params) as T[];
}

function ejecutar(sql: string, params: unknown[] = []): number {
  const r = conexion().prepare(sql).run(...params) as { changes?: number };
  return Number(r?.changes ?? 0);
}

/** cláusula WHERE por igualdades: {a:1,b:null} → `"a"=? AND "b" IS NULL` */
function donde(where: Record<string, unknown>): { sql: string; params: unknown[] } {
  const partes: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(where)) {
    if (v === null) partes.push(`"${k}" IS NULL`);
    else partes.push(`"${k}" = ?`);
    if (v !== null) params.push(v);
  }
  return { sql: partes.length ? ` WHERE ${partes.join(" AND ")}` : "", params };
}

/* ──────────────────── definiciones de tabla (columnas) ────────────────── */

const COLS: Record<string, string[]> = {
  Book: [
    "id", "title", "author", "fileName", "filePath", "coverPath", "totalPages",
    "currentPage", "milestones", "dailyGoal", "companionPath", "companionPages",
    "extras", "finishedAt", "readCount", "createdAt", "lastReadAt", "origin",
    "fileHash", "fileBytes", "fileMtime", "fileMissingAt",
  ],
  Vocab: ["id", "word", "lang", "short", "bookId", "bookTitle", "page", "createdAt"],
  Badge: ["id", "bookId", "tier", "readings", "earnedAt", "updatedAt"],
  ReadingSession: ["id", "bookId", "pagesRead", "minutes", "date"],
};

/** valores por omisión al crear (los defaults del schema viejo) */
const DEFAULTS: Record<string, Record<string, () => unknown>> = {
  Book: { id: idNuevo, currentPage: () => 1, readCount: () => 0, origin: () => "subido", createdAt: () => new Date() },
  Vocab: { id: idNuevo, page: () => 1, createdAt: () => new Date() },
  Badge: { id: idNuevo, tier: () => 1, readings: () => 1, earnedAt: () => new Date(), updatedAt: () => new Date() },
  ReadingSession: { id: idNuevo, pagesRead: () => 0, minutes: () => 0, date: () => new Date() },
};

/** columnas que Prisma mantiene solas al actualizar (@updatedAt) */
const ACTUALIZA_SOLO: Record<string, string[]> = { Badge: ["updatedAt"] };

type Datos = Record<string, unknown>;
type Donde = Record<string, unknown>;

/* ───────────────────────── modelo: operaciones base ───────────────────── */

function seleccion(tabla: string, select?: Record<string, boolean>): string {
  const cols = select ? Object.keys(select) : COLS[tabla];
  return cols.map((c) => `"${c}"`).join(", ");
}

function leerFilas(tabla: string, opts: { select?: Record<string, boolean>; where?: Donde; orderBy?: Record<string, "asc" | "desc">; take?: number }): Record<string, unknown>[] {
  const w = donde(opts.where ?? {});
  let sql = `SELECT ${seleccion(tabla, opts.select)} FROM "${tabla}"${w.sql}`;
  const ordenes = Object.entries(opts.orderBy ?? {});
  if (ordenes.length > 0) {
    sql += ` ORDER BY "${ordenes[0][0]}" ${ordenes[0][1] === "asc" ? "ASC" : "DESC"}`;
  }
  if (opts.take) sql += ` LIMIT ${Math.max(0, Math.round(opts.take))}`;
  return todos<Record<string, unknown>>(sql, w.params).map((f) => filaAMapa(tabla, f));
}

function insertar(tabla: string, data: Datos): Record<string, unknown> {
  const registro: Datos = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) registro[k] = v;
  }
  for (const [k, gen] of Object.entries(DEFAULTS[tabla])) {
    if (!(k in registro)) registro[k] = gen();
  }
  const cols = Object.keys(registro);
  const valores = cols.map((k) => valorASql(tabla, k, registro[k]));
  ejecutar(
    `INSERT INTO "${tabla}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    valores
  );
  const viva = leerFilas(tabla, { where: { id: registro.id } })[0];
  return viva ?? registro;
}

function actualizar(tabla: string, where: Donde, data: Datos): Record<string, unknown> {
  const sets: string[] = [];
  const valores: unknown[] = [];
  const dataFinal: Datos = { ...data };
  for (const k of ACTUALIZA_SOLO[tabla] ?? []) {
    if (!Object.keys(data).includes(k)) dataFinal[k] = new Date();
  }
  for (const [k, v] of Object.entries(dataFinal)) {
    if (v === undefined) continue;
    sets.push(`"${k}" = ?`);
    valores.push(valorASql(tabla, k, v));
  }
  const w = donde(where);
  ejecutar(`UPDATE "${tabla}" SET ${sets.join(", ")}${w.sql}`, [...valores, ...w.params]);
  const fila = leerFilas(tabla, { where });
  return fila[0] ?? { ...where, ...dataFinal };
}

/* ───────────────────────────── relaciones (include) ─────────────────── */

/** junta las insignias de una tanda de libros (una sola query) */
function insigniasDe(libros: Record<string, unknown>[]): void {
  const ids = libros.map((l) => String(l.id));
  if (ids.length === 0) return;
  const marcas = ids.map(() => "?").join(", ");
  const filas = todos<Record<string, unknown>>(
    `SELECT ${seleccion("Badge")} FROM "Badge" WHERE "bookId" IN (${marcas})`,
    ids
  );
  const porLibro = new Map(filas.map((f) => [String(f.bookId), filaAMapa("Badge", f)]));
  for (const l of libros) l.badge = porLibro.get(String(l.id)) ?? null;
}

/** junta las sesiones (subset de columnas si el select lo pide; bookId
    siempre viaja para poder agrupar por libro) */
function sesionesDe(libros: Record<string, unknown>[], select?: Record<string, boolean>): void {
  const ids = libros.map((l) => String(l.id));
  if (ids.length === 0) return;
  const marcas = ids.map(() => "?").join(", ");
  const columnas = select
    ? [...new Set(["bookId", ...Object.keys(select)])].map((c) => `"${c}"`).join(", ")
    : seleccion("ReadingSession");
  const filas = todos<Record<string, unknown>>(
    `SELECT ${columnas} FROM "ReadingSession" WHERE "bookId" IN (${marcas}) ORDER BY "date" ASC`,
    ids
  );
  const porLibro = new Map<string, Record<string, unknown>[]>();
  for (const f of filas) {
    const lista = porLibro.get(String(f.bookId)) ?? [];
    lista.push(filaAMapa("ReadingSession", f));
    porLibro.set(String(f.bookId), lista);
  }
  for (const l of libros) l.sessions = porLibro.get(String(l.id)) ?? [];
}

type Include = { badge?: boolean; sessions?: boolean | { select?: Record<string, boolean> } } | undefined;

function aplicarInclude(tabla: string, filas: Record<string, unknown>[], include?: Include): void {
  if (tabla !== "Book" || !include) return;
  if (include.badge) insigniasDe(filas);
  if (include.sessions) {
    const sel = typeof include.sessions === "object" ? include.sessions.select : undefined;
    sesionesDe(filas, sel);
  }
}

/* ────────────── el objeto db: entradas holgadas, salidas tipadas ───────── */

/** where de clave única: findUnique({ where: { id } | { bookId } }) */
function claveUnica(tabla: string, where: Donde): Donde {
  if ("id" in where) return { id: where.id };
  if (tabla === "Badge" && "bookId" in where) return { bookId: where.bookId };
  return where;
}

async function findMany(tabla: string, opts: { where?: Donde; orderBy?: Record<string, "asc" | "desc">; select?: Record<string, boolean>; include?: Include; take?: number } = {}): Promise<Datos[]> {
  const filas = leerFilas(tabla, { where: opts.where, orderBy: opts.orderBy, select: opts.select, take: opts.take });
  aplicarInclude(tabla, filas, opts.include);
  return filas as Datos[];
}

async function findFirst(tabla: string, opts: { where?: Donde; select?: Record<string, boolean> } = {}): Promise<Datos | null> {
  const filas = leerFilas(tabla, { where: opts.where, select: opts.select, take: 1 });
  return (filas[0] as Datos) ?? null;
}

async function findUnique(tabla: string, opts: { where: Donde; select?: Record<string, boolean>; include?: Include }): Promise<Datos | null> {
  const filas = leerFilas(tabla, { where: claveUnica(tabla, opts.where), select: opts.select });
  aplicarInclude(tabla, filas, opts.include);
  return (filas[0] as Datos) ?? null;
}

async function create(tabla: string, opts: { data: Datos }): Promise<Datos> {
  return insertar(tabla, opts.data) as Datos;
}

async function update(tabla: string, opts: { where: Donde; data: Datos }): Promise<Datos> {
  return actualizar(tabla, claveUnica(tabla, opts.where), opts.data) as Datos;
}

async function updateMany(tabla: string, opts: { data: Datos }): Promise<{ count: number }> {
  const sets: string[] = [];
  const valores: unknown[] = [];
  for (const [k, v] of Object.entries(opts.data)) {
    if (v === undefined) continue;
    sets.push(`"${k}" = ?`);
    valores.push(valorASql(tabla, k, v));
  }
  if (sets.length === 0) return { count: 0 };
  const count = ejecutar(`UPDATE "${tabla}" SET ${sets.join(", ")}`, valores);
  return { count };
}

async function borrar(tabla: string, opts: { where: Donde }): Promise<Datos | null> {
  const fila = leerFilas(tabla, { where: claveUnica(tabla, opts.where) })[0];
  const w = donde(opts.where);
  ejecutar(`DELETE FROM "${tabla}"${w.sql}`, w.params);
  return (fila as Datos) ?? null;
}

async function deleteMany(tabla: string, opts: { where?: Donde } = {}): Promise<{ count: number }> {
  const w = donde(opts.where ?? {});
  const count = ejecutar(`DELETE FROM "${tabla}"${w.sql}`, w.params);
  return { count };
}

async function createMany(tabla: string, opts: { data: Datos[] }): Promise<{ count: number }> {
  if (opts.data.length === 0) return { count: 0 };
  // una sentencia preparada, muchas filas (hasta 1000 en el import de vocab);
  // las filas comparten columnas: las que falten caen en su default
  const claves = new Set<string>();
  for (const d of opts.data) for (const k of Object.keys(d)) claves.add(k);
  const nombres = [...claves];
  for (const k of Object.keys(DEFAULTS[tabla])) {
    if (!nombres.includes(k) && opts.data.some((d) => d[k] === undefined)) nombres.push(k);
  }
  const st = conexion().prepare(
    `INSERT INTO "${tabla}" (${nombres.map((c) => `"${c}"`).join(", ")}) VALUES (${nombres.map(() => "?").join(", ")})`
  );
  let count = 0;
  for (const d of opts.data) {
    const valores = nombres.map((k) => {
      const v = d[k] !== undefined ? d[k] : DEFAULTS[tabla][k]?.();
      const sql = valorASql(tabla, k, v);
      return sql === undefined ? null : sql;
    });
    st.run(...valores);
    count++;
  }
  return { count };
}

async function count(tabla: string, opts: { where?: Donde } = {}): Promise<number> {
  const w = donde(opts.where ?? {});
  const fila = todos<{ n: number }>(`SELECT COUNT(*) AS n FROM "${tabla}"${w.sql}`, w.params)[0];
  return Number(fila?.n ?? 0);
}

async function upsertBadge(opts: { where: Donde; create: Datos; update: Datos }): Promise<Datos> {
  const ya = leerFilas("Badge", { where: claveUnica("Badge", opts.where) })[0];
  if (ya) {
    return actualizar("Badge", claveUnica("Badge", opts.where), opts.update) as Datos;
  }
  return insertar("Badge", opts.create) as Datos;
}

/** $queryRaw: solo con SQL fijo (template sin interpolaciones) */
async function queryRaw<T = unknown>(partes: TemplateStringsArray): Promise<T> {
  return todos<T>(partes.join("")) as unknown as T;
}

/* ──────────────── la fachada db (salidas tipadas) ───────────────────── */

export interface Libro {
  id: string;
  title: string;
  author: string | null;
  fileName: string;
  filePath: string;
  coverPath: string | null;
  totalPages: number;
  currentPage: number;
  milestones: number | null;
  dailyGoal: number | null;
  companionPath: string | null;
  companionPages: number | null;
  extras: unknown;
  finishedAt: Date | null;
  readCount: number;
  createdAt: Date;
  lastReadAt: Date | null;
  origin: string;
  fileHash: string | null;
  fileBytes: number | null;
  fileMtime: number | null;
  fileMissingAt: Date | null;
  badge?: Insignia | null;
  sessions?: SesionLectura[];
}

export interface VocabFila {
  id: string;
  word: string;
  lang: string;
  short: string;
  bookId: string | null;
  bookTitle: string;
  page: number;
  createdAt: Date;
}

export interface Insignia {
  id: string;
  bookId: string;
  tier: number;
  readings: number;
  earnedAt: Date;
  updatedAt: Date;
}

export interface SesionLectura {
  id: string;
  bookId: string;
  pagesRead: number;
  minutes: number;
  date: Date;
}

type Buscar = {
  where?: Donde;
  orderBy?: Record<string, "asc" | "desc">;
  select?: Record<string, boolean>;
  include?: Include;
  take?: number;
};

export interface ModeloDb<T> {
  findMany<TOut = T>(o?: Buscar): Promise<TOut[]>;
  findFirst(o?: { where?: Donde; select?: Record<string, boolean> }): Promise<T | null>;
  findUnique<TOut = T>(o: { where: Donde; select?: Record<string, boolean>; include?: Include }): Promise<TOut | null>;
  create(o: { data: Donde }): Promise<T>;
  update(o: { where: Donde; data: Donde }): Promise<T>;
  updateMany(o: { data: Donde }): Promise<{ count: number }>;
  delete(o: { where: Donde }): Promise<T | null>;
  deleteMany(o?: { where?: Donde }): Promise<{ count: number }>;
  createMany(o: { data: Donde[] }): Promise<{ count: number }>;
  count(o?: { where?: Donde }): Promise<number>;
  upsert(o: { where: Donde; create: Donde; update: Donde }): Promise<T>;
}

export interface Db {
  book: ModeloDb<Libro>;
  vocab: ModeloDb<VocabFila>;
  badge: ModeloDb<Insignia>;
  readingSession: ModeloDb<SesionLectura>;
  $queryRaw: <T = unknown>(partes: TemplateStringsArray) => Promise<T>;
  $transaction: {
    <T>(fn: (tx: Db) => Promise<T>): Promise<T>;
    <T extends unknown[]>(ops: { [K in keyof T]: Promise<T[K]> }): Promise<T>;
  };
}

function crearModelo<T>(tabla: string): ModeloDb<T> {
  return {
    findMany: async <TOut = T>(o: Buscar = {}): Promise<TOut[]> =>
      (await findMany(tabla, o)) as unknown as TOut[],
    findFirst: async (o: { where?: Donde; select?: Record<string, boolean> } = {}): Promise<T | null> =>
      (await findFirst(tabla, o)) as unknown as T | null,
    findUnique: async <TOut = T>(o: { where: Donde; select?: Record<string, boolean>; include?: Include }): Promise<TOut | null> =>
      (await findUnique(tabla, o)) as unknown as TOut | null,
    create: async (o: { data: Donde }): Promise<T> => (await create(tabla, o)) as unknown as T,
    update: async (o: { where: Donde; data: Donde }): Promise<T> => (await update(tabla, o)) as unknown as T,
    updateMany: async (o: { data: Donde }): Promise<{ count: number }> => updateMany(tabla, o),
    delete: async (o: { where: Donde }): Promise<T | null> => (await borrar(tabla, o)) as unknown as T | null,
    deleteMany: async (o: { where?: Donde } = {}): Promise<{ count: number }> => deleteMany(tabla, o),
    createMany: async (o: { data: Donde[] }): Promise<{ count: number }> => createMany(tabla, o),
    count: async (o: { where?: Donde } = {}): Promise<number> => count(tabla, o),
    upsert: async (o: { where: Donde; create: Donde; update: Donde }): Promise<T> =>
      (await upsertBadge(o)) as unknown as T,
  };
}

async function transactionImpl<T>(algo: unknown): Promise<T> {
  const c = conexion();
  if (typeof algo === "function") {
    c.exec("BEGIN");
    try {
      const r = await (algo as (tx: Db) => Promise<T>)(db as unknown as Db);
      c.exec("COMMIT");
      return r;
    } catch (e) {
      try {
        c.exec("ROLLBACK");
      } catch {
        /* ya deshecha */
      }
      throw e;
    }
  }
  if (Array.isArray(algo)) {
    // las promesas ya nacieron (el conductor es síncrono: cada sentencia es
    // atómica por sí misma); se esperan juntas como hacía Prisma.
    return Promise.all(algo as Promise<T>[]) as T;
  }
  throw new Error("$transaction: función o lista de promesas");
}

export const db: Db = {
  book: crearModelo<Libro>("Book"),
  vocab: crearModelo<VocabFila>("Vocab"),
  badge: crearModelo<Insignia>("Badge"),
  readingSession: crearModelo<SesionLectura>("ReadingSession"),
  $queryRaw: queryRaw,
  $transaction: transactionImpl as Db["$transaction"],
};

/** solo para tests: olvida la conexión para apuntar a otra BD (sandbox) */
export function _resetDbParaTests(): void {
  conductor = null;
  infoApertura = null;
}
