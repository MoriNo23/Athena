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
      extras?: Record<string, unknown> | null;
    };

    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    const currentPage =
      typeof body.currentPage === "number" && Number.isFinite(body.currentPage)
        ? Math.min(Math.max(1, Math.round(body.currentPage)), book.totalPages)
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

    const updated = await db.book.update({
      where: { id },
      data: { currentPage, lastReadAt: new Date(), milestones, extras: extras as never },
    });

    if (pagesRead > 0 || minutes > 0) {
      await db.readingSession.create({
        data: { bookId: id, pagesRead, minutes },
      });
    }

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

    // Los archivos van a la papelera de deshacer (no se destruyen aún), y la
    // instantánea guarda la ficha completa para poder restaurar todo.
    const files: string[] = [path.basename(book.filePath)];
    if (book.coverPath && book.coverPath.startsWith("/uploads/")) {
      files.push(path.basename(book.coverPath));
    }
    if (book.companionPath) {
      files.push(path.basename(book.companionPath));
    }
    await moveToTrash(id, files);

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
        pdf: path.basename(book.filePath),
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
