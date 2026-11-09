/**
 * API de la casa — el mismo contrato que vivía en `src/app/api/**` (Next.js),
 * servido ahora por Express. Nada de la lógica cambia: cada ruta valida y
 * delega en `src/core/` + `src/lib/`; las respuestas siguen el contrato
 * `{ ok, data?, error? }` que el motor offline del APK espeja
 * (public/athena-offline.js). Si tocas una ruta, toca su espejo y sus tests.
 */
import { Router, type Request, type Response } from "express";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { db } from "@/lib/db";
import { archivoUrlDe, tierForReadings } from "@/core/types";
import { sweepExpiredUndo, moveToTrash, saveSnapshot, readSnapshot, restoreFiles, discardUndo, UNDO_TTL_MS } from "@/core/undo-store";
import { raizUploads } from "@/core/data-home";
import { COOKIE_SESION, cookieDe, contraseñaEfectiva, igualEnTiempoConstante } from "@/core/access";
import { escribirAjustes, leerAjustes, saneaAjustes, docPorDefecto } from "@/core/config-file";
import { carpetaValida, escanearCarpeta, hashDe, type ResumenEscaneo } from "@/lib/library-folder";
import { cabecerasSync } from "@/lib/cors";
import {
  libroApto, emparejar, idAceptable, hitosSeguros, metaSegura, extrasSeguros,
  sesionesSanas, insigniaSana, fechaSegura, camposGanadores, paginaSegura, vocabSano,
} from "@/core/sync";
import type { DictEntry, DictionaryResult } from "@/core/types";
import { SUBIDA, leerForm } from "./form";

const subida = multer({ storage: multer.memoryStorage(), limits: SUBIDA.limits });

const UPLOAD_DIR = raizUploads(); // <casa>/uploads con ATHENA_HOME (data-home.ts)
export const api = Router();

/** helper: query como string (Express puede dar arrays) */
function q(req: Request, nombre: string): string {
  const v = req.query[nombre];
  return typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : "";
}

/** helper: id de ruta como string (Express 5 tipa params como string|string[]) */
function idDe(req: Request): string {
  const id = req.params.id;
  return typeof id === "string" ? id : Array.isArray(id) ? (id[0] ?? "") : "";
}

