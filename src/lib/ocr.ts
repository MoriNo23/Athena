"use client";

/**
 * OCR bajo demanda para páginas escaneadas (PDF de solo imágenes).
 *
 * Estrategia "peso cero hasta que hace falta":
 * - El motor (Tesseract.js) NO va en el bundle: se descarga una sola vez desde
 *   CDN la primera vez que el usuario pulsa «OCR».
 * - Los datos de idioma usan la variante tessdata_fast (~1-2 MB por idioma en
 *   vez de 10-15 MB) y Tesseract los cachea en IndexedDB del navegador.
 * - Los resultados por página se cachean en IndexedDB propia (`riel-ocr`),
 *   así cada página escaneada se reconoce una única vez por libro+idioma.
 */

import type { PDFDocumentProxy } from "pdfjs-dist";

export type OcrLang = "spa" | "eng";

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  conf: number;
}

export interface OcrPageResult {
  lang: OcrLang;
  /** palabras limpias con caja en coordenadas del lienzo de OCR */
  words: OcrWord[];
  /** texto completo de la página (párrafos, des-hifenizado) */
  text: string;
  /** dimensiones del lienzo usado para el reconocimiento */
  width: number;
  height: number;
  avgConf: number;
}

// ---------------------------------------------------------------- CDN

const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.min.js";
/** datos de idioma "fast": ~1-2 MB vs ~10-15 MB de la variante estándar */
const TESSDATA_FAST = "https://tessdata.projectnaptha.com/4.0.0_fast";

interface TessWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
interface TessLine {
  words?: TessWord[];
}
interface TessParagraph {
  lines?: TessLine[];
}
interface TessBlock {
  paragraphs?: TessParagraph[];
}
interface TessData {
  text?: string;
  blocks?: TessBlock[] | null;
}
interface TessLoggerMessage {
  status: string;
  progress: number;
}
interface TessWorker {
  recognize(
    image: HTMLCanvasElement,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>
  ): Promise<{ data: TessData }>;
  terminate(): Promise<unknown>;
}
interface TessNamespace {
  createWorker(
    langs: string,
    oem?: number,
    options?: {
      langPath?: string;
      logger?: (m: TessLoggerMessage) => void;
      errorHandler?: (e: unknown) => void;
    }
  ): Promise<TessWorker>;
}

let libPromise: Promise<TessNamespace> | null = null;

/** Inyecta el script del motor una única vez (0 KB en el bundle de la app) */
function loadTesseract(): Promise<TessNamespace> {
  if (libPromise) return libPromise;
  libPromise = new Promise<TessNamespace>((resolve, reject) => {
    const w = window as unknown as { Tesseract?: TessNamespace };
    if (w.Tesseract) {
      resolve(w.Tesseract);
      return;
    }
    const script = document.createElement("script");
    script.src = TESSERACT_CDN;
    script.async = true;
    const timer = window.setTimeout(() => {
      libPromise = null;
      reject(new Error("timeout"));
    }, 45000);
    script.onload = () => {
      window.clearTimeout(timer);
      if (w.Tesseract) resolve(w.Tesseract);
      else {
        libPromise = null;
        reject(new Error("namespace"));
      }
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      libPromise = null;
      reject(new Error("network"));
    };
    document.head.appendChild(script);
  });
  return libPromise;
}

// ---------------------------------------------------------------- Workers

const workers = new Map<OcrLang, Promise<TessWorker>>();
/** receptor de progreso: solo la ejecución activa escucha al logger */
let progressSink: ((m: TessLoggerMessage) => void) | null = null;

function getWorker(lang: OcrLang): Promise<TessWorker> {
  let p = workers.get(lang);
  if (!p) {
    p = loadTesseract().then((T) =>
      T.createWorker(lang, 1, {
        langPath: TESSDATA_FAST,
        logger: (m) => progressSink?.(m),
        errorHandler: (e) => console.warn("OCR worker:", e),
      })
    );
    workers.set(lang, p);
    p.catch(() => workers.delete(lang)); // permite reintentar si falló
  }
  return p;
}

