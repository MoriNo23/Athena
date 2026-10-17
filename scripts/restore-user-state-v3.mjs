/**
 * Limpieza post-testing (sprint riel v3 + zoom pantalla completa + fix peek, 2026-10-12).
 * - Restaura «el mundo de sofia» a la página real del usuario (117, llegó leyendo 78 pág a las 07:03).
 * - Restaura «El Riel de la Lectura» a la página 9 (el test del peek saltó a 7).
 * - Elimina SOLO las sesiones generadas por el agente de testing (>= 07:25 UTC, 0 páginas),
 *   conservando las sesiones reales del usuario (78p/1p de ~07:03 y los flushes idle 06:47-07:07).
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const SOFIA = "b60f17e32785444ac";
const RIEL = "ba973512a3ace4436";

const del = await p.readingSession.deleteMany({
  where: { bookId: { in: [SOFIA, RIEL] }, date: { gte: new Date("2026-10-12T07:25:00Z") }, pagesRead: 0 },
});
console.log(`sesiones de prueba eliminadas: ${del.count}`);

const sofia = await p.book.update({ where: { id: SOFIA }, data: { currentPage: 117 } });
const riel = await p.book.update({ where: { id: RIEL }, data: { currentPage: 9 } });
console.log(`sofia -> ${sofia.currentPage}, riel -> ${riel.currentPage}`);

for (const id of [SOFIA, RIEL]) {
  const remain = await p.readingSession.findMany({
    where: { bookId: id },
    orderBy: { date: "asc" },
    select: { pagesRead: true, minutes: true, date: true },
  });
  console.log(
    `#${id} ${remain.length} sesiones:`,
    remain.slice(-4).map((s) => `${s.pagesRead}p/${s.minutes}m@${s.date.toISOString().slice(11, 16)}`).join(", ")
  );
}
await p.$disconnect();