/** helper: cabecera Origin como string (Node la tipa como string|string[]) */
function origenDe(req: Request): string | undefined {
  const v = req.headers.origin;
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

/** helper: 204 de preflight con las cabeceras de la copia (Enmienda 1) */
function preflight(req: Request, res: Response) {
  res.set(cabecerasSync(origenDe(req))).status(204).end();
}

// ---------------------------------------------------------------- raíz ----
/** Salud: la raíz del API queda siempre abierta (la usa el candado). */
api.get("/", (_req, res) => {
  res.json({ ok: true, app: "athena" });
});

// --------------------------------------------------------------- login ----
/** rate limit en memoria de proceso (design §3): 10 fallos/min por IP */
const MAX_INTENTOS = 10;
const VENTANA = 60_000;
const fallosLogin = new Map<string, { n: number; reset: number }>();

api.options("/auth/login", preflight);

api.post("/auth/login", (req, res) => {
  const password = contraseñaEfectiva();
  if (!password) {
    res.status(400).json({ error: "Sin candado: este arranque solo es accesible desde este equipo" });
    return;
  }

  const ip = req.ip ?? req.socket.remoteAddress ?? "local";
  const ahora = Date.now();
  for (const [k, v] of fallosLogin) {
    if (ahora >= v.reset) fallosLogin.delete(k);
  }
  const estado = fallosLogin.get(ip);
  if (estado && ahora < estado.reset && estado.n >= MAX_INTENTOS) {
    res.status(429).json({ error: "Demasiados intentos; espera un minuto" });
    return;
  }

  const enviada = typeof (req.body as { password?: unknown })?.password === "string"
    ? (req.body as { password: string }).password
    : "";
  if (!enviada) {
    res.status(400).json({ error: "Contraseña requerida" });
    return;
  }

  if (!igualEnTiempoConstante(enviada, password)) {
    if (estado && ahora < estado.reset) estado.n += 1;
    else fallosLogin.set(ip, { n: 1, reset: ahora + VENTANA });
    res.status(401).json({ error: "Contraseña incorrecta" });
    return;
  }

  fallosLogin.delete(ip);
  // el token viaja en la respuesta para la copia de la casa (Enmienda 1): el
  // APK lo manda luego como X-Athena-Token (cross-origin, sin cookies).
  res.set(cabecerasSync(origenDe(req)));
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_SESION}=${cookieDe(password)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
  res.json({ ok: true, token: cookieDe(password) });
});

// --------------------------------------------------------------- books ----
api.options("/books", preflight);

api.get("/books", async (req, res) => {
  try {
    await sweepExpiredUndo(); // purga papelera vencida al ver la biblioteca
    const books = await db.book.findMany({
      orderBy: { lastReadAt: "desc" },
      include: { badge: true },
    });
    // Sesiones agregadas por día en SQL (una fila por día, mediodía local).
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
    res.set(cabecerasSync(origenDe(req))).json({
      books: books.map((b) => ({
        ...b,
        sessions: porLibro.get(b.id) ?? [],
        archivoUrl: archivoUrlDe(b),
        coverUrl: b.coverPath && b.coverPath.startsWith("/uploads/") ? `/api/books/${b.id}/cover` : b.coverPath,
      })),
    });
  } catch (e) {
    console.error("GET /api/books", e);
    res.status(500).json({ error: "No se pudo listar la biblioteca" });
  }
});

api.post("/books", subida.any(), async (req, res) => {
  try {
    const form = leerForm(req);
    const file = form.get("file") as File | null;
    const cover = form.get("cover") as string | null; // dataURL png
    const title = (form.get("title") as string | null)?.trim();
    const author = (form.get("author") as string | null)?.trim() || null;
    const totalPages = Number(form.get("totalPages"));

    if (!file || !title || !Number.isFinite(totalPages) || totalPages <= 0) {
      res.status(400).json({ error: "Faltan datos del libro (archivo, título o páginas)" });
      return;
    }
    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
    const isEpub = file.type === "application/epub+zip" || lowerName.endsWith(".epub");

    if (!isPdf && !isEpub) {
      res.status(415).json({ error: "Aceptamos PDF y EPUB (pronto: más formatos)" });
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      res.status(413).json({ error: "El libro supera los 200 MB. Comprímelo y vuelve a intentar." });
      return;
    }

    // Anti-duplicado: mismo archivo (nombre + páginas) ya subido no se copia otra vez.
    const totalPagesRound = Math.round(totalPages);
    const dup = await db.book.findFirst({
      where: { fileName: file.name, totalPages: totalPagesRound },
      select: { id: true, title: true },
    });
    if (dup) {
      res.status(409).json({
        error: `Este libro ya está en tu biblioteca como «${dup.title}»`,
        duplicateOf: dup.id,
      });
      return;
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

    res.status(201).json({ book });
  } catch (e) {
    console.error("POST /api/books", e);
    res.status(500).json({ error: "No se pudo subir el libro" });
  }
});

api.post("/books/undo", async (req, res) => {
  try {
    const { id } = (req.body as { id?: string }) ?? {};
    if (!id) {
      res.status(400).json({ error: "Falta el id del libro" });
      return;
    }

    await sweepExpiredUndo();
    const snap = await readSnapshot(id);
    if (!snap) {
      res.status(404).json({ error: "No hay nada que deshacer" });
      return;
    }
    if (Date.now() - snap.deletedAt > UNDO_TTL_MS) {
      await discardUndo(id);
      res.status(410).json({ error: "Ya es tarde para deshacer" });
      return;
    }

    const exists = await db.book.findUnique({ where: { id } });
    if (exists) {
      await discardUndo(id);
      res.status(409).json({ error: "Ese libro ya existe" });
      return;
    }

    await restoreFiles(id, snap.files);

    const b = snap.book as {
      id: string; title: string; author: string | null; fileName: string; filePath: string;
      coverPath: string | null; totalPages: number; currentPage: number; milestones: number | null;
      dailyGoal: number | null; companionPath: string | null; companionPages: number | null;
      extras: unknown; finishedAt: string | null; readCount: number; createdAt: string;
      lastReadAt: string | null; origin?: string; fileHash?: string | null;
      fileBytes?: number | null; fileMtime?: number | null; fileMissingAt?: string | null;
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
        dailyGoal: b.dailyGoal ?? null,
        companionPath: b.companionPath,
        companionPages: b.companionPages,
        extras: (b.extras ?? undefined) as never,
        finishedAt: b.finishedAt ? new Date(b.finishedAt) : null,
        readCount: b.readCount,
        createdAt: new Date(b.createdAt),
        lastReadAt: b.lastReadAt ? new Date(b.lastReadAt) : null,
        origin: b.origin === "carpeta" ? "carpeta" : "subido",
        fileHash: b.fileHash ?? null,
        fileBytes: b.fileBytes ?? null,
        fileMtime: b.fileMtime ?? null,
        fileMissingAt: b.fileMissingAt ? new Date(b.fileMissingAt) : null,
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
    res.json({ ok: true, book });
  } catch (e) {
    console.error("POST /api/books/undo", e);
    res.status(500).json({ error: "No se pudo deshacer el borrado" });
  }
});

api.patch("/books/:id", async (req, res) => {
  try {
    const id = idDe(req);
    const body = req.body as {
      currentPage?: number;
      pagesRead?: number;
      minutes?: number;
      milestones?: number | null;
      dailyGoal?: number | null;
      extras?: Record<string, unknown> | null;
      totalPages?: number;
    };

    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      res.status(404).json({ error: "Libro no encontrado" });
      return;
    }

    // Páginas totales aprendidas al abrir (EPUB/PDF opacos guardan 0 en el escaneo).
    let totalPages = book.totalPages;
    if (typeof body.totalPages === "number" && Number.isFinite(body.totalPages) && body.totalPages >= 1) {
      totalPages = Math.round(body.totalPages);
    }
    const techoTotal = totalPages > 0 ? totalPages : Number.MAX_SAFE_INTEGER;

    const currentPage =
      typeof body.currentPage === "number" && Number.isFinite(body.currentPage)
        ? Math.min(Math.max(1, Math.round(body.currentPage)), techoTotal)
        : book.totalPages > 0 && book.currentPage > book.totalPages
          ? book.totalPages
          : book.currentPage;

    const pagesRead = Math.max(0, Math.round(body.pagesRead ?? 0));
    const minutes = Math.max(0, Math.round(body.minutes ?? 0));

    // Hitos individuales del libro: null → heredar el global
    let milestones = book.milestones;
    if (body.milestones !== undefined) {
      milestones = body.milestones === null ? null : Math.min(40, Math.max(2, Math.round(body.milestones)));
    }

    // Meta diaria propia del libro: null → heredar el mínimo global (1-500)
    let dailyGoal = book.dailyGoal;
    if (body.dailyGoal !== undefined) {
      dailyGoal = body.dailyGoal === null ? null : Math.min(500, Math.max(1, Math.round(body.dailyGoal)));
    }

    // Extras de modos de lectura: se reemplaza el objeto completo
    let extras: unknown = book.extras;
    if (body.extras !== undefined) {
      if (body.extras === null) {
        extras = null;
      } else if (typeof body.extras === "object") {
        const json = JSON.stringify(body.extras);
        if (json.length > 512 * 1024) {
          res.status(413).json({ error: "Los datos del libro son demasiado grandes" });
          return;
        }
        extras = body.extras;
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const b = await tx.book.update({
        where: { id },
        data: { currentPage, lastReadAt: new Date(), milestones, dailyGoal, totalPages, extras: extras as never },
      });
      if (pagesRead > 0 || minutes > 0) {
        await tx.readingSession.create({ data: { bookId: id, pagesRead, minutes } });
      }
      return b;
    });

    res.json({ book: updated });
  } catch (e) {
    console.error("PATCH /api/books/[id]", e);
    res.status(500).json({ error: "No se pudo guardar el progreso" });
  }
});

api.delete("/books/:id", async (req, res) => {
  try {
    const id = idDe(req);
    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      res.status(404).json({ error: "Libro no encontrado" });
      return;
    }

    await sweepExpiredUndo();

    // PILAR (cfg-y-biblioteca-por-carpeta): libros origin="carpeta" — el fichero
    // es de la dueña y la app JAMÁS lo mueve a la papelera ni lo borra.
    const esCarpeta = book.origin === "carpeta";
    const files: string[] = [];
    if (!esCarpeta) {
      files.push(path.basename(book.filePath));
    }
    if (book.coverPath && book.coverPath.startsWith("/uploads/")) {
      files.push(path.basename(book.coverPath));
    }
    if (book.companionPath) {
      files.push(path.basename(book.companionPath));
    }
    if (files.length > 0) {
      await moveToTrash(id, files);
    }

    const [sessions, badge] = await Promise.all([
      db.readingSession.findMany({ where: { bookId: id } }),
      db.badge.findUnique({ where: { bookId: id } }),
    ]);
    await saveSnapshot(id, {
      deletedAt: Date.now(),
      book: JSON.parse(JSON.stringify(book)),
      badge: badge ? JSON.parse(JSON.stringify(badge)) : null,
      sessions: sessions.map((s) => ({ pagesRead: s.pagesRead, minutes: s.minutes, date: s.date.toISOString() })),
      files: {
        pdf: esCarpeta ? "" : path.basename(book.filePath),
        ...(book.coverPath && book.coverPath.startsWith("/uploads/") ? { cover: path.basename(book.coverPath) } : {}),
        ...(book.companionPath ? { companion: path.basename(book.companionPath) } : {}),
      },
    });

    await db.book.delete({ where: { id } });
    res.json({ ok: true, undoExpiresAt: new Date(Date.now() + UNDO_TTL_MS).toISOString() });
  } catch (e) {
    console.error("DELETE /api/books/[id]", e);
    res.status(500).json({ error: "No se pudo eliminar el libro" });
  }
});

// ---------------------------------------------------- books/:id/extra ----
api.post("/books/:id/companion", subida.any(), async (req, res) => {
  try {
    const id = idDe(req);
    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      res.status(404).json({ error: "Libro no encontrado" });
      return;
    }

    const form = leerForm(req);
    const file = form.get("file") as File | null;
    const pages = Number(form.get("pages"));

    if (!file || !Number.isFinite(pages) || pages <= 0) {
      res.status(400).json({ error: "Falta el archivo o el número de páginas" });
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      res.status(415).json({ error: "El compañero debe ser un PDF" });
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      res.status(413).json({ error: "El compañero pasa de 200 MB" });
      return;
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const fileName = `${id}-companion.pdf`;
    await writeFile(path.join(UPLOAD_DIR, fileName), Buffer.from(await file.arrayBuffer()));

    const updated = await db.book.update({
      where: { id },
      data: { companionPath: `/uploads/${fileName}`, companionPages: Math.round(pages) },
    });

    res.json({ book: updated });
  } catch (e) {
    console.error("POST /api/books/[id]/companion", e);
    res.status(500).json({ error: "No se pudo subir el PDF compañero" });
  }
});

api.delete("/books/:id/companion", async (req, res) => {
  try {
    const id = idDe(req);
    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      res.status(404).json({ error: "Libro no encontrado" });
      return;
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
    res.json({ book: updated });
  } catch (e) {
    console.error("DELETE /api/books/[id]/companion", e);
    res.status(500).json({ error: "No se pudo quitar el compañero" });
  }
});

/** Stream con soporte de Range (pdfjs pide trozos): 206 o el fichero entero. */
async function servirFichero(req: Request, res: Response, ruta: string, tipo: string) {
  const st = await stat(ruta);
  const comun: Record<string, string> = {
    "Content-Type": tipo,
    "Cache-Control": "no-store",
    "Accept-Ranges": "bytes",
    ...cabecerasSync(origenDe(req)),
  };
  const range = req.get("range");
  const m = range?.match(/bytes=(\d+)-(\d*)/);
  if (m) {
    const ini = Number(m[1]);
    const fin = m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (Number.isFinite(ini) && ini <= fin) {
      res.status(206).set({
        ...comun,
        "Content-Range": `bytes ${ini}-${fin}/${st.size}`,
        "Content-Length": String(fin - ini + 1),
      });
      createReadStream(ruta, { start: ini, end: fin }).pipe(res);
      return;
    }
  }
  res.status(200).set({ ...comun, "Content-Length": String(st.size) });
  createReadStream(ruta).pipe(res);
}

api.options("/books/:id/cover", preflight);

api.get("/books/:id/cover", async (req, res) => {
  try {
    const id = idDe(req);
    const book = await db.book.findUnique({ where: { id }, select: { coverPath: true } });
    if (!book || !book.coverPath || !book.coverPath.startsWith("/uploads/")) {
      res.status(404).json({ error: "Este libro no tiene portada" });
      return;
    }
    const ruta = path.join(UPLOAD_DIR, path.basename(book.coverPath));
    try {
      await stat(ruta);
    } catch {
      res.status(404).json({ error: "La portada no está" });
      return;
    }
    await servirFichero(req, res, ruta, "image/png");
  } catch (e) {
    console.error("GET /api/books/[id]/cover", e);
    res.status(500).json({ error: "No se pudo servir la portada" });
  }
});

api.options("/books/:id/file", preflight);

api.get("/books/:id/file", async (req, res) => {
  try {
    const id = idDe(req);
    const cual = q(req, "cual");
    const esCompanion = cual === "companion";

    const book = await db.book.findUnique({
      where: { id },
      select: { filePath: true, companionPath: true, origin: true },
    });
    if (!book) {
      res.status(404).json({ error: "Libro no encontrado" });
      return;
    }

    // ruta interna (BD): /uploads/<nombre> → al disco; absoluta → tal cual
    const interna = esCompanion ? book.companionPath : book.filePath;
    if (!interna) {
      res.status(404).json({ error: "Este libro no tiene ese fichero" });
      return;
    }
    const ruta = interna.startsWith("/uploads/")
      ? path.join(UPLOAD_DIR, path.basename(interna))
      : path.resolve(interna);

    const MIME: Record<string, string> = {
      ".pdf": "application/pdf",
      ".epub": "application/epub+zip",
    };
    try {
      await stat(ruta);
    } catch {
      res.status(404).json({
        error: esCompanion ? "El compañero no está" : "El fichero no está (¿lo moviste o borraste?)",
      });
      return;
    }
    await servirFichero(req, res, ruta, MIME[path.extname(ruta).toLowerCase()] ?? "application/octet-stream");
  } catch (e) {
    console.error("GET /api/books/[id]/file", e);
    res.status(500).json({ error: "No se pudo servir el fichero" });
  }
});

api.post("/books/:id/finish", async (req, res) => {
  try {
    const id = idDe(req);
    const book = await db.book.findUnique({ where: { id }, include: { badge: true } });
    if (!book) {
      res.status(404).json({ error: "Libro no encontrado" });
      return;
    }

    // Validez: sin título y autor no hay insignia
    const hasMeta = !!(book.title.trim() && book.author && book.author.trim());
    if (!hasMeta) {
      res.json({ ok: true, badge: null, first: false, reason: "missing-metadata" });
      return;
    }

    // Guarda anti-doble-registro (< 2 min entre llegadas a la última página)
    const now = new Date();
    if (book.finishedAt && now.getTime() - book.finishedAt.getTime() < 2 * 60 * 1000) {
      res.json({ ok: true, badge: book.badge, first: false, reason: "recent" });
      return;
    }

    const readings = book.readCount + 1;
    const tier = tierForReadings(readings);
    const existed = !!book.badge;

    const badge = await db.$transaction(async (tx) => {
      const b = await tx.badge.upsert({
        where: { bookId: id },
        create: { bookId: id, tier, readings },
        update: { tier, readings, updatedAt: now },
      });
      await tx.book.update({
        where: { id },
        data: { readCount: readings, finishedAt: now, lastReadAt: now },
      });
      return b;
    });

    res.json({ ok: true, badge, first: !existed });
  } catch (e) {
    console.error("POST /api/books/[id]/finish", e);
    res.status(500).json({ error: "No se pudo registrar la lectura completada" });
  }
});

api.patch("/books/:id/meta", async (req, res) => {
  try {
    const id = idDe(req);
    const body = req.body as { title?: string; author?: string | null; dailyGoal?: number | null };

    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      res.status(404).json({ error: "Libro no encontrado" });
      return;
    }

    let title = book.title;
    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) {
        res.status(400).json({ error: "El título no puede quedar vacío" });
        return;
      }
      title = t;
    }

    let author = book.author;
    if (body.author !== undefined) {
      const a = typeof body.author === "string" ? body.author.trim() : null;
      author = a ? a : null;
    }

    let dailyGoal = book.dailyGoal;
    if (body.dailyGoal !== undefined) {
      dailyGoal = body.dailyGoal === null ? null : Math.min(500, Math.max(1, Math.round(body.dailyGoal)));
    }

    const updated = await db.book.update({ where: { id }, data: { title, author, dailyGoal } });
    res.json({ book: updated });
  } catch (e) {
    console.error("PATCH /api/books/[id]/meta", e);
    res.status(500).json({ error: "No se pudo guardar la ficha del libro" });
  }
});

