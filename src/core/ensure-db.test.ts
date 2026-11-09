import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  asegurarEsquemaDb,
  carpetasMigraciones,
  leerMigraciones,
  partirSql,
  urlAFichero,
  type ClienteSql,
} from "./ensure-db";

// migraciones reales del repo (src/core → ../../prisma/migrations)
const RAIZ = path.resolve(import.meta.dir, "..", "..");
const DIR_MIGRACIONES = path.join(RAIZ, "prisma", "migrations");

describe("partirSql", () => {
  test("parte sentencias CREATE TABLE e índices", () => {
    const sql = `-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "origin" TEXT NOT NULL DEFAULT 'subido'
);
-- CreateIndex
CREATE UNIQUE INDEX "Vocab_word_lang_key" ON "Vocab"("word", "lang");`;
    const partes = partirSql(sql);
    expect(partes.length).toBe(2);
    expect(partes[0].startsWith("CREATE TABLE")).toBe(true);
    expect(partes[0]).toContain("'subido'");
    expect(partes[0]).not.toContain("--");
    expect(partes[1].startsWith("CREATE UNIQUE INDEX")).toBe(true);
  });

  test("un ';' dentro de un string NO parte la sentencia", () => {
    const partes = partirSql(
      `INSERT INTO "t" VALUES ('hola;mundo');\nINSERT INTO "t" VALUES ('dos');`
    );
    expect(partes.length).toBe(2);
    expect(partes[0]).toContain("'hola;mundo'");
  });

  test("escape '' dentro de strings se conserva", () => {
    const partes = partirSql(`INSERT INTO "t" VALUES ('it''s;fine');`);
    expect(partes.length).toBe(1);
    expect(partes[0]).toContain("'it''s;fine'");
  });

  test("comentarios de línea desaparecen y el resto se ejecuta", () => {
    const partes = partirSql(`-- solo comentario\nCREATE TABLE "x" ("a" TEXT);`);
    expect(partes).toEqual([`CREATE TABLE "x" ("a" TEXT)`]);
  });
});

describe("leerMigraciones", () => {
  test("encuentra la migración base del repo con su checksum", () => {
    const migraciones = leerMigraciones(DIR_MIGRACIONES);
    expect(migraciones.length).toBeGreaterThanOrEqual(1);
    expect(migraciones[0].nombre).toBe("0001_init");
    expect(migraciones[0].checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(migraciones[0].sql).toContain(`CREATE TABLE "Book"`);
  });

  test("carpetas candidatas incluyen <raíz>/prisma/migrations", () => {
    const candidatas = carpetasMigraciones();
    expect(candidatas.some((c) => c.endsWith(path.join("prisma", "migrations")))).toBe(true);
  });
});

describe("urlAFichero", () => {
  test("file: absoluta y relativa", () => {
    expect(urlAFichero("file:/home/z/athena/custom.db")).toBe("/home/z/athena/custom.db");
    expect(urlAFichero("file:../db/custom.db")).toBe("../db/custom.db");
    expect(urlAFichero("postgres://x")).toBeNull();
    expect(urlAFichero("file:")).toBeNull();
  });
});

// ------------------------------------------------------------------
// Integración real: SQLite de verdad + Prisma de verdad + CLI de verdad.
// Comprueba que lo que deja asegurarEsquemaDb es EXACTAMENTE lo que el
// CLI de prisma espera ver (ningún falso positivo).
// ------------------------------------------------------------------

const CAJA = path.join(RAIZ, ".tmp-ensure-db-test");
const BD_FRESHA = path.join(CAJA, "fresh.db");
const BD_DBPUSH = path.join(CAJA, "dbpush.db");
const clientes: PrismaClient[] = [];

afterAll(async () => {
  for (const c of clientes) await c.$disconnect().catch(() => {});
  rmSync(CAJA, { recursive: true, force: true });
});

/** cliente Prisma nuevo apuntando a esta URL (sin singleton de por medio) */
async function crearCliente(url: string): Promise<ClienteSql> {
  process.env.DATABASE_URL = url;
  const cliente = new PrismaClient();
  clientes.push(cliente);
  return cliente as unknown as ClienteSql;
}

test("integración: BD nueva desde cero → esquema + registro legible por prisma", async () => {
  mkdirSync(CAJA, { recursive: true });
  const cliente = await crearCliente("file:" + BD_FRESHA);

  const primera = await asegurarEsquemaDb(cliente, DIR_MIGRACIONES);
  expect(primera.aplicado).toBe(true);
  expect(primera.migraciones).toContain("0001_init");

  // idempotente: la segunda vuelta no toca nada
  const segunda = await asegurarEsquemaDb(cliente, DIR_MIGRACIONES);
  expect(segunda.aplicado).toBe(false);
  expect(segunda.migraciones).toEqual([]);

  // el CLI de prisma ve el estado como consistente (0 pendientes)
  const deploy = Bun.spawnSync({
    cmd: ["bunx", "prisma", "migrate", "deploy"],
    cwd: RAIZ,
    env: { ...process.env, DATABASE_URL: "file:" + BD_FRESHA },
    stdout: "pipe",
    stderr: "pipe",
  });
  const texto = new TextDecoder().decode(deploy.stdout) + new TextDecoder().decode(deploy.stderr);
  expect(deploy.exitCode).toBe(0);
  expect(texto).not.toContain("following migration");
}, 60000);

test("integración: BD legacy de db push se sana sin recrear tablas", async () => {
  // una BD como las de siempre: tablas por `db push`, sin _prisma_migrations
  const push = Bun.spawnSync({
    cmd: ["bunx", "prisma", "db", "push", "--skip-generate"],
    cwd: RAIZ,
    env: { ...process.env, DATABASE_URL: "file:" + BD_DBPUSH },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(push.exitCode).toBe(0);

  const cliente = await crearCliente("file:" + BD_DBPUSH);
  const resultado = await asegurarEsquemaDb(cliente, DIR_MIGRACIONES);
  expect(resultado.aplicado).toBe(true); // sanó el registro
  // y sin tocar las tablas existentes: la segunda vuelta ya es no-op
  const otra = await asegurarEsquemaDb(cliente, DIR_MIGRACIONES);
  expect(otra.aplicado).toBe(false);

  // prisma también la da por buena
  const deploy = Bun.spawnSync({
    cmd: ["bunx", "prisma", "migrate", "deploy"],
    cwd: RAIZ,
    env: { ...process.env, DATABASE_URL: "file:" + BD_DBPUSH },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(deploy.exitCode).toBe(0);
}, 60000);
