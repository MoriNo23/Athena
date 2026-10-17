// Devuelve el estado del usuario al baseline tras el E2E de la Task 18:
// - borra las sesiones fantasma de hoy (sofia)
// - restaura sofia a la página 117 sin crear sesión
// - borra el libro de prueba si sigue vivo (y su papelera de undo)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const SOFIA = "b60f17e32785444ac";

const today0 = new Date();
today0.setHours(0, 0, 0, 0);

const del = await db.readingSession.deleteMany({ where: { bookId: SOFIA, date: { gte: today0 } } });
console.log("sesiones fantasma borradas:", del.count);

await db.book.update({ where: { id: SOFIA }, data: { currentPage: 117 } });
console.log("sofia restaurada a 117");

const gone = await db.book.deleteMany({ where: { title: { contains: "gordo" } } });
console.log("libros gordo borrados de BD:", gone.count);

const badges = await db.badge.deleteMany({ where: { book: { title: { contains: "gordo" } } } });
console.log("insignias gordo borradas:", badges.count);

const books = await db.book.findMany({ select: { title: true, currentPage: true, totalPages: true } });
console.log("biblioteca final:", books.map((b) => `${b.title.slice(0, 18)} ${b.currentPage}/${b.totalPages}`).join(" | "));
const sess = await db.readingSession.count();
console.log("sesiones totales:", sess);
await db.$disconnect();
