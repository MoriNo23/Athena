"use client";

/**
 * Motor del Modo Novela Visual.
 *
 * Todo lo que es TIMING vive aquí como funciones puras para poder auditarlo
 * con Python (scripts/audit_vn_timing.py) y testearlo con bun
 * (scripts/test-vn-engine.ts) sin montar la UI.
 *
 * Modelo temporal (validado matemáticamente):
 *  - Cada carácter se revela tras un retardo base derivado del WPS elegido:
 *        delayBase = 1000 / (wps · LETRAS_POR_PALABRA)
 *    con LETRAS_POR_PALABRA ≈ 6 (media española de palabra + espacio).
 *  - Los signos de puntuación añaden una pausa AL SIGUIENTE carácter,
 *    expresada en múltiplos del retardo base (así el ritmo respira igual
 *    en todas las velocidades):
 *        , ; :   →  PAUSA_COMA  (media respiración)
 *        . ? ! … →  PAUSA_PUNTO (respiración completa)
 *  - Las pausas no se acumulan en series ("..." = una pausa, no tres).
 *  - La pausa colgante tras el último carácter se descarta sola.
 */

import type { PDFDocumentProxy } from "pdfjs-dist";

// ---------- Constantes de ritmo (espejadas en scripts/audit_vn_timing.py) ----------

/** Media de letras por palabra en español (incluye el espacio separador). */
export const VN_LETTERS_PER_WORD = 6;

/** Pausa tras coma / punto y coma / dos puntos, en múltiplos del retardo base. */
export const VN_COMMA_PAUSE_LETTERS = 4;

/** Pausa tras punto / interrogación / exclamación / suspensivos, en múltiplos del retardo base. */
export const VN_PERIOD_PAUSE_LETTERS = 9;

const PUNCT_STRONG = new Set([".", "!", "?", "…"]);
const PUNCT_WEAK = new Set([",", ";", ":"]);

// ---------- Timeline ----------

export interface VnStep {
  /** carácter a revelar */
  char: string;
  /** ms a esperar ANTES de revelar este carácter (incluye pausa heredada) */
  delay: number;
}

export interface VnTimelineInfo {
  steps: VnStep[];
  totalMs: number;
  letters: number;
  commas: number;
  periods: number;
}

/**
 * Construye la línea de tiempo de revelado para un texto.
 * `wps === null` ⇒ modo Instantánea: todos los delays son 0.
 */
export function buildVnTimeline(text: string, wps: number | null): VnTimelineInfo {
  const chars = Array.from(text);
  if (chars.length === 0) {
    return { steps: [], totalMs: 0, letters: 0, commas: 0, periods: 0 };
  }
  if (wps == null) {
    return {
      steps: chars.map((char) => ({ char, delay: 0 })),
      totalMs: 0,
      letters: chars.filter((c) => /\S/.test(c)).length,
      commas: 0,
      periods: 0,
    };
  }

  const base = 1000 / (wps * VN_LETTERS_PER_WORD);
  const steps: VnStep[] = [];
  let pendingPause = 0;
  let commas = 0;
  let periods = 0;

  for (const char of chars) {
    steps.push({ char, delay: base + pendingPause });
    pendingPause = 0;
    if (PUNCT_STRONG.has(char)) {
      periods += 1;
      // máx en vez de suma: "..." o "?!" respiran UNA vez, no tres
      pendingPause = Math.max(pendingPause, base * VN_PERIOD_PAUSE_LETTERS);
    } else if (PUNCT_WEAK.has(char)) {
      commas += 1;
      pendingPause = Math.max(pendingPause, base * VN_COMMA_PAUSE_LETTERS);
    }
  }
  // pendingPause final se descarta solo: no hay más pasos que lo consuman.

  const totalMs = steps.reduce((acc, s) => acc + s.delay, 0);
  return {
    steps,
    totalMs,
    letters: chars.filter((c) => /\S/.test(c)).length,
    commas,
    periods,
  };
}

/** Retardo base en ms para un WPS dado (utilidad para UI y tests). */
export function vnBaseDelayMs(wps: number): number {
  return 1000 / (wps * VN_LETTERS_PER_WORD);
}

