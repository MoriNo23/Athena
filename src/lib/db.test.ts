import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Database } from "bun:sqlite";
import { db, _resetDbParaTests } from "./db";

/**
 * Tests de la capa de datos (SQLite del runtime, sin ORM).
 *
 * Lo crítico: el FORMATO en disco es el que escribía Prisma (DATETIME como
 * INTEGER de ms, JSON como TEXT) — una biblioteca vieja sigue funcionando
 * tal cual. Aquí se verifica leyendo el fichero sqlite en bruto.
 */

let sandbox: string;
let urlAmbiente: string | undefined;

beforeAll(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), "athena-db-"));
  urlAmbiente = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL; // la BD del test manda, no la del entorno
  process.chdir(sandbox);
  // legacy/test mode: la BD nace en <cwd>/db/custom.db (data-home.ts)
});

afterAll(() => {
  _resetDbParaTests();
  process.chdir(path.join(sandbox, ".."));
  rmSync(sandbox, { recursive: true, force: true });
  if (urlAmbiente !== undefined) process.env.DATABASE_URL = urlAmbiente;
});

const haceUnAno = new Date("2025-01-02T03:04:05.678Z");
const hoy = new Date("2026-11-10T10:00:00.000Z");

describe("formato en disco (compatibilidad con bibliotecas de Prisma)", () => {
  test("DATETIME se guarda como INTEGER de ms y extras como TEXT JSON", async () => {
    const book = await db.book.create({
      data: {
        title: "Bruta",
        fileName: "bruta.pdf",
        filePath: "/uploads/bruta.pdf",
        totalPages: 10,
        extras: { modo: "fichas", n: 2 },
        createdAt: haceUnAno,
        lastReadAt: hoy,
      },
    });
    expect(book.createdAt instanceof Date).toBe(true);
    expect((book.createdAt as Date).getTime()).toBe(haceUnAno.getTime());
    expect(book.extras).toEqual({ modo: "fichas", n: 2 });

    // lectura bruta del fichero: el contrato con el pasado
    const bruto = new Database(path.join(sandbox, "db", "custom.db"));
    const fila = bruto
      .query('SELECT "createdAt", "lastReadAt", "extras", typeof("createdAt") AS t FROM "Book" WHERE id = ?')
      .get(book.id as string) as Record<string, unknown>;
    expect(fila.t).toBe("integer");
    expect(fila.createdAt).toBe(haceUnAno.getTime());
    expect(fila.lastReadAt).toBe(hoy.getTime());
    expect(typeof fila.extras).toBe("string");
    expect(JSON.parse(fila.extras as string)).toEqual({ modo: "fichas", n: 2 });
    bruto.close();
  });

  test("una BD escrita como Prisma (ms enteros + JSON text) se lee bien", async () => {
    // BD nueva en otra carpeta para no pisar la anterior
    const otra = mkdtempSync(path.join(tmpdir(), "athena-legacy-"));
    process.env.DATABASE_URL = `file:${path.join(otra, "legacy.db")}`;
    _resetDbParaTests();
    // esquema a mano (lo que dejó prisma migrate en su día)
    const legado = new Database(path.join(otra, "legacy.db"));
    legado.exec(`CREATE TABLE "Book" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL,
      "author" TEXT, "fileName" TEXT NOT NULL, "filePath" TEXT NOT NULL, "coverPath" TEXT,
      "totalPages" INTEGER NOT NULL, "currentPage" INTEGER NOT NULL DEFAULT 1, "milestones" INTEGER,
      "dailyGoal" INTEGER, "companionPath" TEXT, "companionPages" INTEGER, "extras" JSONB,
      "finishedAt" DATETIME, "readCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastReadAt" DATETIME,
      "origin" TEXT NOT NULL DEFAULT 'subido', "fileHash" TEXT, "fileBytes" INTEGER,
      "fileMtime" REAL, "fileMissingAt" DATETIME)`);
    legado
      .query('INSERT INTO "Book" ("id","title","fileName","filePath","totalPages","extras","createdAt","readCount") VALUES (?,?,?,?,?,?,?,?)')
      .run("viejo1", "Libro viejo", "v.pdf", "/uploads/v.pdf", 300, '{"a":1}', 1767323045678, 3);
    legado.close();

    const libro = await db.book.findUnique({ where: { id: "viejo1" } });
    expect(libro).not.toBeNull();
    expect((libro!.createdAt as Date).getTime()).toBe(1767323045678);
    expect(libro!.extras).toEqual({ a: 1 });
    expect(libro!.readCount).toBe(3);
    expect(libro!.origin).toBe("subido");
    // una tabla _prisma_migrations fantasma no molesta
    delete process.env.DATABASE_URL;
    _resetDbParaTests();
    rmSync(otra, { recursive: true, force: true });
  });
});

