// Limpia las sesiones fantasma creadas por el E2E de la dieta (Task 16)
// y verifica el estado del usuario: sofia 117/657, 0 sesiones.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const before = await prisma.readingSession.findMany({ orderBy: { date: "asc" } });
console.log("sesiones antes:", before.length, before.map((s) => `${s.bookId.slice(0, 6)} ${s.date} p${s.pagesRead} m${s.minutes}`));

if (before.length > 0) {
  const del = await prisma.readingSession.deleteMany({});
  console.log("borradas:", del.count);
}

const books = await prisma.book.findMany({
  select: { id: true, title: true, currentPage: true, totalPages: true, readCount: true },
  orderBy: { createdAt: "asc" },
});
console.log("libros:", books.map((b) => `${b.title.slice(0, 24)} ${b.currentPage}/${b.totalPages} r${b.readCount}`));
