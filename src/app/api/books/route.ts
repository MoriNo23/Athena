import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { archivoUrlDe } from "@/lib/types";
import { sweepExpiredUndo } from "@/lib/undo-store";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function GET() {
  try {
    await sweepExpiredUndo(); // purga papelera vencida al ver la biblioteca
    const books = await db.book.findMany({
      orderBy: { lastReadAt: "desc" },
      include: { badge: true },
    });
    // Las filas de sesión solo se consumen como sumas por día (BookCard,
    // use-library-books, use-reading-session, use-finish-eta): la agregación
    // se hace en SQL y viaja una fila por día, no una por sesión. El día es
    // el de la máquina (self-host: mismo duelo navegador-servidor), y cada
    // fila viaja como mediodía local para que la racha/today del cliente no
    // se deslicen de día. Ver rendimiento-lectores design §1.
    const dias = await db.$queryRaw<{ bookId: string; day: string; pages: number; minutes: number }[]>`
      SELECT bookId, strftime('%Y-%m-%d', date / 1000, 'unixepoch', 'localtime') AS day,
             SUM(pagesRead) AS pages, SUM(minutes) AS minutes
      FROM ReadingSession
      GROUP BY bookId, day
    `;
    const porLibro = new Map<string, { pagesRead: number; minutes: number; date: string }[]>();
    for (const r of dias) {
      let lista = porLibro.get(r.bookId);
      if (!lista) porLibro.set(r.bookId, (lista = []));
      lista.push({
        pagesRead: Number(r.pages),
        minutes: Number(r.minutes),
        date: `${r.day}T12:00:00`,
      });
    }
    return NextResponse.json({
      books: books.map((b) => ({
        ...b,
        sessions: porLibro.get(b.id) ?? [],
        // URLs servidas por la app (nunca estáticos de public/): un fichero
        // creado tras el arranque del servidor no existía en el momento de
        // enumerar public/ y daría 404 hasta reiniciar.
        archivoUrl: archivoUrlDe(b),
        coverUrl: b.coverPath && b.coverPath.startsWith("/uploads/") ? `/api/books/${b.id}/cover` : b.coverPath,
      })),
    });
  } catch (e) {
    console.error("GET /api/books", e);
    return NextResponse.json({ error: "No se pudo listar la biblioteca" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const cover = form.get("cover") as string | null; // dataURL png
    const title = (form.get("title") as string | null)?.trim();
    const author = (form.get("author") as string | null)?.trim() || null;
    const totalPages = Number(form.get("totalPages"));

    if (!file || !title || !Number.isFinite(totalPages) || totalPages <= 0) {
      return NextResponse.json(
        { error: "Faltan datos del libro (archivo, título o páginas)" },
        { status: 400 }
      );
    }
    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
    const isEpub = file.type === "application/epub+zip" || lowerName.endsWith(".epub");

    if (!isPdf && !isEpub) {
      return NextResponse.json(
        { error: "Aceptamos PDF y EPUB (pronto: más formatos)" },
        { status: 415 }
      );
    }

    // Los libros pesados pueden ser grandes, pero no ilimitados (protegemos el disco)
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El libro supera los 200 MB. Comprímelo y vuelve a intentar." },
        { status: 413 }
      );
    }

    // Anti-duplicado: mismo archivo (nombre + páginas) ya subido no se copia otra vez.
    // Evita bibliotecas con copias idénticas cuando una subida "no se ve" y se reintenta.
    const totalPagesRound = Math.round(totalPages);
    const dup = await db.book.findFirst({
      where: { fileName: file.name, totalPages: totalPagesRound },
      select: { id: true, title: true },
    });
    if (dup) {
      return NextResponse.json(
        {
          error: `Este libro ya está en tu biblioteca como «${dup.title}»`,
          duplicateOf: dup.id,
        },
        { status: 409 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const id = `b${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const fileName = `${id}.${isEpub ? "epub" : "pdf"}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, fileName), bytes);

    let coverPath: string | null = null;
    if (cover && cover.startsWith("data:image/")) {
      const base64 = cover.split(",")[1];
      const coverName = `${id}-cover.png`;
      await writeFile(path.join(UPLOAD_DIR, coverName), Buffer.from(base64, "base64"));
      coverPath = `/uploads/${coverName}`;
    }

    const book = await db.book.create({
      data: {
        id,
        title,
        author,
        fileName: file.name,
        filePath: `/uploads/${fileName}`,
        coverPath,
        totalPages: Math.round(totalPages),
        currentPage: 1,
      },
    });

    return NextResponse.json({ book }, { status: 201 });
  } catch (e) {
    console.error("POST /api/books", e);
    return NextResponse.json({ error: "No se pudo subir el libro" }, { status: 500 });
  }
}
