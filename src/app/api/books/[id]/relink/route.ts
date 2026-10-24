import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { stat } from "fs/promises";
import { db } from "@/lib/db";
import { hashDe } from "@/lib/library-folder";

type Params = { params: Promise<{ id: string }> };

/**
 * Re-vínculo: la dueña movió el fichero y nos dice dónde está ahora.
 * Solo se acepta para libros origin="carpeta" (los subidos viven en uploads).
 * La fila conserva TODO su progreso; solo cambia la ruta y su huella.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { filePath?: string };
    const ruta = (body.filePath ?? "").trim();
    if (!path.isAbsolute(ruta)) {
      return NextResponse.json({ error: "Escribe la ruta absoluta del fichero" }, { status: 400 });
    }
    const ext = path.extname(ruta).toLowerCase();
    if (ext !== ".pdf" && ext !== ".epub") {
      return NextResponse.json({ error: "Solo PDF y EPUB" }, { status: 415 });
    }

    let st;
    try {
      st = await stat(/* turbopackIgnore: true */ ruta);
    } catch {
      return NextResponse.json({ error: "No se pudo abrir ese fichero (¿existe?)" }, { status: 400 });
    }

    const book = await db.book.findUnique({ where: { id } });
    if (!book) return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    if (book.origin !== "carpeta") {
      return NextResponse.json({ error: "Solo aplica a libros de carpeta" }, { status: 400 });
    }

    const fileHash = (await hashDe(ruta)) ?? book.fileHash;
    const updated = await db.book.update({
      where: { id },
      data: {
        filePath: path.resolve(ruta),
        fileName: path.basename(ruta),
        fileHash,
        fileBytes: st.size,
        fileMtime: Math.round(st.mtimeMs),
        fileMissingAt: null,
      },
    });
    return NextResponse.json({ book: updated });
  } catch (e) {
    console.error("POST /api/books/[id]/relink", e);
    return NextResponse.json({ error: "No se pudo re-vincular" }, { status: 500 });
  }
}
