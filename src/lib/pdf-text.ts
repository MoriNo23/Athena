/*
 * Modo texto del PDF (tarea 4.1 del change «Teleprompter y lector»).
 *
 * Módulo PURO (sin pdf.js ni DOM): ítems de texto → líneas → párrafos, con
 * heurística conservadora de títulos y paginación que reutiliza las reglas del
 * EPUB (`paginateEpub`). Doble índice para que el aparato de progreso siga
 * hablando de páginas reales: `pageStart` (virtual → real) y `realToVirtual`
 * (real → virtual).
 *
 * Espejo de tests: scripts/test-pdf-text.ts
 */
import { paginateEpub, type EpubPage } from "@/lib/epub";

// ---------- Entrada: ítems de texto de pdf.js ----------

/** Subconjunto de un ítem de `getTextContent()` que la heurística necesita. */
export interface PdfTextItem {
  str: string;
  width: number;
  height: number;
  /** [a, b, c, d, e, f]: e = X, f = Y (pdf.js: Y crece hacia arriba) */
  transform: number[];
  /** nombre de fuente (para señalar negrita); opcional en fixtures */
  fontName?: string;
}

// ---------- Salida: bloques de la casa (mismos que el EPUB) ----------

export type PdfTextKind = "h2" | "h3" | "p";

export interface PdfTextBlock {
  kind: PdfTextKind;
  /** html inline (texto escapado; el PDF no trae marcado) */
  html: string;
  /** texto plano (teleprompter, peek) */
  text: string;
  words: number;
}

export interface PdfVirtualPage {
  blocks: PdfTextBlock[];
  words: number;
  /** página real (1-based) del primer bloque de esta página virtual */
  realPage: number;
}

export interface PdfTextIndex {
  pages: PdfVirtualPage[];
  /** página real (1-based) de origen de cada página virtual */
  pageStart: number[];
  /**
   * Índice por página real - 1: primera página virtual cuya página real de
   * origen es ≥ esa página (una página sin texto mapea a la siguiente con
   * contenido); se fija al final del libro; -1 si no hay páginas virtuales.
   */
  realToVirtual: number[];
  /** páginas reales sin texto extraíble (1-based) */
  emptyRealPages: number[];
}

// ---------- Ítems → líneas → párrafos (puro, compartido) ----------

export interface PdfParagraph {
  text: string;
  /** líneas de texto que forman el párrafo */
  lines: number;
  /** altura máxima de letra observada */
  height: number;
  /** borde superior (Y + alto) del párrafo; Y de pdf.js crece hacia arriba */
  top: number;
  /** borde inferior (Y del último renglón) */
  bottom: number;
  /** algún fragmento con fuente en negrita */
  bold: boolean;
}

/** Ítems válidos de `getTextContent()` para la heurística */
export function pdfTextItems(raw: unknown[]): PdfTextItem[] {
  return (raw as PdfTextItem[]).filter(
    (it) => it && typeof it.str === "string" && it.str.length > 0 && Array.isArray(it.transform),
  );
}

/**
 * Agrupa ítems de pdf.js en párrafos: líneas por coordenada Y (tolerancia
 * relativa al alto mediano) y párrafos por salto vertical > 1.45 × el
 * interlineado base. Misma lógica que alimenta al teleprompter.
 * Espera ítems ya filtrados por `pdfTextItems` (con `transform` real).
 */