api.post("/books/:id/relink", async (req, res) => {
  try {
    const id = idDe(req);
    const body = req.body as { filePath?: string };
    const ruta = (body.filePath ?? "").trim();
    if (!path.isAbsolute(ruta)) {
      res.status(400).json({ error: "Escribe la ruta absoluta del fichero" });
      return;
    }
    const ext = path.extname(ruta).toLowerCase();
    if (ext !== ".pdf" && ext !== ".epub") {
      res.status(415).json({ error: "Solo PDF y EPUB" });
      return;
    }

    let st;
    try {
      st = await stat(ruta);
    } catch {
      res.status(400).json({ error: "No se pudo abrir ese fichero (¿existe?)" });
      return;
    }

    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      res.status(404).json({ error: "Libro no encontrado" });
      return;
    }
    if (book.origin !== "carpeta") {
      res.status(400).json({ error: "Solo aplica a libros de carpeta" });
      return;
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
    res.json({ book: updated });
  } catch (e) {
    console.error("POST /api/books/[id]/relink", e);
    res.status(500).json({ error: "No se pudo re-vincular" });
  }
});

api.post("/books/:id/reset", async (req, res) => {
  try {
    const id = idDe(req);
    const book = await db.book.findUnique({ where: { id } });
    if (!book) {
      res.status(404).json({ error: "Libro no encontrado" });
      return;
    }

    const updated = await db.$transaction([
      db.badge.deleteMany({ where: { bookId: id } }),
      db.readingSession.deleteMany({ where: { bookId: id } }),
      db.book.update({
        where: { id },
        data: { currentPage: 1, finishedAt: null, readCount: 0 },
      }),
    ]);

    res.json({ book: updated[2] });
  } catch (e) {
    console.error("POST /api/books/[id]/reset", e);
    res.status(500).json({ error: "No se pudo reiniciar el libro" });
  }
});