// ---------- De párrafos a tarjetas ----------

/** Trocea un párrafo en tarjetas de lectura cómoda cortando por frases. */
export function vnCardsFromParagraph(paragraph: string, maxChars = 320): string[] {
  const text = paragraph.replace(/\s+/g, " ").trim();
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  const sentences = text.split(/(?<=[.!?…»"])\s+/);
  const cards: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    // frase gigante sin puntos: corta por espacios cerca del tope
    if (sentence.length > maxChars) {
      if (current) {
        cards.push(current.trim());
        current = "";
      }
      let rest = sentence;
      while (rest.length > maxChars) {
        let cut = rest.lastIndexOf(" ", maxChars);
        if (cut < maxChars * 0.6) cut = maxChars;
        cards.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      current = rest;
      continue;
    }
    if ((current + " " + sentence).trim().length > maxChars) {
      cards.push(current.trim());
      current = sentence;
    } else {
      current = (current + " " + sentence).trim();
    }
  }
  if (current.trim()) cards.push(current.trim());
  return cards.filter(Boolean);
}

/** Convierte el texto plano de una página (párrafos separados por \\n\\n) en tarjetas. */
export function vnCardsFromPageText(pageText: string): string[] {
  const paragraphs = pageText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const cards: string[] = [];
  let pendingSmall: string | null = null;
  for (const p of paragraphs) {
    const pieces = vnCardsFromParagraph(p);
    // párrafo minúsculo (título, numeración): estrena el SIGUIENTE bloque
    if (p.length < 24 && pieces.length === 1) {
      pendingSmall = pendingSmall ? `${pendingSmall} ${pieces[0]}` : pieces[0];
      continue;
    }
    if (pendingSmall && pieces.length > 0) {
      cards.push(`${pendingSmall} ${pieces[0]}`);
      cards.push(...pieces.slice(1));
      pendingSmall = null;
    } else {
      cards.push(...pieces);
    }
  }
  if (pendingSmall) cards.push(pendingSmall);
  return cards;
}

// ---------- Extracción de texto de la página (pdf.js) ----------

interface TextItemLike {
  str: string;
  width: number;
  height: number;
  transform: number[];
  hasEOL?: boolean;
}

/**
 * Extrae el texto de una página agrupando ítems de pdf.js en líneas
 * (por coordenada Y) y líneas en párrafos (por salto vertical > 1.45 ×
 * el interlineado mediano). Devuelve párrafos separados por "\\n\\n".
 */
export async function extractVnPageText(doc: PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await doc.getPage(pageNum);
  const content = await page.getTextContent();
  const items = (content.items as unknown as TextItemLike[]).filter(
    (it) => it.str && it.str.length > 0 && Array.isArray(it.transform)
  );
  if (items.length === 0) return "";

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
  }
  const lines: Line[] = [];
  for (const it of sorted) {
    const y = it.transform[5];
    const x = it.transform[4];
    const xEnd = x + (it.width || 0);
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - y) <= yTol) {
      // hueco notable ⇒ espacio implícito entre fragmentos
      const gap = x - last.x1;
      const sep = gap > 1 && !last.text.endsWith(" ") && !it.str.startsWith(" ") ? " " : "";
      last.text += sep + it.str;
      last.x1 = Math.max(last.x1, xEnd);
    } else {
      lines.push({ y, x0: x, x1: xEnd, text: it.str });
    }
  }

  // --- agrupar líneas en párrafos por salto vertical ---
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    if (g > 0) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const medianGap = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : medianH * 1.2;
  const paraGap = Math.max(medianGap * 1.45, medianH * 1.5);

  const paragraphs: string[] = [];
  let buf = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].text.trim();
    if (!line) continue;
    if (!buf) {
      buf = line;
    } else {
      buf += (/[‑-]$/.test(buf) ? "" : " ") + line;
    }
    if (i + 1 < lines.length) {
      const g = lines[i].y - lines[i + 1].y;
      if (g > paraGap) {
        paragraphs.push(buf);
        buf = "";
      }
    }
  }
  if (buf) paragraphs.push(buf);

  return paragraphs.join("\n\n");
}
