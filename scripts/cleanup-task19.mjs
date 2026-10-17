import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const sofia = await db.book.findFirst({ where: { title: { contains: "sofia" } } });
console.log("sofia antes:", sofia.currentPage, "/", sofia.totalPages);
const sessions = await db.readingSession.findMany({ orderBy: { date: "desc" } });
console.log("sesiones totales:", sessions.length, sessions.slice(0, 3).map(s => ({ book: s.bookId, pages: s.pagesRead, date: s.date })));
// Restaurar baseline: sofia 117/657, 0 sesiones
await db.book.update({ where: { id: sofia.id }, data: { currentPage: 117, lastReadAt: sofia.lastReadAt } });
const del = await db.readingSession.deleteMany({});
console.log("sesiones borradas:", del.count);
const after = await db.book.findFirst({ where: { id: sofia.id } });
console.log("sofia después:", after.currentPage, "/", after.totalPages);
await db.$disconnect();