// --------------------------------------------------------- dictionary ----
/**
 * Proxy de diccionario gratuito (sin API key):
 *  - Español: rae-api.com (definiciones de la RAE) con fallback a dictionaryapi.dev/es
 *  - Inglés:  dictionaryapi.dev (Wiktionary) con fallback a Datamuse (WordNet)
 * Respuesta normalizada + caché en memoria.
 */
const cacheDict = new Map<string, DictionaryResult>();
const CACHE_MAX = 300;

interface RaeSense { raw?: string; category?: string; gender?: string; description?: string; examples?: string[]; synonyms?: string[] | null }
interface RaeMeaning { origin?: { raw?: string } | null; senses?: RaeSense[] | null }
interface RaeResponse { ok?: boolean; error?: string; suggestions?: string[] | null; data?: { word?: string; meanings?: RaeMeaning[] } }
interface WikEntry {
  word?: string; phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }>;
}

const POS_ES: Record<string, string> = {
  noun: "sustantivo", adjective: "adjetivo", verb: "verbo", adverb: "adverbio",
  pronoun: "pronombre", preposition: "preposición", conjunction: "conjunción",
  interjection: "interjección",
};

async function fetchJson(url: string, timeoutMs = 6500): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "RielReader/1.0 (dictionary proxy)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function cleanRaw(raw: string): string {
  return raw.replace(/^\s*\d+\.\s*/, "").replace(/\s*Sin\.:.*$/, "").trim();
}

