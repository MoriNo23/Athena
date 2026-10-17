/**
 * Semilla de biblioteca + reinicio de progreso para las pruebas de Atena.
 *
 * Uso:
 *   bun scripts/seed-library.mjs            → reinicia progreso y garantiza los 4 libros
 *   bun scripts/seed-library.mjs --no-reset → solo garantiza libros (no toca progreso)
 *
 * «Reiniciar progreso» = borrar insignias + sesiones y devolver cada libro a
 * página 1 / sin terminar. Es lo mismo que POST /api/progress/reset-all pero
 * directo a la BD (funciona sin servidor encendido). Cada prueba E2E debe
 * pasar por aquí (o por el endpoint) para empezar siempre de cero.
 */
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const BASE = "/home/z/my-project";
const UPLOADS = path.join(BASE, "public", "uploads");
const manifest = JSON.parse(fs.readFileSync(path.join(BASE, "scripts", "seed-manifest.json"), "utf8"));

const doReset = !process.argv.includes("--no-reset");
const db = new PrismaClient();

async function main() {
  const created = [];
  for (const b of manifest.books) {
    const filePath = `/uploads/${b.file}`;
    const coverPath = `/uploads/${b.cover}`;
    const abs = path.join(UPLOADS, b.file);
    const absCover = path.join(UPLOADS, b.cover);
    if (!fs.existsSync(abs)) throw new Error(`Falta el archivo del libro: ${abs}`);
    if (fs.existsSync(absCover) === false) throw new Error(`Falta la portada: ${absCover}`);

    const existing = await db.book.findFirst({ where: { fileName: b.file } });
    if (existing) {
      // repara ruta/páginas si cambiaron
      await db.book.update({
        where: { id: existing.id },
        data: { filePath, coverPath, totalPages: b.pages },
      });
      created.push({ ...b, action: "ya-existia" });
      continue;
    }
    const row = await db.book.create({
      data: {
        title: b.title,
        author: b.author,
        fileName: b.file,
        filePath,
        coverPath,
        totalPages: b.pages,
        currentPage: 1,
      },
    });
    created.push({ ...b, action: "creado", id: row.id });
  }

  // compañero de lectura dual para el Quijote
  if (manifest.companion) {
    const q = await db.book.findFirst({ where: { fileName: "don-quijote-atena.pdf" } });
    if (q) {
      await db.book.update({
        where: { id: q.id },
        data: {
          companionPath: `/uploads/${manifest.companion.file}`,
          companionPages: manifest.companion.pages,
        },
      });
    }
  }

  let reset = null;
  if (doReset) {
    const [, sessions, books] = await db.$transaction([
      db.badge.deleteMany({}),
      db.readingSession.deleteMany({}),
      db.book.updateMany({ data: { currentPage: 1, finishedAt: null, readCount: 0, lastReadAt: null } }),
    ]);
    reset = { sessions: sessions.count, books: books.count };
  }

  const total = await db.book.count();
  console.log(JSON.stringify({ ok: true, total, reset, books: created.map(({ file, pages, action }) => ({ file, pages, action })) }, null, 2));
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
    return db.$disconnect();
  });
