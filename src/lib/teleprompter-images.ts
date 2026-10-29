"use client";

/**
 * Figuras de páginas PDF para el teleprompter (change teleprompter-pausa-imagen).
 *
 * Detección: se recorre la lista de operadores de la página (API pública de
 * pdf.js) siguiendo la pila de transformaciones para calcular la caja de cada
 * `paintImageXObject`. Solo mandan figuras REALES: área ≥ 12 % de la página
 * y dimensiones ≥ 120 px en página base (descarta sellos, bullets y filetes).
 *
 * El recorte se hace con API 100 % pública: la página se renderiza UNA vez a
 * un canvas fuera de pantalla y las cajas se recortan de ahí a JPEG. Nada de
 * APIs internas de pdf.js (`page.objs`): si algo falla, la página fluye como
 * texto sin tarjeta — el teleprompter nunca se rompe por una figura.
 *
 * Las imágenes se AÑADEN AL FINAL de los bloques de texto de su página
 * (heurística v1: la figura aparece como lámina tras el texto — el orden
 * fino figura↔párrafo exige interpretar el flujo de contenido completo).
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfLib } from "@/lib/pdf-client";
import type { TeleprompterBlock } from "@/lib/teleprompter";

/** Área mínima de la figura respecto de la página (el SDD: ≥ 12 %). */
const AREA_MIN = 0.12;
/** Lado mínimo de una figura (px de página base): filetes y adornos fuera. */
const SIDE_MIN = 120;
/** Escala del render: ancho máx del canvas (calidad suficiente, memoria acotada) */
const RENDER_MAX_W = 1400;
const JPEG_QUALITY = 0.82;

interface ImageBox {
  /** x, y de esquina superior-IZQUIERDA en coords de página (Y hacia abajo) */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** cajas de las figuras de la página (null si no hay o si el análisis falla) */
async function cajasDeFiguras(doc: PDFDocumentProxy, pageNum: number): Promise<ImageBox[] | null> {
  try {
    const lib = await loadPdfLib();
    const { OPS } = lib;
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();
    const { fnArray, argsArray } = ops;
    const stack: number[][] = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    const cajas: ImageBox[] = [];
    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      if (fn === OPS.save) {
        stack.push(ctm.slice());
      } else if (fn === OPS.restore) {
        ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      } else if (fn === OPS.transform) {
        const m = argsArray[i] as number[];
        if (!Array.isArray(m) || m.length < 6) continue;
        ctm = mul(ctm, m);
      } else if (
        fn === OPS.paintImageXObject ||
        fn === OPS.paintInlineImageXObject ||
        fn === OPS.paintImageMaskXObject ||
        fn === OPS.paintImageXObjectRepeat ||
        fn === OPS.paintImageMaskXObjectRepeat
      ) {
        // la imagen se pinta en el cuadrado unitario escalado por la CTM
        const [a, b, , , e, f] = ctm;
        const w = Math.abs(a);
        const h = Math.abs(b === 0 ? ctm[3] : b);
        const width = Math.max(w, 0);
        const height = Math.max(h, 0);
        if (width < SIDE_MIN || height < SIDE_MIN) continue;
        if (width * height < viewport.width * viewport.height * AREA_MIN) continue;
        cajas.push({
          x: e,
          y: viewport.height - (f + height),
          w: width,
          h: height,
        });
      }
    }
    page.cleanup();
    return cajas;
  } catch {
    return null; // sin análisis no hay tarjetas: la página fluye como texto
  }
}

/** multiplicación de matrices 3×3 afines (a·b) en formato [a,b,c,d,e,f] */
function mul(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/** renderiza la página a un canvas fuera de pantalla (API pública page.render) */
async function renderPagina(doc: PDFDocumentProxy, pageNum: number): Promise<HTMLCanvasElement | null> {
  try {
    const page = await doc.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, RENDER_MAX_W / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport, background: "#ffffff" }).promise;
    page.cleanup();
    return canvas;
  } catch {
    return null;
  }
}

function recortar(canvas: HTMLCanvasElement, caja: ImageBox, escala: number): string | null {
  try {
    const x = Math.max(0, Math.floor(caja.x * escala) - 2);
    const y = Math.max(0, Math.floor(caja.y * escala) - 2);
    const w = Math.min(canvas.width - x, Math.ceil(caja.w * escala) + 4);
    const h = Math.min(canvas.height - y, Math.ceil(caja.h * escala) + 4);
    if (w <= 4 || h <= 4) return null;
    const recorte = document.createElement("canvas");
    recorte.width = w;
    recorte.height = h;
    const ctx = recorte.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return recorte.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    return null;
  }
}

/**
 * Tarjetas de imagen (bloques con `image`) de una página PDF MIXTA (texto +
 * figura). Las páginas 100 % escaneadas NO generan tarjeta: el teleprompter
 * las sigue saltando (el OCR es su camino, ver tp.emptyBody).
 */
export async function extractPdfPageImageBlocks(
  doc: PDFDocumentProxy,
  pageNum: number
): Promise<TeleprompterBlock[]> {
  const cajas = await cajasDeFiguras(doc, pageNum);
  if (!cajas || cajas.length === 0) return [];
  // ¿página mixta? si no hay texto extraíble, es escaneada: no tarjeta
  try {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const chars = content.items.reduce(
      (n, it) => n + (typeof (it as { str?: unknown }).str === "string" ? (it as { str: string }).str.length : 0),
      0
    );
    page.cleanup();
    if (chars < 24) return [];
  } catch {
    return [];
  }
  const canvas = await renderPagina(doc, pageNum);
  if (!canvas) return [];
  const base = (await doc.getPage(pageNum)).getViewport({ scale: 1 });
  const escala = canvas.width / base.width;
  const bloques: TeleprompterBlock[] = [];
  for (const caja of cajas) {
    const src = recortar(canvas, caja, escala);
    if (src) bloques.push({ kind: "p", text: "", image: src });
  }
  return bloques;
}
