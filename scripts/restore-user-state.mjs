/**
 * Limpieza post-testing (sprint riel v2 + peek + zoom + inmersión, 2026-10-12).
 * - Restaura el libro «el mundo de sofia» a la página real del usuario (103).
 * - Elimina SOLO las sesiones generadas por el agente de testing (>= 05:20 UTC),
 *   conservando las sesiones reales del usuario (45 y 75 pág de ~05:11-05:17).
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const SOFIA = "b60f17e32785444ac";

const del = await p.readingSession.deleteMany({
  where: { bookId: SOFIA, date: { gte: new Date("2026-10-12T05:20:00Z") } },
});
console.log(`sesiones de prueba eliminadas: ${del.count}`);

const b = await p.book.update({
  where: { id: SOFIA },
  data: { currentPage: 103 },
});
console.log(`sofia restaurado -> currentPage=${b.currentPage}`);

const remain = await p.readingSession.findMany({
  where: { bookId: SOFIA },
  select: { pagesRead: true, minutes: true, date: true },
});
console.log(
  `sesiones reales conservadas: ${remain.length}`,
  remain.map((s) => `${s.pagesRead}p/${s.minutes}m@${s.date.toISOString().slice(11, 16)}`).join(", ")
);
await p.$disconnect();