async function lookupEs(word: string): Promise<DictionaryResult> {
  const data = (await fetchJson(
    `https://rae-api.com/api/words/${encodeURIComponent(word.toLowerCase())}`
  )) as RaeResponse | null;

  if (data?.ok && data.data?.meanings?.length) {
    const entries: DictEntry[] = data.data.meanings
      .map((m) => {
        const senses = m.senses ?? [];
        const first = senses[0];
        const posBits = [first?.category ? POS_ES[first.category] ?? first.category : "", first?.gender ? ` ${first.gender}` : ""]
          .join("")
          .trim();
        return {
          pos: posBits || "definición",
          defs: senses
            .slice(0, 4)
            .map((s) => ({ d: s.description?.trim() || cleanRaw(s.raw ?? ""), ex: s.examples?.[0] }))
            .filter((d) => d.d.length > 0),
          synonyms: first?.synonyms?.slice(0, 6) ?? undefined,
        };
      })
      .filter((e) => e.defs.length > 0);

    if (entries.length > 0) {
      return {
        word,
        lang: "es",
        found: true,
        origin: data.data.meanings[0]?.origin?.raw ?? undefined,
        entries,
        source: "RAE (rae-api.com)",
      };
    }
  }

  const alt = await lookupDictionaryApi(word, "es");
  if (alt.found) return alt;
  return { word, lang: "es", found: false, entries: [], source: "RAE (rae-api.com)" };
}

async function lookupDictionaryApi(word: string, lang: "es" | "en"): Promise<DictionaryResult> {
  const primary = await lookupWiktionary(word, lang);
  if (primary.found) return primary;
  if (lang === "en") {
    const fallback = await lookupDatamuse(word);
    if (fallback.found) return fallback;
  }
  return { word, lang, found: false, entries: [], source: "dictionaryapi.dev" };
}

async function lookupWiktionary(word: string, lang: "es" | "en"): Promise<DictionaryResult> {
  const arr = (await fetchJson(
    `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word.toLowerCase())}`
  )) as WikEntry[] | null;

  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr[0];
    const audio = first.phonetics?.find((p) => p.audio && p.audio.length > 0)?.audio;
    const entries: DictEntry[] = (first.meanings ?? [])
      .slice(0, 5)
      .map((m) => ({
        pos: m.partOfSpeech ?? "",
        defs: (m.definitions ?? [])
          .slice(0, 4)
          .map((d) => ({ d: d.definition?.trim() ?? "", ex: d.example?.trim() || undefined }))
          .filter((d) => d.d.length > 0),
      }))
      .filter((e) => e.defs.length > 0);

    if (entries.length > 0) {
      return {
        word: first.word ?? word,
        lang,
        found: true,
        phonetic: first.phonetic ?? undefined,
        audio,
        entries,
        source: "Wiktionary (dictionaryapi.dev)",
      };
    }
  }
  return { word, lang, found: false, entries: [], source: "dictionaryapi.dev" };
}

const DATAMUSE_POS: Record<string, string> = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", u: "" };

async function lookupDatamuse(word: string): Promise<DictionaryResult> {
  const arr = (await fetchJson(
    `https://api.datamuse.com/words?sp=${encodeURIComponent(word.toLowerCase())}&md=d&max=3`
  )) as Array<{ word?: string; defs?: string[] }> | null;

  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr.find((a) => a.defs && a.defs.length > 0) ?? arr[0];
    if (first.defs?.length) {
      const byPos = new Map<string, string[]>();
      for (const raw of first.defs) {
        const [posCode, text] = raw.split(/\t/, 2);
        if (!text) continue;
        const pos = DATAMUSE_POS[posCode] ?? "";
        const list = byPos.get(pos) ?? [];
        if (list.length < 4) list.push(text.trim());
        byPos.set(pos, list);
      }
      const entries: DictEntry[] = [...byPos.entries()]
        .slice(0, 4)
        .map(([pos, defs]) => ({ pos, defs: defs.map((d) => ({ d })) }));
      if (entries.length > 0) {
        return {
          word: first.word ?? word,
          lang: "en",
          found: true,
          entries,
          source: "WordNet (Datamuse)",
        };
      }
    }
  }
  return { word, lang: "en", found: false, entries: [], source: "Datamuse" };
}

