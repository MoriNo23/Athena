"use client";

/**
 * Motor del modo teleprompter.
 *
 * Todo lo que es TIMING vive aquí como funciones puras para poder auditarlo
 * con Python (scripts/audit_teleprompter_timing.py) y testearlo con bun
 * (scripts/test-teleprompter-engine.ts) sin montar la UI.
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
import { extractPdfPageBlocks, pdfTextItems } from "@/lib/pdf-text";

// ---------- Constantes de ritmo (espejadas en scripts/audit_teleprompter_timing.py) ----------

/** Media de letras por palabra en español (incluye el espacio separador). */
export const TELEPROMPTER_LETTERS_PER_WORD = 6;

/** Pausa tras coma / punto y coma / dos puntos, en múltiplos del retardo base. */
export const TELEPROMPTER_COMMA_PAUSE_LETTERS = 4;

/** Pausa tras punto / interrogación / exclamación / suspensivos, en múltiplos del retardo base. */
export const TELEPROMPTER_PERIOD_PAUSE_LETTERS = 9;

const PUNCT_STRONG = new Set([".", "!", "?", "…"]);
const PUNCT_WEAK = new Set([",", ";", ":"]);

// ---------- Timeline ----------

export interface TeleprompterStep {
  /** carácter a revelar */
  char: string;
  /** ms a esperar ANTES de revelar este carácter (incluye pausa heredada) */
  delay: number;
}

export interface TeleprompterTimelineInfo {
  steps: TeleprompterStep[];
  totalMs: number;
  letters: number;
  commas: number;
  periods: number;
}

/**
 * Construye la línea de tiempo de revelado para un texto.
 * `wps === null` ⇒ modo Instantánea: todos los delays son 0.
 */
