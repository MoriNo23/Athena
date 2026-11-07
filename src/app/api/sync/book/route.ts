import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { raizUploads } from "@/core/data-home";
import { preflightSync, cabecerasSync } from "@/lib/cors";
import {
  libroApto,
  emparejar,
  idAceptable,
  hitosSeguros,
  metaSegura,
  extrasSeguros,
  sesionesSanas,
  insigniaSana,
  fechaSegura,
  camposGanadores,
  paginaSegura,
} from "@/core/sync";

export const runtime = "nodejs";

const UPLOADS_DIR = raizUploads(); // <casa>/uploads con ATHENA_HOME (data-home.ts)

export async function OPTIONS(req: NextRequest) {
  return preflightSync(req);
}

/**
 * POST /api/sync/book — un libro de la copia (Enmienda 1: «el dispositivo que
 * manda»). multipart: `book` (JSON del libro + sesiones por día + insignia),
 * `file` (binario PDF/EPUB, opcional: el receptor quizá ya lo tiene) y
 * `cover` (dataURL png, opcional).
 *
 * Empareja por id, luego fileName+totalPages (misma convención anti-duplicado
 * de POST /api/books). El que manda gana en los campos del libro, sus
 * sesiones y su insignia; la copia NUNCA borra libros del receptor.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const bruto = form.get("book");
    if (typeof bruto !== "string") {
      return NextResponse.json({ error: "Falta el libro (campo book)" }, { status: 400, headers: cabecerasSync(req) });
    }
    let entrante: unknown;
    try {
      entrante = JSON.parse(bruto);
    } catch {
      return NextResponse.json({ error: "El libro no es JSON válido" }, { status: 400, headers: cabecerasSync(req) });
    }
    if (!libroApto(entrante)) {
      return NextResponse.json(
        { error: "El libro llegó incompleto (nombre, título o páginas)" },
        { status: 400, headers: cabecerasSync(req) }
      );
    }

    const file = form.get("file");
    const esFichero = file instanceof File && file.size > 0;
    if (esFichero) {
      const lower = file.name.toLowerCase();
      const ok =
        file.type === "application/pdf" ||
        lower.endsWith(".pdf") ||
        file.type === "application/epub+zip" ||
        lower.endsWith(".epub");
      if (!ok) {
        return NextResponse.json({ error: "Aceptamos PDF y EPUB" }, { status: 415, headers: cabecerasSync(req) });
      }
      if (file.size > 200 * 1024 * 1024) {
        return NextResponse.json({ error: "El libro supera los 200 MB" }, { status: 413, headers: cabecerasSync(req) });
      }
    }
    const cover = form.get("cover");
    const coverData = typeof cover === "string" && cover.startsWith("data:image/") ? cover : null;

    const existentes = await db.book.findMany({
      select: { id: true, fileName: true, totalPages: true },
    });
    const pareja = emparejar(entrante, existentes);

    if (pareja) {
      // ---------- el que manda gana sobre el libro existente ----------
      const id = pareja.id;
      const actual = await db.book.findUnique({ where: { id } });
      if (!actual) {
        return NextResponse.json(
          { error: "El libro desapareció durante la copia" },
          { status: 409, headers: cabecerasSync(req) }
        );
      }
      const campos = camposGanadores(entrante, actual);

      // fichero: solo si llega (el receptor ya tiene el suyo si no viaja)
      let filePath = actual.filePath;
      let fileBytes = actual.fileBytes;
      let fileMissingAt = actual.fileMissingAt;
      if (esFichero) {
        await mkdir(UPLOADS_DIR, { recursive: true });
        const ext = file.name.toLowerCase().endsWith(".epub") ? "epub" : "pdf";
        const nombre = `${id}.${ext}`;
        await writeFile(path.join(UPLOADS_DIR, nombre), Buffer.from(await file.arrayBuffer()));
        filePath = `/uploads/${nombre}`;
        fileBytes = file.size;
        fileMissingAt = null;
      }

      // portada: dataURL solo si el receptor no tiene ya una
      let coverPath = actual.coverPath;
      if (coverData && !coverPath) {
        await mkdir(UPLOADS_DIR, { recursive: true });
        const nombre = `${id}-cover.png`;
        await writeFile(path.join(UPLOADS_DIR, nombre), Buffer.from(coverData.split(",")[1] ?? "", "base64"));
        coverPath = `/uploads/${nombre}`;
      }

      const book = await db.book.update({
        where: { id },
        data: {
          ...campos,
          extras: extrasSeguros(entrante.extras) as never,
          filePath,
          coverPath,
          fileBytes,
          fileMissingAt,
        },
      });

      // sesiones: el que manda trae la historia por día (reemplazo limpio)
      const filas = sesionesSanas(entrante.sessions);
      await db.$transaction([
        db.readingSession.deleteMany({ where: { bookId: id } }),
        ...filas.map((s) =>
          db.readingSession.create({
            data: { bookId: id, pagesRead: s.pagesRead, minutes: s.minutes, date: new Date(s.date) },
          })
        ),
      ]);

      // insignia: viene (upsert) / viene null (se quita) / no viene (se deja)
      const insignia = insigniaSana(entrante.badge);
      if (insignia === null) {
        await db.badge.deleteMany({ where: { bookId: id } });
      } else if (insignia) {
        const ganada = fechaSegura(insignia.earnedAt) ?? new Date();
        await db.badge.upsert({
          where: { bookId: id },
          create: { bookId: id, tier: insignia.tier, readings: insignia.readings, earnedAt: ganada },
          update: { tier: insignia.tier, readings: insignia.readings, earnedAt: ganada },
        });
      }

      return NextResponse.json({ book, matched: true }, { headers: cabecerasSync(req) });
    }

    // ---------- libro nuevo para el receptor ----------
    const usados = new Set(existentes.map((b) => b.id));
    const id = idAceptable(entrante.id, usados) ?? `b${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const esEpub = esFichero
      ? file.name.toLowerCase().endsWith(".epub")
      : /\.epub$/i.test(entrante.fileName);

    let filePath: string;
    let fileBytes: number | null = null;
    let fileMissingAt: Date | null = null;
    if (esFichero) {
      await mkdir(UPLOADS_DIR, { recursive: true });
      const nombre = `${id}.${esEpub ? "epub" : "pdf"}`;
      await writeFile(path.join(UPLOADS_DIR, nombre), Buffer.from(await file.arrayBuffer()));
      filePath = `/uploads/${nombre}`;
      fileBytes = file.size;
    } else {
      // degradación en silencio (Enmienda 1): el libro entra, su fichero falta
      fileMissingAt = new Date();
      filePath = `/uploads/${id}.${esEpub ? "epub" : "pdf"}`;
    }

    let coverPath: string | null = null;
    if (coverData) {
      await mkdir(UPLOADS_DIR, { recursive: true });
      const nombre = `${id}-cover.png`;
      await writeFile(path.join(UPLOADS_DIR, nombre), Buffer.from(coverData.split(",")[1] ?? "", "base64"));
      coverPath = `/uploads/${nombre}`;
    }

    const book = await db.book.create({
      data: {
        id,
        title: entrante.title.trim(),
        author: typeof entrante.author === "string" && entrante.author.trim() ? entrante.author.trim() : null,
        fileName: entrante.fileName,
        filePath,
        coverPath,
        totalPages: Math.round(Number(entrante.totalPages)),
        currentPage: paginaSegura(entrante.currentPage, Math.round(Number(entrante.totalPages))),
        milestones: hitosSeguros(entrante.milestones),
        dailyGoal: metaSegura(entrante.dailyGoal),
        extras: extrasSeguros(entrante.extras) as never,
        finishedAt: fechaSegura(entrante.finishedAt),
        readCount: Math.max(0, Math.round(Number(entrante.readCount) || 0)),
        lastReadAt: fechaSegura(entrante.lastReadAt),
        origin: "subido",
        fileBytes,
        fileMissingAt,
      },
    });

    const filas = sesionesSanas(entrante.sessions);
    if (filas.length > 0) {
      await db.$transaction(
        filas.map((s) =>
          db.readingSession.create({
            data: { bookId: id, pagesRead: s.pagesRead, minutes: s.minutes, date: new Date(s.date) },
          })
        )
      );
    }
    const insignia = insigniaSana(entrante.badge);
    if (insignia) {
      await db.badge.create({
        data: {
          bookId: id,
          tier: insignia.tier,
          readings: insignia.readings,
          earnedAt: fechaSegura(insignia.earnedAt) ?? new Date(),
        },
      });
    }

    return NextResponse.json({ book, matched: false }, { status: 201, headers: cabecerasSync(req) });
  } catch (e) {
    console.error("POST /api/sync/book", e);
    return NextResponse.json({ error: "La copia del libro falló" }, { status: 500, headers: cabecerasSync(req) });
  }
}
