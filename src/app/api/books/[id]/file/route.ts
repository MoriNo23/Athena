import { NextRequest } from "next/server";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { stat } from "fs/promises";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
};

/**
 * El fichero REAL de un libro registrado en su sitio (origin="carpeta"),
 * servido en stream para el leceptor (pdfjs/EPUB). Solo LEE: nunca escribe,
 * renombra ni mueve nada. Para los subidos (copia en /uploads) redirige a su
 * URL estática de siempre. 404 honesto si la dueña movió el fichero.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id }, select: { filePath: true, origin: true } });
    if (!book) {
      return Response.json({ error: "Libro no encontrado" }, { status: 404 });
    }
    if (book.origin !== "carpeta") {
      return Response.redirect(new URL(book.filePath, _req.url), 307);
    }
    let st;
    try {
      st = await stat(/* turbopackIgnore: true */ book.filePath);
    } catch {
      return Response.json({ error: "El fichero no está (¿lo moviste o borraste?)" }, { status: 404 });
    }
    const ext = book.filePath.toLowerCase().replace(/^.*\./, ".");
    const stream = createReadStream(book.filePath);
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Length": String(st.size),
        "Cache-Control": "no-store", // la fuente de verdad es el disco, no la caché
      },
    });
  } catch (e) {
    console.error("GET /api/books/[id]/file", e);
    return Response.json({ error: "No se pudo servir el fichero" }, { status: 500 });
  }
}