export function buildTeleprompterTimeline(text: string, wps: number | null): TeleprompterTimelineInfo {
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

  const base = 1000 / (wps * TELEPROMPTER_LETTERS_PER_WORD);
  const steps: TeleprompterStep[] = [];
  let pendingPause = 0;
  let commas = 0;
  let periods = 0;

  for (const char of chars) {
    steps.push({ char, delay: base + pendingPause });
    pendingPause = 0;
    if (PUNCT_STRONG.has(char)) {
      periods += 1;
      // máx en vez de suma: "..." o "?!" respiran UNA vez, no tres
      pendingPause = Math.max(pendingPause, base * TELEPROMPTER_PERIOD_PAUSE_LETTERS);
    } else if (PUNCT_WEAK.has(char)) {
      commas += 1;
      pendingPause = Math.max(pendingPause, base * TELEPROMPTER_COMMA_PAUSE_LETTERS);
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
export function teleprompterBaseDelayMs(wps: number): number {
  return 1000 / (wps * TELEPROMPTER_LETTERS_PER_WORD);
}

// ---------- Flujo continuo: bloques → timeline por carácter ----------

/** Tipos de bloque que llegan del lector (EPUB real; PDF por heurística). */
export type TeleprompterBlockKind = "h1" | "h2" | "h3" | "h4" | "p" | "quote" | "li";

export interface TeleprompterBlock {
  kind: TeleprompterBlockKind;
  text: string;
}

/** Pausa antes de un título y antes del cuerpo que lo sigue, en letras. */
export const TELEPROMPTER_HEADING_PAUSE_LETTERS = 12;

/** Con Auto, espera antes de pasar a la página siguiente (ms): que el cambio no sea brusco */
export const TELEPROMPTER_PAGE_TURN_MS = 2000;

export interface TeleprompterStreamBlock extends TeleprompterBlock {
  /** primer carácter del bloque dentro del flujo (los bloques son contiguos) */
  start: number;
  /** caracteres del bloque */
  length: number;
  /** h1-h4: se presenta completo, sin encendido letra a letra */
  heading: boolean;
}

export interface TeleprompterStream {
  steps: TeleprompterStep[];
  blocks: TeleprompterStreamBlock[];
  totalMs: number;
}

const isHeadingKind = (kind: TeleprompterBlockKind) =>
  kind === "h1" || kind === "h2" || kind === "h3" || kind === "h4";

/**
 * Flujo de una página: bloques reales → timeline por carácter.
 * Los títulos aparecen completos: su primer carácter paga la pausa de título
 * (más la que traiga la puntuación anterior) y el resto no añade retardo; el
 * primer carácter del cuerpo tras un título paga otra pausa.
 */
export function buildTeleprompterStream(
  blocks: readonly TeleprompterBlock[],
  wps: number | null
): TeleprompterStream {
  const base = wps == null ? 0 : 1000 / (wps * TELEPROMPTER_LETTERS_PER_WORD);
  const steps: TeleprompterStep[] = [];
  const out: TeleprompterStreamBlock[] = [];
  let pending = 0;
  let prevHeading = false; // el bloque anterior fue un título

  for (const block of blocks) {
    const text = block.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const chars = Array.from(text);
    const heading = isHeadingKind(block.kind);
    const start = steps.length;

    for (let j = 0; j < chars.length; j++) {
      const char = chars[j];
      let delay = base + pending;
      pending = 0;
      if (heading) {
        // Un título que sigue a otro título (p. ej. portadilla de capítulo y
        // luego el título de la sección) NO acumula dos respiros: el del título
        // anterior ya se esperó (`pending`), así que se cuenta una sola vez.
        if (j === 0) {
          // `delay` ya incluye el respiro pendiente del título anterior
          if (!prevHeading) delay += base * TELEPROMPTER_HEADING_PAUSE_LETTERS;
        } else delay = 0; // el título se enciende de golpe
      }
      steps.push({ char, delay });
      if (heading) continue;
      if (PUNCT_STRONG.has(char)) {
        pending = Math.max(pending, base * TELEPROMPTER_PERIOD_PAUSE_LETTERS);
      } else if (PUNCT_WEAK.has(char)) {
        pending = Math.max(pending, base * TELEPROMPTER_COMMA_PAUSE_LETTERS);
      }
    }
    // el cuerpo no arranca hasta pasado el respiro del título
    if (heading) pending = Math.max(pending, base * TELEPROMPTER_HEADING_PAUSE_LETTERS);

    out.push({ kind: block.kind, text, start, length: chars.length, heading });
    prevHeading = heading;
  }

  const totalMs = steps.reduce((acc, s) => acc + s.delay, 0);
  return { steps, blocks: out, totalMs };
}

// ---------- Rebobinado (orden inverso y cruce de página) ----------

/** Caracteres visibles de una página (misma normalización que el flujo). */
export function teleprompterCharCount(blocks: readonly TeleprompterBlock[]): number {
  return blocks.reduce((n, b) => n + Array.from(b.text.replace(/\s+/g, " ").trim()).length, 0);
}

export interface TeleprompterCursor {
  /** página que se está leyendo (1-based) */
  page: number;
  /** caracteres encendidos en la página */
  lit: number;
}

/**
 * Rebobina un carácter. Dentro de la página apaga el último encendido; al
 * cruzar el inicio devuelve la página anterior con `lit === -1` (encendida
 * entera, sin re-tipeo); en la primera página no hay a dónde retroceder.
 */
export function teleprompterRewind(cursor: TeleprompterCursor): TeleprompterCursor | null {
  if (cursor.lit > 0) return { page: cursor.page, lit: cursor.lit - 1 };
  if (cursor.page > 1) return { page: cursor.page - 1, lit: -1 };
  return null;
}

// ---------- Extracción de bloques de la página (pdf.js) ----------

/**
 * Bloques de una página del PDF con la misma heurística que el modo texto
 * (títulos h2/h3 incluidos); así el teleprompter presenta el título completo.
 */
export async function extractPdfPageBlocksForTeleprompter(
  doc: PDFDocumentProxy,
  pageNum: number
): Promise<TeleprompterBlock[]> {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  return extractPdfPageBlocks(pdfTextItems(content.items), { pageHeight: viewport.height }).map((b) => ({
    kind: b.kind,
    text: b.text,
  }));
}
