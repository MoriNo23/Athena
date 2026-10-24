"use client";

import "./map-get-or-insert-polyfill";
import type * as PdfjsModule from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

let libPromise: Promise<typeof PdfjsModule> | null = null;

/** Recursos estáticos desplegados en public/pdfjs (cmaps, fuentes estándar, wasm para ICC/JPX) */
export const PDFJS_ASSETS = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
} as const;

/** Carga perezosa de pdf.js en el cliente y configura el worker */
export async function loadPdfLib(): Promise<typeof PdfjsModule> {
  if (!libPromise) {
    libPromise = import("pdfjs-dist")
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        return lib;
      })
      .catch((e) => {
        // un fallo transitorio de red/chunk no debe quedar cacheado para siempre
        libPromise = null;
        throw e;
      });
  }
  return libPromise;
}

/** Libera el documento en el worker: `destroy` existe en runtime pero no en
    los tipos de pdfjs-dist; el cast vive aquí, no en cada visor. */
export function destruirPdfDoc(doc: PDFDocumentProxy): void {
  (doc as unknown as { destroy?: () => void }).destroy?.();
}

export interface PdfProbe {
  numPages: number;
  coverDataUrl: string | null;
  firstPageWidth: number;
  firstPageHeight: number;
}

/** Abre un File local, cuenta páginas y genera una portada pequeña */
export async function probePdf(file: File): Promise<PdfProbe> {
  const pdfjs = await loadPdfLib();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, ...PDFJS_ASSETS });
  const doc = await loadingTask.promise;

  try {
    const numPages = doc.numPages;

    let coverDataUrl: string | null = null;
    let firstPageWidth = 0;
    let firstPageHeight = 0;
    try {
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      firstPageWidth = base.width;
      firstPageHeight = base.height;
      const targetW = 240;
      const scale = targetW / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise;
        coverDataUrl = canvas.toDataURL("image/png");
      }
    } catch (e) {
      console.warn("No se pudo generar la portada", e);
    }

    return { numPages, coverDataUrl, firstPageWidth, firstPageHeight };
  } finally {
    try {
      loadingTask.destroy();
    } catch {
      /* noop */
    }
  }
}

/** Título legible a partir del nombre de archivo (PDF o EPUB) */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.(pdf|epub)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
