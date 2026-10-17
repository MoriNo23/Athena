import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Reinicia TODAS las lecturas: progreso, sesiones y la colección completa
 * de insignias. La biblioteca y las fichas se conservan. Pide confirmación
 * en la UI antes de llegar aquí.
 */
export async function POST() {
  try {
    const [, sessions, books] = await db.$transaction([
      db.badge.deleteMany({}),
      db.readingSession.deleteMany({}),
      db.book.updateMany({ data: { currentPage: 1, finishedAt: null, readCount: 0 } }),
    ]);
    return NextResponse.json({ ok: true, books: books.count, sessions: sessions.count });
  } catch (e) {
    console.error("POST /api/progress/reset-all", e);
    return NextResponse.json({ error: "No se pudo reiniciar el progreso" }, { status: 500 });
  }
}
