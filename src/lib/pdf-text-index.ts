/*
 * Índice de texto del PDF, en memoria por sesión (tarea 4.2 del change
 * «Teleprompter y lector»).
 *
 * La preparación del modo texto no bloquea la lectura (D3): un único bombeo
 * por libro extrae página a página en segundo plano, publica progreso a los
 * suscriptores (coalescido para no re-renderizar a cada página) y atiende la
 * prioridad del riel: `ensurePdfTextPage` adelanta la página destino y deja
 * que el visor espere con indicador.
 *
 * Sin DB ni disco: un tomo de ~670 páginas ronda 1–2 MB de texto. Si el libro
 * se cierra a mitad de la preparación (doc destruido), se conserva lo extraído
 * y un `preparePdfText` posterior con el doc nuevo retoma donde quedó.
 *
 * Espejo de tests: scripts/test-pdf-text-prep.ts
 */
import type { PDFDocumentProxy } from "pdfjs-dist";
import { extractPdfPageBlocks, pdfTextItems, type PdfTextBlock } from "@/lib/pdf-text";

export interface PdfTextSnapshot {
  /** páginas consecutivas listas desde la 1: prefijo seguro para paginar */
  ready: number;
  /** páginas reales del libro */
  total: number;
  done: boolean;
  /** páginas extraídas, contando los adelantos de prioridad */
  extracted: number;
}

const IDLE: PdfTextSnapshot = { ready: 0, total: 0, done: false, extracted: 0 };

/** ms entre notificaciones a la UI durante el bombeo (coalescencia) */
const NOTIFY_MS = 150;

interface Entry {
  key: string;
  doc: PDFDocumentProxy | null;
  total: number;
  pages: (PdfTextBlock[] | undefined)[];
  /** cursor secuencial del bombeo (1-based) */
  cursor: number;
  ready: number;
  extracted: number;
  done: boolean;
  running: boolean;
  /** páginas pedidas con prioridad (riel), en orden de llegada */
  wanted: number[];
  waiters: Map<number, Array<() => void>>;
  snapshot: PdfTextSnapshot;
  lastNotify: number;
  trailing: ReturnType<typeof setTimeout> | null;
}

const CACHE = new Map<string, Entry>();

/** Suscriptores por libro: viven aunque el bombeo aún no exista (el hook se
 *  suscribe antes de que llegue el doc). */
const LISTENERS = new Map<string, Set<() => void>>();

function createEntry(key: string, doc: PDFDocumentProxy): Entry {
  const total = doc.numPages;
  return {
    key,
    doc,
    total,
    pages: new Array(total),
    cursor: 1,
    ready: 0,
    extracted: 0,
    done: total === 0,
    running: false,
    wanted: [],
    waiters: new Map(),
    snapshot: { ready: 0, total, done: total === 0, extracted: 0 },
    lastNotify: 0,
    trailing: null,
  };
}

/** Instantánea estable para `useSyncExternalStore` (misma referencia si nada cambió). */
export function getPdfTextSnapshot(key: string): PdfTextSnapshot {
  return CACHE.get(key)?.snapshot ?? IDLE;
}

export function subscribePdfText(key: string, cb: () => void): () => void {
  let set = LISTENERS.get(key);
  if (!set) {
    set = new Set();
    LISTENERS.set(key, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) LISTENERS.delete(key);
  };
}

function emit(key: string): void {
  const set = LISTENERS.get(key);
  if (set) for (const cb of set) cb();
}

/** Bloques de una página real ya extraída (`undefined` si aún no está lista). */
export function getPdfTextPage(key: string, page: number): PdfTextBlock[] | undefined {
  return CACHE.get(key)?.pages[page - 1];
}

/**
 * ¿El PDF trae capa de texto? Muestrea tres páginas repartidas (portada, mitad
 * y final: hay tomos con portada escaneada y cuerpo digital) y exige ~300
 * caracteres: un escaneo puro no llega, un libro digital lo supera de sobra.
 */
export async function probePdfTextLayer(doc: PDFDocumentProxy): Promise<boolean> {
  const total = doc.numPages;
  const samples = Array.from(new Set([1, Math.ceil(total / 2), total])).filter(
    (p) => p >= 1 && p <= total,
  );
  let chars = 0;
  for (const p of samples) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    chars += pdfTextItems(content.items).reduce((n, it) => n + it.str.trim().length, 0);
    if (chars >= 300) return true;
  }
  return chars >= 300;
}