api.get("/dictionary", async (req, res) => {
  const wordRaw = q(req, "word");
  const langParam = q(req, "lang") || "auto";
  const word = wordRaw.trim().toLowerCase().slice(0, 60);

  if (!word || !/[a-záéíóúñü]/i.test(word)) {
    res.status(400).json({ error: "Palabra inválida" });
    return;
  }

  const cacheKey = `${langParam}:${word}`;
  const hit = cacheDict.get(cacheKey);
  if (hit) {
    res.json(hit);
    return;
  }

  const looksSpanish = /[ñáéíóúü¿¡]/.test(word);

  let final: DictionaryResult;
  if (langParam === "es") {
    final = await lookupEs(word);
  } else if (langParam === "en") {
    final = await lookupDictionaryApi(word, "en");
  } else {
    const [es, en] = await Promise.all([lookupEs(word), lookupDictionaryApi(word, "en")]);
    const spanishPriority = looksSpanish || es.found || !en.found;
    final = spanishPriority ? (es.found ? es : en) : en;
  }

  if (cacheDict.size >= CACHE_MAX) {
    const firstKey = cacheDict.keys().next().value;
    if (firstKey) cacheDict.delete(firstKey);
  }
  cacheDict.set(cacheKey, final);
  res.json(final);
});

// ------------------------------------------------------- library/scan ----
api.post("/library/scan", async (req, res) => {
  try {
    const body = (req.body ?? {}) as { carpeta?: string };
    const cfg = await leerAjustes();

    let resuelta: string;
    if (body.carpeta && body.carpeta.trim() !== "") {
      const veredicto = await carpetaValida(body.carpeta.trim());
      if (!veredicto.ok || !veredicto.resuelta) {
        res.status(400).json({ error: veredicto.error });
        return;
      }
      resuelta = veredicto.resuelta;
      if (resuelta !== cfg.biblioteca.carpeta) {
        await escribirAjustes(cfg.settings, { carpeta: resuelta }, cfg._doc);
      }
    } else {
      if (!cfg.biblioteca.carpeta) {
        res.status(400).json({ error: "Aún no hay carpeta elegida" });
        return;
      }
      const veredicto = await carpetaValida(cfg.biblioteca.carpeta);
      if (!veredicto.ok || !veredicto.resuelta) {
        res.status(400).json({ error: veredicto.error });
        return;
      }
      resuelta = veredicto.resuelta;
    }

    const resumen: ResumenEscaneo = await escanearCarpeta(resuelta);
    const total = await db.book.count({ where: { origin: "carpeta" } });
    res.json({ resumen, total });
  } catch (e) {
    console.error("POST /api/library/scan", e);
    res.status(500).json({ error: "El escaneo falló" });
  }
});

// --------------------------------------------------- progress/reset-all ----
api.post("/progress/reset-all", async (_req, res) => {
  try {
    const [, sessions, books] = await db.$transaction([
      db.badge.deleteMany({}),
      db.readingSession.deleteMany({}),
      db.book.updateMany({ data: { currentPage: 1, finishedAt: null, readCount: 0 } }),
    ]);
    res.json({ ok: true, books: books.count, sessions: sessions.count });
  } catch (e) {
    console.error("POST /api/progress/reset-all", e);
    res.status(500).json({ error: "No se pudo reiniciar el progreso" });
  }
});

// ------------------------------------------------------------ settings ----
api.options("/settings", preflight);

api.get("/settings", async (req, res) => {
  try {
    const cfg = await leerAjustes();
    res.set(cabecerasSync(origenDe(req))).json({
      settings: cfg.settings,
      biblioteca: cfg.biblioteca,
      _doc: Object.keys(cfg._doc).length > 0 ? cfg._doc : docPorDefecto(),
      created: cfg.created,
    });
  } catch (e) {
    console.error("GET /api/settings", e);
    res.status(500).json({ error: "No se pudo leer la configuración" });
  }
});

api.put("/settings", async (req, res) => {
  try {
    const body = req.body as {
      settings?: unknown;
      biblioteca?: { carpeta?: string };
      _doc?: Record<string, string>;
    };
    const actual = await leerAjustes();

    let biblioteca = actual.biblioteca;
    if (body.biblioteca && typeof body.biblioteca === "object") {
      const carpeta = body.biblioteca.carpeta;
      if (typeof carpeta === "string") biblioteca = { carpeta: carpeta.slice(0, 1024) };
    }

    const doc =
      body._doc && Object.keys(body._doc).length > 0
        ? { ...docPorDefecto(), ...limpiaDoc(body._doc) }
        : actual._doc;

    const settings = saneaAjustes(body.settings ?? actual.settings);
    await escribirAjustes(settings, biblioteca, doc);

    res.json({ ok: true, settings, biblioteca });
  } catch (e) {
    console.error("PUT /api/settings", e);
    res.status(500).json({ error: "No se pudo guardar la configuración" });
  }
});

/** La _doc solo acepta strings (es data, no código). */
function limpiaDoc(d: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === "string") out[k] = v.slice(0, 2000);
  }
  return out;
}

// ---------------------------------------------------------- sync/book ----
api.options("/sync/book", preflight);