export function pdfItemsToParagraphs(items: PdfTextItem[]): PdfParagraph[] {
  if (items.length === 0) return [];

  // --- agrupar en líneas por Y (arriba → abajo) ---
  const heights = items.map((it) => Math.abs(it.height) || 10).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 10;
  const yTol = Math.max(2, medianH * 0.6);

  const sorted = [...items].sort((a, b) => {
    const ya = a.transform[5];
    const yb = b.transform[5];
    if (Math.abs(ya - yb) > yTol) return yb - ya; // Y de pdf.js crece hacia arriba
    return a.transform[4] - b.transform[4];
  });

  interface Line {
    y: number;
    x0: number;
    x1: number;
    text: string;
    height: number;
    bold: boolean;
  }
  const lines: Line[] = [];
  for (const it of sorted) {
    const y = it.transform[5];
    const x = it.transform[4];
    const xEnd = x + (it.width || 0);
    const h = Math.abs(it.height) || 10;
    const bold = /bold|black|heavy|semibold/i.test(it.fontName ?? "");
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - y) <= yTol) {
      // hueco notable ⇒ espacio implícito entre fragmentos
      const gap = x - last.x1;
      const sep = gap > 1 && !last.text.endsWith(" ") && !it.str.startsWith(" ") ? " " : "";
      last.text += sep + it.str;
      last.x1 = Math.max(last.x1, xEnd);
      last.height = Math.max(last.height, h);
      last.bold = last.bold || bold;
    } else {
      lines.push({ y, x0: x, x1: xEnd, text: it.str, height: h, bold });
    }
  }

  // --- agrupar líneas en párrafos por salto vertical ---
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    if (g > 0) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  // Interlineado base = cuartil bajo de los huecos, no la mediana: en páginas
  // cortas los saltos entre párrafos (y el hueco bajo el título) son la mitad
  // de la población e inflarían la mediana hasta fundir el título con el
  // primer párrafo (visto en los PDF de reportlab del catálogo).
  const medianGap = gaps.length > 0 ? gaps[Math.floor((gaps.length - 1) * 0.25)] : medianH * 1.2;
  const paraGap = Math.max(medianGap * 1.45, medianH * 1.5);

  const paragraphs: PdfParagraph[] = [];
  let buf = "";
  let bufLines = 0;
  let bufHeight = 0;
  let bufTop = 0;
  let bufBottom = 0;
  let bufBold = false;
  const push = () => {
    if (!buf) return;
    paragraphs.push({ text: buf, lines: bufLines, height: bufHeight, top: bufTop, bottom: bufBottom, bold: bufBold });
    buf = "";
    bufLines = 0;
    bufHeight = 0;
    bufTop = 0;
    bufBottom = 0;
    bufBold = false;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.text.trim();
    if (!t) continue;
    buf += (buf ? (/[‑-]$/.test(buf) ? "" : " ") : "") + t;
    bufLines += 1;
    bufHeight = Math.max(bufHeight, line.height);
    bufTop = Math.max(bufTop, line.y + line.height);
    bufBottom = bufBottom === 0 ? line.y : Math.min(bufBottom, line.y);
    bufBold = bufBold || line.bold;
    if (i + 1 < lines.length) {
      const g = lines[i].y - lines[i + 1].y;
      if (g > paraGap) push();
    }
  }
  push();

  return paragraphs;
}

// ---------- Heurística de títulos (conservadora) ----------

/**
 * ¿El párrafo es un título? Reglas del change (D2): 1–2 líneas, ≤ ~40
 * caracteres o ≤ ~6 palabras, sin puntuación final, inicio en mayúscula o
 * dígito. La altura/negrita solo elige nivel: con señal fuerte, `h2`; sin
 * ella, `h3` (nunca sube a `h1`: eso es el título del libro).
 */
export function isPdfHeading(p: PdfParagraph, medianHeight: number): "h2" | "h3" | null {
  const text = p.text.trim();
  if (!text) return null;
  if (p.lines > 2) return null;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (text.length > 40 && words > 6) return null;
  if (/[.,;:!?…]$/.test(text)) return null;
  if (!/^[A-ZÁÉÍÓÚÜÑ0-9]/.test(text)) return null;
  return p.bold || p.height > medianHeight * 1.15 ? "h2" : "h3";
}

// ---------- Página real → bloques ----------

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface PdfExtractOptions {
  /** alto de página en puntos (pdf.js); activa el descarte de encabezados y folios */
  pageHeight?: number;
}

// Margen físico aproximado: ahí solo viven el encabezado corrido y el folio.
// Se exige además que el párrafo sea corto (el mobiliario nunca es largo), así
// un título real pegado al borde no se pierde.
const FURNITURE_TOP = 0.94;
const FURNITURE_BOTTOM = 0.06;
const FURNITURE_MAX_CHARS = 90;