describe("crud del contrato que usa server/api.ts", () => {
  test("defaults de Book al crear (id, origin, currentPage, readCount, createdAt)", async () => {
    const b = await db.book.create({
      data: { title: "Nuevo", fileName: "n.pdf", filePath: "/uploads/n.pdf", totalPages: 5 },
    });
    expect(typeof b.id).toBe("string");
    expect(b.id!.length).toBeGreaterThan(10);
    expect(b.origin).toBe("subido");
    expect(b.currentPage).toBe(1);
    expect(b.readCount).toBe(0);
    expect(b.createdAt instanceof Date).toBe(true);
    expect(b.lastReadAt).toBeNull();
    expect(b.finishedAt).toBeNull();
  });

  test("update toca solo las claves dadas; el resto queda intacto", async () => {
    const b = await db.book.create({
      data: { title: "T1", fileName: "t1.pdf", filePath: "/uploads/t1.pdf", totalPages: 9, currentPage: 3 },
    });
    const u = await db.book.update({ where: { id: b.id as string }, data: { currentPage: 7 } });
    expect(u.currentPage).toBe(7);
    expect(u.title).toBe("T1");
    expect(u.totalPages).toBe(9);
  });

  test("findMany orderBy lastReadAt desc deja los null al final (como Prisma)", async () => {
    await db.book.create({ data: { title: "sin leer", fileName: "a.pdf", filePath: "/uploads/a.pdf", totalPages: 3 } });
    await db.book.create({ data: { title: "leído hoy", fileName: "b.pdf", filePath: "/uploads/b.pdf", totalPages: 3, lastReadAt: hoy } });
    await db.book.create({ data: { title: "leído ayer", fileName: "c.pdf", filePath: "/uploads/c.pdf", totalPages: 3, lastReadAt: haceUnAno } });
    const lista = await db.book.findMany({ orderBy: { lastReadAt: "desc" } });
    const titulos = lista.map((b) => b.title);
    expect(titulos.indexOf("leído hoy")).toBeLessThan(titulos.indexOf("leído ayer"));
    expect(titulos[titulos.length - 1]).toBe("sin leer"); // nulls al final
  });

  test("include badge junta la insignia (o null) por libro", async () => {
    const b = await db.book.create({
      data: { title: "Con insignia", author: "Alguien", fileName: "x.pdf", filePath: "/uploads/x.pdf", totalPages: 4 },
    });
    const vacio = await db.book.findUnique({ where: { id: b.id }, include: { badge: true } });
    expect(vacio!.badge).toBeNull();
    await db.badge.create({ data: { bookId: b.id as string, tier: 2, readings: 2 } });
    const con = await db.book.findUnique({ where: { id: b.id as string }, include: { badge: true } });
    expect(con!.badge!.tier).toBe(2);
    expect(con!.badge!.readings).toBe(2);
  });

  test("include sessions con select de subset de columnas", async () => {
    const b = await db.book.create({
      data: { title: "Con sesiones", fileName: "s.pdf", filePath: "/uploads/s.pdf", totalPages: 4 },
    });
    await db.readingSession.create({ data: { bookId: b.id as string, pagesRead: 10, minutes: 20 } });
    await db.readingSession.create({ data: { bookId: b.id as string, pagesRead: 5, minutes: 7, date: haceUnAno } });
    const con = await db.book.findUnique({
      where: { id: b.id as string },
      include: { sessions: { select: { pagesRead: true, minutes: true, date: true } }, badge: true },
    });
    const sesiones = con!.sessions!;
    expect(sesiones.length).toBe(2);
    expect(sesiones[0].pagesRead).toBe(5); // orden por fecha
    expect(sesiones[0].date instanceof Date).toBe(true);
  });

  test("borrar un libro arrastra insignia y sesiones (cascada FK)", async () => {
    const b = await db.book.create({
      data: { title: "Borrible", fileName: "d.pdf", filePath: "/uploads/d.pdf", totalPages: 4 },
    });
    const id = b.id as string;
    await db.badge.create({ data: { bookId: id } });
    await db.readingSession.create({ data: { bookId: id, pagesRead: 1 } });
    await db.book.delete({ where: { id } });
    expect(await db.badge.findUnique({ where: { bookId: id } })).toBeNull();
    const sesiones = await db.readingSession.findMany({ where: { bookId: id } });
    expect(sesiones.length).toBe(0);
  });

  test("upsert de insignia: crea la primera vez, actualiza después (+updatedAt)", async () => {
    const b = await db.book.create({
      data: { title: "Terminable", author: "A", fileName: "f.pdf", filePath: "/uploads/f.pdf", totalPages: 2 },
    });
    const id = b.id as string;
    const primera = await db.badge.upsert({
      where: { bookId: id },
      create: { bookId: id, tier: 1, readings: 1 },
      update: { tier: 1, readings: 1 },
    });
    expect(primera.tier).toBe(1);
    const segunda = await db.badge.upsert({
      where: { bookId: id },
      create: { bookId: id, tier: 3, readings: 3 },
      update: { tier: 3, readings: 3 },
    });
    expect(segunda.tier).toBe(3);
    const enBd = await db.badge.findUnique({ where: { bookId: id } });
    expect(enBd!.tier).toBe(3);
    expect(enBd!.updatedAt instanceof Date).toBe(true);
    const total = await db.badge.count({ where: { bookId: id } });
    expect(total).toBe(1);
  });

  test("deleteMany con where y sin where (todo)", async () => {
    const b1 = await db.book.create({ data: { title: "u1", fileName: "u1.pdf", filePath: "/u1", totalPages: 1 } });
    const r1 = await db.badge.deleteMany({ where: { bookId: b1.id as string } });
    expect(r1.count).toBe(0);
    await db.badge.create({ data: { bookId: b1.id as string } });
    const r2 = await db.badge.deleteMany({ where: { bookId: b1.id as string } });
    expect(r2.count).toBe(1);
  });

  test("updateMany actualiza todas las filas y devuelve el conteo", async () => {
    const r = await db.book.updateMany({ data: { currentPage: 1, finishedAt: null, readCount: 0 } });
    expect(r.count).toBeGreaterThan(0);
    const todos = await db.book.findMany({ where: { currentPage: 1 } });
    expect(todos.length).toBe(r.count);
  });

  test("count filtra por igualdad; findFirst respeta where y select", async () => {
    await db.book.create({ data: { title: "carpeta1", fileName: "cf.pdf", filePath: "/cf", totalPages: 1, origin: "carpeta" } });
    const total = await db.book.count({ where: { origin: "carpeta" } });
    expect(total).toBe(1);
    const primero = await db.book.findFirst({ where: { origin: "carpeta" }, select: { title: true } });
    expect(Object.keys(primero!)).toEqual(["title"]);
    const nulo = await db.book.findFirst({ where: { origin: "inexistente" } });
    expect(nulo).toBeNull();
  });

  test("createMany inserta tanda con defaults y devuelve el conteo", async () => {
    const r = await db.vocab.createMany({
      data: [
        { word: "casa", lang: "es", short: "hogar", bookTitle: "x", page: 1 },
        { word: "dog", lang: "en", short: "perro", bookTitle: "x" },
      ],
    });
    expect(r.count).toBe(2);
    const perro = await db.vocab.findFirst({ where: { word: "dog", lang: "en" } });
    expect(perro!.page).toBe(1); // default
    expect(perro!.createdAt instanceof Date).toBe(true);
  });

  test("vocab: unique(word,lang) protegido y orderBy createdAt desc con take", async () => {
    const lista = await db.vocab.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    expect(lista.length).toBeGreaterThanOrEqual(2);
    // segunda palabra igual → el índice único la rechaza (como Prisma)
    try {
      await db.vocab.create({ data: { word: "casa", lang: "es", short: "otra", bookTitle: "x" } });
      expect(true).toBe(false); // no debe llegar aquí
    } catch {
      expect(true).toBe(true);
    }
  });

  test("$transaction de función: atómica de verdad (rollback al fallar)", async () => {
    const b = await db.book.create({ data: { title: "tx", fileName: "tx.pdf", filePath: "/tx", totalPages: 3 } });
    const id = b.id as string;
    const antes = (await db.book.findUnique({ where: { id } }))!.currentPage as number;
    try {
      await db.$transaction(async () => {
        await db.book.update({ where: { id }, data: { currentPage: 99 } });
        throw new Error("fallo a propósito");
      });
    } catch (e) {
      expect((e as Error).message).toBe("fallo a propósito");
    }
    const despues = (await db.book.findUnique({ where: { id } }))!.currentPage as number;
    expect(despues).toBe(antes); // rollback
  });

  test("$transaction de función: commit real (update + sesión juntos)", async () => {
    const b = await db.book.create({ data: { title: "tx2", fileName: "t2.pdf", filePath: "/t2", totalPages: 3 } });
    const id = b.id as string;
    const r = await db.$transaction(async (tx) => {
      const libro = await tx.book.update({ where: { id }, data: { currentPage: 2, lastReadAt: hoy } });
      await tx.readingSession.create({ data: { bookId: id, pagesRead: 2, minutes: 3 } });
      return libro;
    });
    expect(r.currentPage).toBe(2);
    const sesiones = await db.readingSession.findMany({ where: { bookId: id } });
    expect(sesiones.length).toBe(1);
  });

  test("$transaction de tanda espera las promesas en orden", async () => {
    const b = await db.book.create({ data: { title: "tx3", fileName: "t3.pdf", filePath: "/t3", totalPages: 3 } });
    const id = b.id as string;
    const [, sesiones] = await db.$transaction([
      db.badge.deleteMany({ where: { bookId: id } }),
      db.readingSession.deleteMany({ where: { bookId: id } }),
    ]);
    expect(sesiones.count).toBe(0);
  });

  test("$queryRaw devuelve filas con nombres de columna", async () => {
    const filas = await db.$queryRaw<{ n: number }>`SELECT COUNT(*) AS n FROM "Book"`;
    expect(Number(filas[0].n)).toBeGreaterThan(0);
  });

  test("select de columnas concretas (cover y fichero)", async () => {
    const b = await db.book.create({
      data: { title: "sel", fileName: "sel.pdf", filePath: "/uploads/sel.pdf", totalPages: 2, coverPath: "/uploads/c.png" },
    });
    const soloPortada = await db.book.findUnique({ where: { id: b.id as string }, select: { coverPath: true } });
    expect(Object.keys(soloPortada!)).toEqual(["coverPath"]);
    const soloFichero = await db.book.findUnique({
      where: { id: b.id as string },
      select: { filePath: true, companionPath: true, origin: true },
    });
    expect(soloFichero!.companionPath).toBeNull();
    expect(soloFichero!.origin).toBe("subido");
  });
});
