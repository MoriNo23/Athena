import { NextRequest } from "next/server";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { stat } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
};

/** Respuesta en stream del fichero (nunca se escribe: solo lectura). Con
    Range (pdfjs pide trozos): 206 + Content-Range, o el fichero entero. */
async function servir(ruta: string, req: NextRequest): Promise<Response> {
  const st = await stat(/* turbopackIgnore: true */ ruta);
  const tipo = MIME[path.extname(ruta).toLowerCase()] ?? "application/octet-stream";
  const comun = { "Content-Type": tipo, "Cache-Control": "no-store", "Accept-Ranges": "bytes" };
  const range = req.headers.get("range");
  const m = range?.match(/bytes=(\d+)-(\d*)/);
  if (m) {
    const ini = Number(m[1]);
    const fin = m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (Number.isFinite(ini) && ini <= fin) {
      const stream = createReadStream(ruta, { start: ini, end: fin });
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 206,
        headers: {
          ...comun,
          "Content-Range": `bytes ${ini}-${fin}/${st.size}`,
          "Content-Length": String(fin - ini + 1),
        },
      });
    }
  }
  const stream = createReadStream(ruta);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: { ...comun, "Content-Length": String(st.size) },
  });
}

/**
 * El fichero del libro, servido por la APP (change ficheros-servidos-por-la-app):
 *  - subidos: stream desde public/uploads/ — NO redirige al estático (un
 *    fichero nuevo no existeía al arrancar el servidor y daría 404).
 *  - carpeta: stream del fichero real de la dueña en su disco.
 *  - `?cual=companion`: el PDF compañero de la lectura dual.
 * Solo LEE: jamás escribe, mueve ni renombra.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const cual = req.nextUrl.searchParams.get("cual");
    const esCompanion = cual === "companion";

    const book = await db.book.findUnique({
      where: { id },
      select: { filePath: true, companionPath: true, origin: true },
    });
    if (!book) {
      return Response.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    // ruta interna (BD): /uploads/<nombre> → al disco; absoluta → tal cual
    const interna = esCompanion ? book.companionPath : book.filePath;
    if (!interna) {
      return Response.json({ error: "Este libro no tiene ese fichero" }, { status: 404 });
    }
    const ruta = interna.startsWith("/uploads/")
      ? path.join(UPLOADS_DIR, path.basename(interna))
      : path.resolve(interna);

    try {
      await stat(/* turbopackIgnore: true */ ruta);
    } catch {
      return Response.json(
        { error: esCompanion ? "El compañero no está" : "El fichero no está (¿lo moviste o borraste?)" },
        { status: 404 }
      );
    }
    return await servir(ruta, req);
  } catch (e) {
    console.error("GET /api/books/[id]/file", e);
    return Response.json({ error: "No se pudo servir el fichero" }, { status: 500 });
  }
}
