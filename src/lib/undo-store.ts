import { mkdir, readdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";
import { raizDatos, raizUploads } from "@/lib/data-home";

/**
 * Papelera con deshacer para libros borrados. Al eliminar:
 *  - los archivos (PDF/portada/compañero) se MUEVEN a db/undo-trash/<id>/
 *  - una instantánea (ficha + sesiones + insignia + nombres de archivo) se
 *    guarda en db/undo/<id>.json con su hora de borrado
 * Si el usuario pulsa «Deshacer» antes del TTL, todo vuelve a su sitio. Si no,
 * el siguiente barrido (DELETE/UNDO/GET de libros) purga la basura vencida.
 * Con ATHENA_HOME las raíces son <casa>/db y <casa>/uploads (data-home.ts);
 * se resuelven POR LLAMADA para conservar el patrón sandbox/chdir de los tests.
 */

const dirUndo = () => path.join(raizDatos(), "undo");
const dirPapelera = () => path.join(raizDatos(), "undo-trash");
const dirUploads = () => raizUploads();

export const UNDO_TTL_MS = 30_000;

/**
 * id de fila (cuid/uuid) usable para armar rutas sin traversal: los <id> del
 * body/params entran aquí ANTES de tocar path.join (POST undo, DELETE libro).
 */
export function esIdSeguro(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{7,63}$/i.test(id);
}

export interface UndoSnapshot {
  deletedAt: number;
  book: Record<string, unknown>; // fila completa del libro (fechas en ISO)
  badge: Record<string, unknown> | null;
  sessions: { pagesRead: number; minutes: number; date: string }[];
  files: { pdf: string; cover?: string; companion?: string }; // basenames en uploads/
}

export async function moveToTrash(bookId: string, names: string[]): Promise<void> {
  if (!esIdSeguro(bookId)) return;
  const dest = path.join(dirPapelera(), bookId);
  await mkdir(dest, { recursive: true });
  for (const name of names) {
    try {
      await rename(path.join(dirUploads(), name), path.join(dest, name));
    } catch {
      // archivo ya ausente: nada que mover
    }
  }
}

export async function saveSnapshot(bookId: string, snap: UndoSnapshot): Promise<void> {
  if (!esIdSeguro(bookId)) return;
  await mkdir(dirUndo(), { recursive: true });
  await writeFile(path.join(dirUndo(), `${bookId}.json`), JSON.stringify(snap), "utf8");
}

export async function readSnapshot(bookId: string): Promise<UndoSnapshot | null> {
  if (!esIdSeguro(bookId)) return null;
  try {
    const raw = await readFile(path.join(dirUndo(), `${bookId}.json`), "utf8");
    return JSON.parse(raw) as UndoSnapshot;
  } catch {
    return null;
  }
}

/** Devuelve los archivos de la papelera a uploads/ (lo que exista) */
export async function restoreFiles(bookId: string, files: UndoSnapshot["files"]): Promise<void> {
  if (!esIdSeguro(bookId)) return;
  const src = path.join(dirPapelera(), bookId);
  for (const name of [files.pdf, files.cover, files.companion]) {
    if (!name) continue;
    try {
      await rename(path.join(src, name), path.join(dirUploads(), name));
    } catch {
      // no estaba en la papelera: no pasa nada
    }
  }
}

/** Borra instantánea + papelera de un libro (tras restaurar o caducar) */
export async function discardUndo(bookId: string): Promise<void> {
  if (!esIdSeguro(bookId)) return;
  await rm(path.join(dirUndo(), `${bookId}.json`), { force: true });
  await rm(path.join(dirPapelera(), bookId), { recursive: true, force: true });
}

/** Purga los deshaceres vencidos (mejor esfuerzo, un fallo no tumba al vecino) */
export async function sweepExpiredUndo(): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dirUndo());
  } catch {
    return; // ni carpeta hay: nada vencido
  }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    try {
      const raw = await readFile(path.join(dirUndo(), entry), "utf8");
      const snap = JSON.parse(raw) as UndoSnapshot;
      if (now - snap.deletedAt > UNDO_TTL_MS) {
        await discardUndo(path.basename(entry, ".json"));
      }
    } catch {
      // json corrupto (tras un crash): limpia también su papelera, que un PDF
      // de 200 MB no puede quedar huérfano para siempre
      const id = path.basename(entry, ".json");
      if (esIdSeguro(id)) await discardUndo(id);
      else await rm(path.join(dirUndo(), entry), { force: true });
    }
  }
}
