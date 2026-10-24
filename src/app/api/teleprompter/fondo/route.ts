import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { escribirAjustes, leerAjustes } from "@/lib/config-file";

/**
 * Fondo propio del teleprompter (change teleprompter-ritmo-y-fondo):
 * la imagen se SUBE como copia a public/uploads/ (la casa nunca escribe en
 * los ficheros de la dueña) y queda registrada en el bloque `teleprompter`
 * de db/config.json. La legibilidad la garantiza el filtro en runtime del
 * overlay, no la edición de la imagen.
 */
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 8 * 1024 * 1024;
const MIME_OK = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file || !MIME_OK.has(file.type)) {
      return NextResponse.json({ error: "Hace falta una imagen (png, jpg, webp o avif)" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen pasa de 8 MB" }, { status: 413 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/avif" ? "avif" : "jpg";
    const nombre = `tp-fondo-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, nombre), bytes);

    const cfg = await leerAjustes();
    const ruta = `/uploads/${nombre}`;
    await escribirAjustes(
      { ...cfg.settings, teleprompter: { ...cfg.settings.teleprompter, fondo: "imagen", fondoRuta: ruta } },
      cfg.biblioteca,
      cfg._doc
    );
    return NextResponse.json({ ok: true, ruta }, { status: 201 });
  } catch (e) {
    console.error("POST /api/teleprompter/fondo", e);
    return NextResponse.json({ error: "No se pudo guardar la imagen" }, { status: 500 });
  }
}
