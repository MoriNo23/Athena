import { NextRequest } from "next/server";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { stat } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * La portada del libro, servida por la APP (change ficheros-servidos-por-la-app).
 * Las portadas viven en public/uploads/ como copia de la casa; pedirlas por el
 * estático falla en producción cuando la copia se creó tras el arranque. El
 * stream no cachea: una portada nueva se ve al instante.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id }, select: { coverPath: true } });
    if (!book || !book.coverPath || !book.coverPath.startsWith("/uploads/")) {
      return Response.json({ error: "Este libro no tiene portada" }, { status: 404 });
    }
    const ruta = path.join(UPLOADS_DIR, path.basename(book.coverPath));
    try {
      await stat(/* turbopackIgnore: true */ ruta);
    } catch {
      return Response.json({ error: "La portada no está" }, { status: 404 });
    }
    const stream = createReadStream(ruta);
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/books/[id]/cover", e);
    return Response.json({ error: "No se pudo servir la portada" }, { status: 500 });
  }
}
