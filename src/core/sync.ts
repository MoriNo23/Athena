/**
 * Copia de la casa (Enmienda 1 de PRODUCT.md): sincronización directa entre
 * dispositivos de la dueña — el APK (motor offline) ↔ el servidor — por LAN,
 * SIEMPRE a mano («el dispositivo que manda»), nunca en segundo plano.
 *
 * Este módulo es el lado SERVIDOR de las reglas de fusión: recibe el estado
 * que manda un dispositivo y lo convierte en escrituras seguras de la BD.
 * El lado APK vive espejado en public/athena-offline.js (mismo espíritu que
 * los contratos del API). Reglas de la casa:
 *
 * - Identidad de un libro entre máquinas: primero `id` (una copia anterior),
 *   luego `fileName` + `totalPages` — la misma convención anti-duplicado de
 *   POST /api/books. Mismo fichero fuente subido en dos máquinas comparte
 *   nombre; eso basta y no inventa metadatos.
 * - Fusión NO destructiva: los libros que solo existen en el receptor se
 *   quedan (una copia nunca borra). «El que manda» gana en los campos del
 *   libro, sus sesiones por día y su insignia.
 * - Degradación en silencio: un libro cuyo fichero no llegó se registra con
 *   `fileMissingAt` (la casa ya sabe convivir con ficheros ausentes).
 */
import { BookDTO } from "@/core/types";

export const MAX_SESIONES_SYNC = 5000;
export const MAX_VOCAB_SYNC = 500;
export const MAX_EXTRAS_SYNC = 512 * 1024; // espejo de MAX_EXTRAS del motor

/** fila de sesión por día, tal como viaja en la copia (GET /api/books) */
export interface SesionSync {
  pagesRead: number;
  minutes: number;
  date: string; // ISO o YYYY-MM-DDT12:00:00
}

/** insignia tal como viaja en la copia */
export interface InsigniaSync {
  tier: number;
  readings: number;
  earnedAt?: string | null;
  updatedAt?: string | null;
}

/** libro tal como viaja en la copia (superconjunto del BookDTO que hace falta) */
export interface LibroSync {
  id?: string;
  title: string;
  author: string | null;
  fileName: string;
  totalPages: number;
  currentPage: number;
  milestones?: number | null;
  dailyGoal?: number | null;
  extras?: unknown;
  finishedAt?: string | null;
  readCount?: number;
  lastReadAt?: string | null;
  createdAt?: string | null;
  badge?: InsigniaSync | null;
  sessions?: SesionSync[];
}

export interface VocabSync {
  id?: string;
  word: string;
  lang: "es" | "en";
  short: string;
  bookId?: string | null;
  bookTitle: string;
  page: number;
  createdAt?: string | null;
}

/** el libro entrante es apto para entrar a la casa (mínimos no negociables) */
export function libroApto(v: unknown): v is LibroSync {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.fileName === "string" &&
    b.fileName.trim().length > 0 &&
    b.fileName.length <= 255 &&
    typeof b.title === "string" &&
    b.title.trim().length > 0 &&
    Number.isFinite(Number(b.totalPages)) &&
    Number(b.totalPages) >= 1 &&
    Number(b.totalPages) <= 100000
  );
}

/** identidad de copia: id si viene, luego fileName+totalPages (convención anti-dup) */
export function emparejar(
  entrante: LibroSync,
  existentes: { id: string; fileName: string; totalPages: number }[]
): { id: string; fileName: string; totalPages: number } | null {
  if (entrante.id) {
    const porId = existentes.find((b) => b.id === entrante.id);
    if (porId) return porId;
  }
  const tp = Math.round(Number(entrante.totalPages));
  return (
    existentes.find((b) => b.fileName === entrante.fileName && b.totalPages === tp) ?? null
  );
}

/** id propuesto aceptable: patrón seguro de la casa y libre en el receptor */
export function idAceptable(
  id: unknown,
  usados: Set<string>
): string | null {
  if (typeof id !== "string") return null;
  if (!/^[a-z0-9][a-z0-9_-]{7,63}$/i.test(id)) return null;
  return usados.has(id) ? null : id;
}

/** página actual con clamp 1..totalPages (misma regla que PATCH de progreso) */
export function paginaSegura(v: unknown, totalPages: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, n), Math.max(1, Math.round(totalPages)));
}

/** hitos del libro: null o 2-40 (espejo del clamp de la casa) */
export function hitosSeguros(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(40, Math.max(2, n));
}

