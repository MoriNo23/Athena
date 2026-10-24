import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { db } from "@/lib/db";
import { moveToTrash, saveSnapshot, sweepExpiredUndo, UNDO_TTL_MS } from "@/lib/undo-store";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      currentPage?: number;
      pagesRead?: number;
      minutes?: number;
      milestones?: number | null;
      dailyGoal?: number | null;
      extras?: Record<string, unknown> | null;
      /** el lector aprende páginas al primer abrir (libros de carpeta escaneados) */
      totalPages?: number;
    };

    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    // Páginas totales aprendidas al abrir (EPUB/PDF opacos guardan 0 en el escaneo).
    // Mientras LLEGA una nueva medida, el clamp de la página usa esa, no la vieja.
    let totalPages = book.totalPages;
    if (typeof body.totalPages === "number" && Number.isFinite(body.totalPages) && body.totalPages >= 1) {
      totalPages = Math.round(body.totalPages);
    }
    const techoTotal = totalPages > 0 ? totalPages : Number.MAX_SAFE_INTEGER;

    const currentPage =
      typeof body.currentPage === "number" && Number.isFinite(body.currentPage)
        ? Math.min(Math.max(1, Math.round(body.currentPage)), techoTotal)
        : book.totalPages > 0 && book.currentPage > book.totalPages
          ? book.totalPages
          : book.currentPage;

    const pagesRead = Math.max(0, Math.round(body.pagesRead ?? 0));
    const minutes = Math.max(0, Math.round(body.minutes ?? 0));

    // Hitos individuales del libro: null → heredar el global
    let milestones = book.milestones;
    if (body.milestones !== undefined) {
      milestones =
        body.milestones === null
          ? null
          : Math.min(40, Math.max(2, Math.round(body.milestones)));
    }

    // Meta diaria propia del libro: null → heredar el mínimo global (1-500)
    let dailyGoal = book.dailyGoal;
    if (body.dailyGoal !== undefined) {
      dailyGoal =
        body.dailyGoal === null
          ? null
          : Math.min(500, Math.max(1, Math.round(body.dailyGoal)));
    }

    // Extras de modos de lectura (fichas, notación, resultados...): se reemplaza el objeto completo
    let extras: unknown = book.extras;
    if (body.extras !== undefined) {
      if (body.extras === null) {
        extras = null;
      } else if (typeof body.extras === "object") {
        const json = JSON.stringify(body.extras);
        if (json.length > 512 * 1024) {
          return NextResponse.json({ error: "Los datos del libro son demasiado grandes" }, { status: 413 });
        }
        extras = body.extras;
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const b = await tx.book.update({
        where: { id },
        data: { currentPage, lastReadAt: new Date(), milestones, dailyGoal, totalPages, extras: extras as never },
      });
      if (pagesRead > 0 || minutes > 0) {
        await tx.readingSession.create({
          data: { bookId: id, pagesRead, minutes },
        });
      }
      return b;
    });

    return NextResponse.json({ book: updated });
  } catch (e) {
    console.error("PATCH /api/books/[id]", e);
    return NextResponse.json({ error: "No se pudo guardar el progreso" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    await sweepExpiredUndo();

    // PILAR (cfg-y-biblioteca-por-carpeta): libros origin="carpeta" — el fichero
    // es de la dueña y la app JAMÁS lo mueve a la papelera ni lo borra. Solo
    // desaparece la fila de BD (con insignia y sesiones); el fichero queda
    // byte a byte en su carpeta. La instantánea permite deshacer sin tocar nada.
    const esCarpeta = book.origin === "carpeta";
    const files: string[] = [];
    if (!esCarpeta) {
      files.push(path.basename(book.filePath));
    }
    if (book.coverPath && book.coverPath.startsWith("/uploads/")) {
      files.push(path.basename(book.coverPath));
    }
    if (book.companionPath) {
      files.push(path.basename(book.companionPath));
    }
    if (files.length > 0) {
      await moveToTrash(id, files);
    }

    const [sessions, badge] = await Promise.all([
      db.readingSession.findMany({ where: { bookId: id } }),
      db.badge.findUnique({ where: { bookId: id } }),
    ]);
    await saveSnapshot(id, {
      deletedAt: Date.now(),
      book: JSON.parse(JSON.stringify(book)),
      badge: badge ? JSON.parse(JSON.stringify(badge)) : null,
      sessions: sessions.map((s) => ({ pagesRead: s.pagesRead, minutes: s.minutes, date: s.date.toISOString() })),
      files: {
        pdf: esCarpeta ? "" : path.basename(book.filePath),
        ...(book.coverPath && book.coverPath.startsWith("/uploads/") ? { cover: path.basename(book.coverPath) } : {}),
        ...(book.companionPath ? { companion: path.basename(book.companionPath) } : {}),
      },
    });

    await db.book.delete({ where: { id } });
    return NextResponse.json({ ok: true, undoExpiresAt: new Date(Date.now() + UNDO_TTL_MS).toISOString() });
  } catch (e) {
    console.error("DELETE /api/books/[id]", e);
    return NextResponse.json({ error: "No se pudo eliminar el libro" }, { status: 500 });
  }
}
