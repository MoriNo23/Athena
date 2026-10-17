import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tierForReadings } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Registra una lectura completada (el lector llegó a la última página).
 * Crea la insignia (Bronce) o sube su tier con cada relectura.
 * Solo cuenta para libros válidos: título + autor.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id }, include: { badge: true } });
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    // Validez: sin título y autor no hay insignia (el usuario debe personalizar el libro)
    const hasMeta = !!(book.title.trim() && book.author && book.author.trim());
    if (!hasMeta) {
      return NextResponse.json({ ok: true, badge: null, first: false, reason: "missing-metadata" });
    }

    // Guarda anti-doble-registro: dos llegadas a la última página con < 2 min de diferencia
    // (recarga, remontaje) no inflan las lecturas; una relectura legítima pasa sin problema.
    const now = new Date();
    if (book.finishedAt && now.getTime() - book.finishedAt.getTime() < 2 * 60 * 1000) {
      return NextResponse.json({ ok: true, badge: book.badge, first: false, reason: "recent" });
    }

    const readings = book.readCount + 1;
    const tier = tierForReadings(readings);
    const existed = !!book.badge;

    const badge = await db.$transaction(async (tx) => {
      const b = await tx.badge.upsert({
        where: { bookId: id },
        create: { bookId: id, tier, readings },
        update: { tier, readings, updatedAt: now },
      });
      await tx.book.update({
        where: { id },
        data: { readCount: readings, finishedAt: now, lastReadAt: now },
      });
      return b;
    });

    return NextResponse.json({ ok: true, badge, first: !existed });
  } catch (e) {
    console.error("POST /api/books/[id]/finish", e);
    return NextResponse.json({ error: "No se pudo registrar la lectura completada" }, { status: 500 });
  }
}