/** Cancela un OCR en curso (cambio de página): destruye el worker; el idioma ya descargado queda en caché de Tesseract */
export async function cancelOcr(lang: OcrLang): Promise<void> {
  const p = workers.get(lang);
  if (!p) return;
  workers.delete(lang);
  progressSink = null;
  try {
    const w = await p;
    await w.terminate();
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------- Progreso

/** mapa estado→[desde, hasta, etiqueta] para una barra suave 0..1 */
const PHASE_MAP: Record<string, [number, number, string]> = {
  "loading tesseract core": [0.05, 0.34, "Descargando motor OCR…"],
  "initializing tesseract": [0.34, 0.38, "Iniciando motor…"],
  "loading language traineddata": [0.38, 0.6, "Descargando idioma (solo la primera vez)…"],
  "loading language traineddata (from cache)": [0.38, 0.6, "Cargando idioma…"],
  "initializing tesseract api": [0.6, 0.66, "Preparando…"],
  "recognizing text": [0.66, 1.0, "Reconociendo texto…"],
};

function mapProgress(m: TessLoggerMessage): { f: number; phase: string } | null {
  const entry = PHASE_MAP[m.status];
  if (!entry) return null;
  const [from, to, phase] = entry;
  const f = from + (to - from) * Math.min(1, Math.max(0, m.progress));
  return { f, phase };
}

// ---------------------------------------------------------------- Caché IndexedDB

const DB_NAME = "riel-ocr";
const STORE = "pages";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 6 meses

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB"));
  });
}

function cacheKey(sourceKey: string, pageNum: number, lang: OcrLang): string {
  return `${sourceKey}#${pageNum}#${lang}`;
}

export async function getOcrCache(
  sourceKey: string,
  pageNum: number,
  lang: OcrLang
): Promise<OcrPageResult | null> {
  try {
    const db = await openDb();
    return await new Promise<OcrPageResult | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(cacheKey(sourceKey, pageNum, lang));
      req.onsuccess = () => {
        const v = req.result as (OcrPageResult & { ts: number }) | undefined;
        if (!v || Date.now() - v.ts > CACHE_TTL_MS) {
          resolve(null);
          return;
        }
        resolve(v);
      };
      req.onerror = () => reject(req.error ?? new Error("indexedDB"));
    });
  } catch {
    return null;
  }
}

export async function putOcrCache(
  sourceKey: string,
  pageNum: number,
  lang: OcrLang,
  result: OcrPageResult
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ ...result, ts: Date.now() }, cacheKey(sourceKey, pageNum, lang));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB"));
    });
  } catch {
    /* sin caché: el OCR funciona igual */
  }
}

// ---------------------------------------------------------------- Extracción

/** limpia signos de puntuación de los bordes sin tocar acentos/apóstrofes */
const EDGE_JUNK = /^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu;

function extractResult(data: TessData, lang: OcrLang, w: number, h: number): OcrPageResult {
  const words: OcrWord[] = [];
  let confSum = 0;
  for (const block of data.blocks ?? []) {
    for (const par of block.paragraphs ?? []) {
      for (const line of par.lines ?? []) {
        for (const wRaw of line.words ?? []) {
          const clean = (wRaw.text ?? "").replace(EDGE_JUNK, "");
          if (!clean) continue;
          const conf = typeof wRaw.confidence === "number" ? wRaw.confidence : 0;
          if (conf < 30) continue; // ruido
          const { x0, y0, x1, y1 } = wRaw.bbox;
          if (x1 <= x0 || y1 <= y0) continue;
          words.push({ text: clean, x0, y0, x1, y1, conf });
          confSum += conf;
        }
      }
    }
  }

  const text = (data.text ?? "")
    .replace(/\r/g, "")
    .replace(/(\p{L})-\n(\p{L})/gu, "$1$2") // des-hifenizar cortes de línea
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return {
    lang,
    words,
    text,
    width: w,
    height: h,
    avgConf: words.length ? Math.round(confSum / words.length) : 0,
  };
}

// ---------------------------------------------------------------- API principal

export interface RunOcrOptions {
  doc: PDFDocumentProxy;
  pageNum: number;
  /** clave estable del libro para la caché (p. ej. filePath) */
  sourceKey: string;
  lang: OcrLang;
  onProgress?: (fraction: number, phase: string) => void;
}

/**
 * Reconoce el texto de una página: renderiza la página a un lienzo offscreen
 * (resolución alta, ~1600 px de ancho) y lo pasa por Tesseract.
 */
export async function runOcrPage({
  doc,
  pageNum,
  lang,
  onProgress,
}: RunOcrOptions): Promise<OcrPageResult> {
  // 1) render offscreen a buena resolución
  const page = await doc.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  let scale = Math.min(2.4, Math.max(1.2, 1600 / base.width));
  const MAX_PX = 4_200_000; // techo de memoria para el lienzo
  if (base.width * base.height * scale * scale > MAX_PX) {
    scale = Math.sqrt(MAX_PX / (base.width * base.height));
  }
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise;

  // 2) reconocimiento con progreso traducido a 0..1
  onProgress?.(0.02, "Descargando motor OCR…");
  const worker = await getWorker(lang);
  progressSink = (m) => {
    const mapped = mapProgress(m);
    if (mapped) onProgress?.(mapped.f, mapped.phase);
  };
  try {
    const ret = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const result = extractResult(ret.data, lang, canvas.width, canvas.height);
    onProgress?.(1, "Listo");
    return result;
  } finally {
    progressSink = null;
  }
}