/** Bloques de una página real del PDF (para el modo texto reflowable). */
export function extractPdfPageBlocks(items: PdfTextItem[], opts: PdfExtractOptions = {}): PdfTextBlock[] {
  const H = opts.pageHeight ?? 0;
  let paragraphs = pdfItemsToParagraphs(items);
  if (H > 0) {
    paragraphs = paragraphs.filter(
      (p) =>
        !(
          (p.top > H * FURNITURE_TOP || p.bottom < H * FURNITURE_BOTTOM) &&
          p.text.trim().length <= FURNITURE_MAX_CHARS
        ),
    );
  }
  if (paragraphs.length === 0) return [];
  // Mediana de alturas de letra de la página (el cuerpo domina la población):
  // la señal de título es «más alto que el cuerpo». La negrita por nombre de
  // fuente es solo un extra: pdf.js ofusca el nombre en muchas fuentes.
  const heights = items.map((it) => Math.abs(it.height) || 10).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 10;
  return paragraphs.map((p) => {
    const text = p.text.replace(/\s+/g, " ").trim();
    const kind = isPdfHeading({ ...p, text }, medianH) ?? "p";
    return { kind, text, html: escapeHtml(text), words: text.split(/\s+/).filter(Boolean).length };
  });
}

/** Texto plano de páginas virtuales: párrafos separados por «\n\n» (motor teleprompter). */
export function pdfPageText(blocks: PdfTextBlock[] | undefined): string {
  if (!blocks) return "";
  return blocks
    .map((b) => b.text)
    .filter((t) => t.trim().length > 0)
    .join("\n\n");
}

// ---------- Paginación con reglas del EPUB + doble índice + fold incremental ----------

/**
 * Fold incremental: añade a un índice ya plegado (páginas reales 1..baseIndex0)
 * las páginas reales nuevas que le siguen. Es EXACTO respecto a re-paginar el
 * prefijo completo: `paginateEpub` nunca funde páginas de capítulos distintos,
 * así que cada página real se pagina por su cuenta y el fold es pura
 * concatenación + doble índice recalculado (barato).
 */
export function foldPdfTextIndex(
  prev: PdfTextIndex | null,
  nuevas: PdfTextBlock[][],
  baseIndex0: number,
): PdfTextIndex {
  const agregadas = paginatePdfTextSolo(nuevas);
  const pages: PdfVirtualPage[] = [
    ...(prev?.pages ?? []),
    ...agregadas.pages.map((p) => ({ ...p, realPage: p.realPage + baseIndex0 })),
  ];
  const pageStart = pages.map((p) => p.realPage);

  const realToVirtual: number[] = [];
  let v = 0;
  for (let r = 1; r <= baseIndex0 + nuevas.length; r++) {
    while (v < pageStart.length && pageStart[v] < r) v += 1;
    realToVirtual.push(pages.length > 0 ? Math.min(v, pages.length - 1) : -1);
  }

  const emptyRealPages = [
    ...(prev?.emptyRealPages ?? []),
    ...nuevas.map((bloques, i) => (bloques.length > 0 ? 0 : baseIndex0 + i + 1)).filter((n) => n > 0),
  ];

  return { pages, pageStart, realToVirtual, emptyRealPages };
}

/**
 * Páginas virtuales (~320 palabras) a partir de las páginas reales extraídas.
 * Reglas de `paginateEpub`: un bloque nunca se parte y una cola corta se
 * funde con la anterior (dentro de la misma página real).
 */
export function paginatePdfText(realPages: PdfTextBlock[][]): PdfTextIndex {
  return foldPdfTextIndex(null, realPages, 0);
}

/** El paginador base: páginas virtuales + reales de origen, sin doble índice global. */
function paginatePdfTextSolo(realPages: PdfTextBlock[][]): { pages: PdfVirtualPage[] } {
  const raw: EpubPage[] = paginateEpub(realPages);
  return {
    pages: raw.map((p) => ({
      blocks: p.blocks as unknown as PdfTextBlock[],
      words: p.words,
      realPage: p.chapter + 1,
    })),
  };
}
