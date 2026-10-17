import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  discardUndo,
  readSnapshot,
  restoreFiles,
  sweepExpiredUndo,
  UNDO_TTL_MS,
} from "@/lib/undo-store";

/**
 * Deshacer un borrado: recupera ficha, insignia, sesiones y archivos desde la
 * instantánea de la papelera. Solo dentro del TTL; fuera de él, la basura se
 * purga y ya no hay nada que devolver.
 */
export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) {
      return NextResponse.json({ error: "Falta el id del libro" }, { status: 400 });
    }

    await sweepExpiredUndo();
    const snap = await readSnapshot(id);
    if (!snap) {
      return NextResponse.json({ error: "No hay nada que deshacer" }, { status: 404 });
    }
    if (Date.now() - snap.deletedAt > UNDO_TTL_MS) {
      await discardUndo(id);
      return NextResponse.json({ error: "Ya es tarde para deshacer" }, { status: 410 });
    }

    const exists = await db.book.findUnique({ where: { id } });
    if (exists) {
      await discardUndo(id);
      return NextResponse.json({ error: "Ese libro ya existe" }, { status: 409 });
    }

    await restoreFiles(id, snap.files);

    const b = snap.book as {
      id: string;
      title: string;
      author: string | null;
      fileName: string;
      filePath: string;
      coverPath: string | null;
      totalPages: number;
      currentPage: number;
      milestones: number | null;
      companionPath: string | null;
      companionPages: number | null;
      extras: unknown;
      finishedAt: string | null;
      readCount: number;
      createdAt: string;
      lastReadAt: string | null;
    };

    await db.book.create({
      data: {
        id: b.id,
        title: b.title,
        author: b.author,
        fileName: b.fileName,
        filePath: b.filePath,
        coverPath: b.coverPath,
        totalPages: b.totalPages,
        currentPage: b.currentPage,
        milestones: b.milestones,
        companionPath: b.companionPath,
        companionPages: b.companionPages,
        extras: (b.extras ?? undefined) as never,
        finishedAt: b.finishedAt ? new Date(b.finishedAt) : null,
        readCount: b.readCount,
        createdAt: new Date(b.createdAt),
        lastReadAt: b.lastReadAt ? new Date(b.lastReadAt) : null,
      },
    });

    const badge = snap.badge as { tier: number; readings: number; earnedAt: string; updatedAt: string } | null;
    if (badge) {
      await db.badge.create({
        data: {
          bookId: id,
          tier: badge.tier,
          readings: badge.readings,
          earnedAt: new Date(badge.earnedAt),
          updatedAt: new Date(badge.updatedAt),
        },
      });
    }

    if (snap.sessions.length > 0) {
      await db.readingSession.createMany({
        data: snap.sessions.map((s: { pagesRead: number; minutes: number; date: string }) => ({
          bookId: id,
          pagesRead: s.pagesRead,
          minutes: s.minutes,
          date: new Date(s.date),
        })),
      });
    }

    await discardUndo(id);

    const book = await db.book.findUnique({
      where: { id },
      include: { sessions: { select: { pagesRead: true, minutes: true, date: true } }, badge: true },
    });
    return NextResponse.json({ ok: true, book });
  } catch (e) {
    console.error("POST /api/books/undo", e);
    return NextResponse.json({ error: "No se pudo deshacer el borrado" }, { status: 500 });
  }
}
