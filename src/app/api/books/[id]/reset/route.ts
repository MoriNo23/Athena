import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * Reinicia las lecturas de UN libro: progreso a página 1, sesiones de lectura
 * e insignia (vuelven a cero para poder re-coleccionar). Conserva el archivo,
 * la ficha (título/autor/portada), los hitos configurados y las notas.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    const updated = await db.$transaction([
      db.badge.deleteMany({ where: { bookId: id } }),
      db.readingSession.deleteMany({ where: { bookId: id } }),
      db.book.update({
        where: { id },
        data: { currentPage: 1, finishedAt: null, readCount: 0 },
      }),
    ]);

    return NextResponse.json({ book: updated[2] });
  } catch (e) {
    console.error("POST /api/books/[id]/reset", e);
    return NextResponse.json({ error: "No se pudo reiniciar el libro" }, { status: 500 });
  }
}
