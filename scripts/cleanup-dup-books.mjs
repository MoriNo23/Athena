// Borra los duplicados exactos de sofia creados por los reintentos de subida
// del usuario (subidas reales que la biblioteca nunca mostró por el 500 de /api/books).
import { PrismaClient } from "@prisma/client";
import { unlink } from "fs/promises";
import path from "path";

const db = new PrismaClient();
const UPLOAD_DIR = path.join(process.cwd(), "public");

const originalId = "b60f17e32785444ac"; // la sofia real del usuario (pág 117, con portada)

const dups = await db.book.findMany({
  where: {
    id: { not: originalId },
    fileName: "el-mundo-de-sofia-pdf_compress.pdf",
    totalPages: 657,
    currentPage: 1,
    sessions: { none: {} },
  },
  select: { id: true, title: true, filePath: true, coverPath: true, createdAt: true },
});

console.log(`Duplicados a borrar: ${dups.length}`);
for (const d of dups) {
  for (const p of [d.filePath, d.coverPath]) {
    if (p) {
      try {
        await unlink(path.join(UPLOAD_DIR, p));
        console.log(`  archivo borrado: ${p}`);
      } catch {
        /* ya no estaba */
      }
    }
  }
  await db.book.delete({ where: { id: d.id } });
  console.log(`  fila borrada: ${d.id} «${d.title}» (creado ${d.createdAt})`);
}

const total = await db.book.count();
console.log(`Libros restantes en biblioteca: ${total}`);
await db.$disconnect();
