/**
 * Backup/restore del estado REAL del usuario para pruebas E2E de insignias.
 *   node scripts/backup-state.mjs backup   → guarda books/sessions/badges en JSON
 *   node scripts/backup-state.mjs restore  → restaura exactamente lo guardado
 * Se ejecuta desde la raíz del repo (para resolver @prisma/client).
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "node:url";

const p = new PrismaClient();
const FILE = fileURLToPath(new URL("state-backup.json", import.meta.url));
const mode = process.argv[2] ?? "backup";

if (mode === "backup") {
  const books = await p.book.findMany();
  const sessions = await p.readingSession.findMany();
  const badges = await p.badge.findMany();
  writeFileSync(FILE, JSON.stringify({ books, sessions, badges }, null, 1));
  console.log(
    `backup: ${books.length} libros, ${sessions.length} sesiones, ${badges.length} insignias → ${FILE}`
  );
  console.log(
    books.map((b) => `${b.id.slice(0, 10)} pág ${b.currentPage}/${b.totalPages} rc=${b.readCount}`).join("\n")
  );
} else if (mode === "restore") {
  if (!existsSync(FILE)) throw new Error("No existe el backup");
  const snap = JSON.parse(readFileSync(FILE, "utf8"));

  // Restaurar en orden: limpiar vivo → recrear sesiones/insignias → devolver campos de libros
  await p.$transaction([
    p.badge.deleteMany({}),
    p.readingSession.deleteMany({}),
  ]);
  if (snap.badges.length) {
    await p.badge.createMany({ data: snap.badges });
  }
  if (snap.sessions.length) {
    await p.readingSession.createMany({ data: snap.sessions });
  }
  for (const b of snap.books) {
    await p.book.update({
      where: { id: b.id },
      data: {
        currentPage: b.currentPage,
        finishedAt: b.finishedAt,
        readCount: b.readCount,
      },
    });
  }
  console.log(`restore: ${snap.books.length} libros, ${snap.sessions.length} sesiones, ${snap.badges.length} insignias`);
  for (const b of snap.books) {
    const now = await p.book.findUnique({ where: { id: b.id } });
    console.log(`${now.id.slice(0, 10)} pág ${now.currentPage}/${now.totalPages} rc=${now.readCount}`);
  }
} else {
  throw new Error("Modo desconocido: usa backup | restore");
}

await p.$disconnect();
