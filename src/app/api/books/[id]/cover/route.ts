import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

/** Borra la portada local anterior (best-effort) para no acumular archivos huérfanos */
async function removePreviousCover(coverPath: string | null) {
  if (!coverPath || !coverPath.startsWith("/uploads/")) return; // URL externa: nada local que borrar
  try {
    await unlink(path.join(UPLOAD_DIR, path.basename(coverPath)));
  } catch {
    // ya no existía: ok
  }
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

type Params = { params: Promise<{ id: string }> };

// Dominios de los que aceptamos guardar una portada por URL (sin proxy)
const COVER_HOSTS = new Set(["covers.openlibrary.org", "books.google.com"]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Sustituye la portada del libro por la real obtenida de la API de portadas.
 * Dos vías: subida de la imagen ya descargada por el navegador (multipart)
 * o URL directa de un dominio permitido (Open Library / Google Books).
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "Falta la imagen de portada" }, { status: 400 });
      }
      const ext = EXT_BY_MIME[file.type] ?? (file.name.toLowerCase().endsWith(".png") ? "png" : "jpg");
      await mkdir(UPLOAD_DIR, { recursive: true });
      const coverName = `${id}-realcover-${Date.now()}.${ext}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.length > 8 * 1024 * 1024) {
        return NextResponse.json({ error: "La imagen supera los 8 MB" }, { status: 413 });
      }
      await writeFile(path.join(UPLOAD_DIR, coverName), bytes);
      await removePreviousCover(book.coverPath);
      const updated = await db.book.update({
        where: { id },
        data: { coverPath: `/uploads/${coverName}` },
      });
      return NextResponse.json({ book: updated });
    }

    // Vía URL: solo dominios conocidos de portadas, nunca una URL arbitraria
    const body = (await req.json()) as { url?: string };
    let host = "";
    try {
      host = body.url ? new URL(body.url).hostname : "";
    } catch {
      host = "";
    }
    if (!body.url || !COVER_HOSTS.has(host)) {
      return NextResponse.json({ error: "URL de portada no permitida" }, { status: 400 });
    }
    await removePreviousCover(book.coverPath);
    const updated = await db.book.update({
      where: { id },
      data: { coverPath: body.url },
    });
    return NextResponse.json({ book: updated });
  } catch (e) {
    console.error("POST /api/books/[id]/cover", e);
    return NextResponse.json({ error: "No se pudo guardar la portada" }, { status: 500 });
  }
}