api.post("/sync/book", subida.any(), async (req, res) => {
  try {
    const form = leerForm(req);
    const bruto = form.get("book");
    if (typeof bruto !== "string") {
      res.status(400).set(cabecerasSync(origenDe(req))).json({ error: "Falta el libro (campo book)" });
      return;
    }
    let entrante: unknown;
    try {
      entrante = JSON.parse(bruto);
    } catch {
      res.status(400).set(cabecerasSync(origenDe(req))).json({ error: "El libro no es JSON válido" });
      return;
    }
    if (!libroApto(entrante)) {
      res.status(400).set(cabecerasSync(origenDe(req))).json({
        error: "El libro llegó incompleto (nombre, título o páginas)",
      });
      return;
    }

    const file = form.get("file");
    const esFichero = file instanceof File && file.size > 0;
    if (esFichero) {
      const f = file as File;
      const lower = f.name.toLowerCase();
      const ok =
        f.type === "application/pdf" || lower.endsWith(".pdf") ||
        f.type === "application/epub+zip" || lower.endsWith(".epub");
      if (!ok) {
        res.status(415).set(cabecerasSync(origenDe(req))).json({ error: "Aceptamos PDF y EPUB" });
        return;
      }
      if (f.size > 200 * 1024 * 1024) {
        res.status(413).set(cabecerasSync(origenDe(req))).json({ error: "El libro supera los 200 MB" });
        return;
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
        res.status(409).set(cabecerasSync(origenDe(req))).json({ error: "El libro desapareció durante la copia" });
        return;
      }
      const campos = camposGanadores(entrante, actual);

      // fichero: solo si llega (el receptor ya tiene el suyo si no viaja)
      let filePath = actual.filePath;
      let fileBytes = actual.fileBytes;
      let fileMissingAt = actual.fileMissingAt;
      if (esFichero) {
        const f = file as File;
        await mkdir(UPLOAD_DIR, { recursive: true });
        const ext = f.name.toLowerCase().endsWith(".epub") ? "epub" : "pdf";
        const nombre = `${id}.${ext}`;
        await writeFile(path.join(UPLOAD_DIR, nombre), Buffer.from(await f.arrayBuffer()));
        filePath = `/uploads/${nombre}`;
        fileBytes = f.size;
        fileMissingAt = null;
      }

      // portada: dataURL solo si el receptor no tiene ya una
      let coverPath = actual.coverPath;
      if (coverData && !coverPath) {
        await mkdir(UPLOAD_DIR, { recursive: true });
        const nombre = `${id}-cover.png`;
        await writeFile(path.join(UPLOAD_DIR, nombre), Buffer.from(coverData.split(",")[1] ?? "", "base64"));
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

      res.set(cabecerasSync(origenDe(req))).json({ book, matched: true });
      return;
    }

    // ---------- libro nuevo para el receptor ----------
    const usados = new Set(existentes.map((b) => b.id));
    const id = idAceptable(entrante.id, usados) ?? `b${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const esEpub = esFichero
      ? (file as File).name.toLowerCase().endsWith(".epub")
      : /\.epub$/i.test(entrante.fileName);

    let filePath: string;
    let fileBytes: number | null = null;
    let fileMissingAt: Date | null = null;
    if (esFichero) {
      const f = file as File;
      await mkdir(UPLOAD_DIR, { recursive: true });
      const nombre = `${id}.${esEpub ? "epub" : "pdf"}`;
      await writeFile(path.join(UPLOAD_DIR, nombre), Buffer.from(await f.arrayBuffer()));
      filePath = `/uploads/${nombre}`;
      fileBytes = f.size;
    } else {
      // degradación en silencio (Enmienda 1): el libro entra, su fichero falta
      fileMissingAt = new Date();
      filePath = `/uploads/${id}.${esEpub ? "epub" : "pdf"}`;
    }

    let coverPath: string | null = null;
    if (coverData) {
      await mkdir(UPLOAD_DIR, { recursive: true });
      const nombre = `${id}-cover.png`;
      await writeFile(path.join(UPLOAD_DIR, nombre), Buffer.from(coverData.split(",")[1] ?? "", "base64"));
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

    res.status(201).set(cabecerasSync(origenDe(req))).json({ book, matched: false });
  } catch (e) {
    console.error("POST /api/sync/book", e);
    res.status(500).set(cabecerasSync(origenDe(req))).json({ error: "La copia del libro falló" });
  }
});

// ---------------------------------------------------------- sync/meta ----
api.options("/sync/meta", preflight);

api.post("/sync/meta", async (req, res) => {
  try {
    const body = req.body as { settings?: unknown; vocab?: unknown };
    const actual = await leerAjustes();

    if (body.settings !== undefined) {
      const settings = saneaAjustes(body.settings);
      await escribirAjustes(settings, actual.biblioteca, actual._doc);
    }

    if (body.vocab !== undefined) {
      const filas = vocabSano(body.vocab);
      const vista = new Set<string>();
      const unicas = filas.filter((v) => {
        const clave = `${v.word.toLowerCase()}|${v.lang}`;
        if (vista.has(clave)) return false;
        vista.add(clave);
        return true;
      });
      await db.$transaction([
        db.vocab.deleteMany({}),
        ...unicas.map((v) =>
          db.vocab.create({
            data: {
              word: v.word,
              lang: v.lang,
              short: v.short,
              bookId: v.bookId ?? null,
              bookTitle: v.bookTitle,
              page: v.page,
              ...(v.createdAt ? { createdAt: new Date(v.createdAt) } : {}),
            },
          })
        ),
      ]);
    }

    res.set(cabecerasSync(origenDe(req))).json({ ok: true });
  } catch (e) {
    console.error("POST /api/sync/meta", e);
    res.status(500).set(cabecerasSync(origenDe(req))).json({ error: "La copia de ajustes/vocabulario falló" });
  }
});

// --------------------------------------------------- teleprompter/fondo ----
const MAX_FONDO_BYTES = 8 * 1024 * 1024;
const MIME_OK_FONDO = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);
const MIME_IMG: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

api.get("/teleprompter/fondo", async (req, res) => {
  try {
    const ruta = q(req, "ruta");
    if (!ruta.startsWith("/uploads/")) {
      res.status(404).json({ error: "Ruta inválida" });
      return;
    }
    const archivo = path.join(UPLOAD_DIR, path.basename(ruta));
    await stat(archivo);
    await servirFichero(req, res, archivo, MIME_IMG[path.extname(archivo).toLowerCase()] ?? "application/octet-stream");
  } catch {
    res.status(404).json({ error: "La imagen no está" });
  }
});

api.post("/teleprompter/fondo", subida.any(), async (req, res) => {
  try {
    const form = leerForm(req);
    const file = form.get("file") as File | null;
    if (!file || !MIME_OK_FONDO.has(file.type)) {
      res.status(415).json({ error: "Hace falta una imagen (png, jpg, webp o avif)" });
      return;
    }
    if (file.size > MAX_FONDO_BYTES) {
      res.status(413).json({ error: "La imagen pasa de 8 MB" });
      return;
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
    res.status(201).json({ ok: true, ruta });
  } catch (e) {
    console.error("POST /api/teleprompter/fondo", e);
    res.status(500).json({ error: "No se pudo guardar la imagen" });
  }
});

// ---------------------------------------------------------------- vocab ----
api.options("/vocab", preflight);

function aEntry(v: {
  id: string; word: string; lang: string; short: string;
  bookId: string | null; bookTitle: string; page: number; createdAt: Date;
}) {
  return {
    id: v.id,
    word: v.word,
    lang: v.lang === "en" ? ("en" as const) : ("es" as const),
    short: v.short,
    bookId: v.bookId ?? "",
    bookTitle: v.bookTitle,
    page: v.page,
    createdAt: v.createdAt.toISOString(),
  };
}

api.get("/vocab", async (req, res) => {
  try {
    const rows = await db.vocab.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    res.set(cabecerasSync(origenDe(req))).json({ vocabulary: rows.map(aEntry) });
  } catch (e) {
    console.error("GET /api/vocab", e);
    res.status(500).json({ error: "No se pudo leer el vocabulario" });
  }
});

api.post("/vocab", async (req, res) => {
  try {
    const body = req.body as {
      id?: string; word?: string; lang?: string; short?: string;
      bookId?: string; bookTitle?: string; page?: number;
    };
    const word = (body.word ?? "").trim();
    if (!word) {
      res.status(400).json({ error: "Falta la palabra" });
      return;
    }
    const lang = body.lang === "en" ? "en" : "es";

    // sin duplicados: palabra+idioma, sin importar la caja
    const palabras = await db.vocab.findMany({ where: { lang }, select: { word: true } });
    const lower = word.toLowerCase();
    const existente = palabras.find((p) => p.word.toLowerCase() === lower);
    if (existente) {
      const fila = await db.vocab.findFirst({ where: { word: existente.word, lang } });
      if (fila) {
        res.json({ entry: aEntry(fila), duplicated: true });
        return;
      }
    }

    try {
      const creado = await db.vocab.create({
        data: {
          id: body.id && body.id.length <= 32 ? body.id : undefined,
          word,
          lang,
          short: (body.short ?? "").slice(0, 2000),
          bookId: body.bookId && body.bookId !== "" ? body.bookId.slice(0, 64) : null,
          bookTitle: (body.bookTitle ?? "").slice(0, 200),
          page: Number.isFinite(body.page) ? Math.max(1, Math.round(Number(body.page))) : 1,
        },
      });
      res.status(201).json({ entry: aEntry(creado) });
    } catch (e2) {
      // carrera rara (dos pestañas a la vez): existe ya → se devuelve la viva
      const otraVez = palabras.find((p) => p.word.toLowerCase() === lower);
      if (otraVez) {
        const fila = await db.vocab.findFirst({ where: { word: otraVez.word, lang } });
        if (fila) {
          res.json({ entry: aEntry(fila), duplicated: true });
          return;
        }
      }
      console.error("POST /api/vocab", e2);
      res.status(500).json({ error: "No se pudo guardar la palabra" });
    }
  } catch (e) {
    console.error("POST /api/vocab", e);
    res.status(500).json({ error: "No se pudo guardar la palabra" });
  }
});

api.delete("/vocab/:id", async (req, res) => {
  try {
    const id = idDe(req);
    await db.vocab.delete({ where: { id } }).catch(() => null); // ya no está: fine
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/vocab/[id]", e);
    res.status(500).json({ error: "No se pudo borrar la palabra" });
  }
});

api.post("/vocab/import", async (req, res) => {
  try {
    const body = req.body as { entries?: unknown };
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) {
      res.json({ imported: 0 });
      return;
    }
    if (entries.length > 1000) {
      res.status(413).json({ error: "Demasiadas entradas (máx 1000)" });
      return;
    }

    const existentes = await db.vocab.findMany({ select: { word: true, lang: true } });
    const clave = (w: string, l: string) => `${l}\u0000${w.toLowerCase()}`;
    const yaEstan = new Set(existentes.map((v) => clave(v.word, v.lang)));

    const vistos = new Set<string>();
    const data: {
      word: string; lang: string; short: string;
      bookId: string | null; bookTitle: string; page: number;
    }[] = [];
    for (const e of entries as Record<string, unknown>[]) {
      const word = typeof e.word === "string" ? e.word.trim().slice(0, 200) : "";
      const lang = e.lang === "en" ? "en" : "es";
      if (!word) continue;
      const k = clave(word, lang);
      if (yaEstan.has(k) || vistos.has(k)) continue;
      vistos.add(k);
      data.push({
        word,
        lang,
        short: typeof e.short === "string" ? e.short.slice(0, 2000) : "",
        bookId: typeof e.bookId === "string" && e.bookId !== "" ? e.bookId.slice(0, 64) : null,
        bookTitle: typeof e.bookTitle === "string" ? e.bookTitle.slice(0, 200) : "",
        page: Number.isFinite(e.page) ? Math.max(1, Math.round(Number(e.page))) : 1,
      });
    }

    let imported = 0;
    if (data.length > 0) {
      const r = await db.vocab.createMany({ data });
      imported = r.count;
    }
    res.json({ imported });
  } catch (e) {
    console.error("POST /api/vocab/import", e);
    res.status(500).json({ error: "No se pudo importar el vocabulario" });
  }
});
