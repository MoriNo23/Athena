import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

type Params = { params: Promise<{ id: string }> };

/** POST: sube el PDF compañero (traducción / segunda edición) para lectura dual */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const pages = Number(form.get("pages"));

    if (!file || !Number.isFinite(pages) || pages <= 0) {
      return NextResponse.json({ error: "Falta el archivo o el número de páginas" }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "El compañero debe ser un PDF" }, { status: 415 });
    }
    // mismo tope que las subidas normales (200 MB)
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "El compañero pasa de 200 MB" }, { status: 413 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const fileName = `${id}-companion.pdf`;
    await writeFile(path.join(UPLOAD_DIR, fileName), Buffer.from(await file.arrayBuffer()));

    const updated = await db.book.update({
      where: { id },
      data: { companionPath: `/uploads/${fileName}`, companionPages: Math.round(pages) },
    });

    return NextResponse.json({ book: updated });
  } catch (e) {
    console.error("POST /api/books/[id]/companion", e);
    return NextResponse.json({ error: "No se pudo subir el PDF compañero" }, { status: 500 });
  }
}

/** DELETE: quita el compañero y borra su archivo */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado" }, { status: 404 });
    }

    if (book.companionPath) {
      try {
        await unlink(path.join(UPLOAD_DIR, path.basename(book.companionPath)));
      } catch (err) {
        console.warn("No se pudo borrar el archivo del compañero", err);
      }
    }

    const updated = await db.book.update({
      where: { id },
      data: { companionPath: null, companionPages: null },
    });
    return NextResponse.json({ book: updated });
  } catch (e) {
    console.error("DELETE /api/books/[id]/companion", e);
    return NextResponse.json({ error: "No se pudo quitar el compañero" }, { status: 500 });
  }
}