/** meta diaria del libro: null o 1-500 */
export function metaSegura(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(500, Math.max(1, n));
}

/** extras: objeto JSON ≤512 KB; otra cosa → null (la copia no rompe la casa) */
export function extrasSeguros(v: unknown): unknown | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "object") return null;
  try {
    if (JSON.stringify(v).length > MAX_EXTRAS_SYNC) return null;
  } catch {
    return null;
  }
  return v;
}

function fechaSegura(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export { fechaSegura };

/** sesiones por día sanas: números ≥0, fecha válida, tope de la casa */
export function sesionesSanas(v: unknown): SesionSync[] {
  if (!Array.isArray(v)) return [];
  const out: SesionSync[] = [];
  for (const raw of v.slice(0, MAX_SESIONES_SYNC)) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const pages = Math.max(0, Math.round(Number(s.pagesRead) || 0));
    const minutes = Math.max(0, Math.round(Number(s.minutes) || 0));
    const fecha = fechaSegura(s.date);
    if (pages <= 0 && minutes <= 0) continue;
    out.push({
      pagesRead: pages,
      minutes,
      date: fecha ? fecha.toISOString() : new Date().toISOString(),
    });
  }
  return out;
}

/** insignia sana (tier 1-4, readings ≥1) o null */
export function insigniaSana(v: unknown): InsigniaSync | null | undefined {
  if (v === undefined) return undefined; // "no viene" → no tocar
  if (v === null) return null; // "viene sin insignia" → quitar
  if (typeof v !== "object") return undefined;
  const b = v as Record<string, unknown>;
  const tier = Math.min(4, Math.max(1, Math.round(Number(b.tier) || 1)));
  const readings = Math.max(1, Math.round(Number(b.readings) || 1));
  return {
    tier,
    readings,
    earnedAt: fechaSegura(b.earnedAt)?.toISOString() ?? null,
    updatedAt: fechaSegura(b.updatedAt)?.toISOString() ?? null,
  };
}

/** vocabulario sano: palabra+idioma sin duplicar (sin importar la caja), tope 500 */
export function vocabSano(v: unknown): VocabSync[] {
  if (!Array.isArray(v)) return [];
  const out: VocabSync[] = [];
  const vistas = new Set<string>();
  for (const raw of v.slice(0, MAX_VOCAB_SYNC * 2)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const word = typeof r.word === "string" ? r.word.trim().slice(0, 100) : "";
    if (!word) continue;
    const lang = r.lang === "en" ? "en" : "es";
    const clave = `${word.toLowerCase()}|${lang}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const short = typeof r.short === "string" ? r.short.slice(0, 2000) : "";
    const page = Math.max(1, Math.round(Number(r.page) || 1));
    out.push({
      id: typeof r.id === "string" && r.id ? r.id.slice(0, 64) : undefined,
      word,
      lang,
      short,
      bookId: typeof r.bookId === "string" && r.bookId ? r.bookId : null,
      bookTitle: typeof r.bookTitle === "string" ? r.bookTitle.slice(0, 255) : "",
      page,
      createdAt: fechaSegura(r.createdAt)?.toISOString() ?? null,
    });
    if (out.length >= MAX_VOCAB_SYNC) break;
  }
  return out;
}

/**
 * Campos que "el que manda" escribe sobre el libro existente del receptor.
 * Devuelve SOLO los campos a actualizar (el receptor conserva id, filePath,
 * origin y su createdAt). coverPath lo resuelve la ruta (fichero binario).
 */
export function camposGanadores(
  entrante: LibroSync,
  _existente: Pick<BookDTO, "totalPages" | "currentPage">
): {
  title: string;
  author: string | null;
  totalPages: number;
  currentPage: number;
  milestones: number | null;
  dailyGoal: number | null;
  extras: unknown;
  finishedAt: Date | null;
  readCount: number;
  lastReadAt: Date | null;
} {
  const totalPages = Math.round(Number(entrante.totalPages));
  return {
    title: entrante.title.trim(),
    author: typeof entrante.author === "string" && entrante.author.trim() ? entrante.author.trim() : null,
    totalPages,
    currentPage: paginaSegura(entrante.currentPage, totalPages),
    milestones: hitosSeguros(entrante.milestones),
    dailyGoal: metaSegura(entrante.dailyGoal),
    extras: extrasSeguros(entrante.extras),
    finishedAt: fechaSegura(entrante.finishedAt),
    readCount: Math.max(0, Math.round(Number(entrante.readCount) || 0)),
    lastReadAt: fechaSegura(entrante.lastReadAt),
  };
}