/** Arranca (o reintenta) la preparación del libro `key` con este doc. */
export function preparePdfText(key: string, doc: PDFDocumentProxy): void {
  let e = CACHE.get(key);
  if (!e) {
    e = createEntry(key, doc);
    CACHE.set(key, e);
  } else {
    e.doc = doc;
  }
  if (e.done || e.running) return;
  void run(e);
}

/**
 * Adelanta la página (prioridad del riel) y espera a que esté lista. Resuelve
 * de inmediato si ya está extraída o si el bombeo no está vivo (el visor
 * decide qué mostrar con `getPdfTextPage`).
 */
export function ensurePdfTextPage(key: string, page: number): Promise<void> {
  const e = CACHE.get(key);
  if (!e || e.pages[page - 1] !== undefined || e.done || !e.running) return Promise.resolve();
  if (page >= 1 && page <= e.total && !e.wanted.includes(page)) e.wanted.push(page);
  return new Promise((resolve) => {
    const list = e.waiters.get(page);
    if (list) list.push(resolve);
    else e.waiters.set(page, [resolve]);
  });
}

/** Solo para tests: vacía la caché de sesión. */
export function resetPdfTextCache(): void {
  for (const e of CACHE.values()) {
    if (e.trailing) clearTimeout(e.trailing);
  }
  CACHE.clear();
  LISTENERS.clear();
}

// ---------- bombeo ----------

function nextPage(e: Entry): number | undefined {
  while (e.wanted.length > 0) {
    const p = e.wanted.shift() as number;
    if (p >= 1 && p <= e.total && e.pages[p - 1] === undefined) return p;
  }
  while (e.cursor <= e.total && e.pages[e.cursor - 1] !== undefined) e.cursor += 1;
  return e.cursor <= e.total ? e.cursor : undefined;
}

function flushWaiters(e: Entry, page: number): void {
  const list = e.waiters.get(page);
  if (!list) return;
  e.waiters.delete(page);
  for (const resolve of list) resolve();
}

function flushAllWaiters(e: Entry): void {
  for (const list of e.waiters.values()) for (const resolve of list) resolve();
  e.waiters.clear();
}

function notify(e: Entry): void {
  e.snapshot = { ready: e.ready, total: e.total, done: e.done, extracted: e.extracted };
  const now = performance.now();
  if (e.done) {
    if (e.trailing) {
      clearTimeout(e.trailing);
      e.trailing = null;
    }
    e.lastNotify = now;
    emit(e.key);
    return;
  }
  if (now - e.lastNotify >= NOTIFY_MS) {
    e.lastNotify = now;
    emit(e.key);
    return;
  }
  if (!e.trailing) {
    e.trailing = setTimeout(
      () => {
        e.trailing = null;
        e.lastNotify = performance.now();
        emit(e.key);
      },
      NOTIFY_MS - (now - e.lastNotify),
    );
  }
}

async function run(e: Entry): Promise<void> {
  e.running = true;
  notify(e); // publica `total` de inmediato (la UI ya muestra la preparación)
  try {
    while (!e.done) {
      const doc = e.doc;
      if (!doc) break;
      const page = nextPage(e);
      if (page === undefined) break;
      const proxy = await doc.getPage(page);
      const viewport = proxy.getViewport({ scale: 1 });
      const content = await proxy.getTextContent();
      e.pages[page - 1] = extractPdfPageBlocks(pdfTextItems(content.items), {
        pageHeight: viewport.height,
      });
      e.extracted += 1;
      flushWaiters(e, page);
      while (e.pages[e.ready] !== undefined) e.ready += 1;
      e.done = e.extracted >= e.total;
      notify(e);
    }
  } catch (err) {
    // doc destruido a mitad (libro cerrado): se conserva lo extraído y un
    // `preparePdfText` posterior con el doc nuevo retoma donde quedó
    flushAllWaiters(e);
    console.warn("preparación de texto del PDF interrumpida", err);
  } finally {
    e.running = false;
    notify(e);
  }
}
