"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ensurePdfTextPage,
  getPdfTextPage,
  getPdfTextSnapshot,
  preparePdfText,
  subscribePdfText,
  type PdfTextSnapshot,
} from "@/lib/pdf-text-index";
import type { PdfTextBlock } from "@/lib/pdf-text";

const IDLE: PdfTextSnapshot = { ready: 0, total: 0, done: false, extracted: 0 };

export interface PdfTextPrep extends PdfTextSnapshot {
  /** bloques de una página real ya extraída (`undefined` = aún no lista) */
  page: (page: number) => PdfTextBlock[] | undefined;
  /** adelanta la página (prioridad del riel) y espera a que esté lista */
  ensurePage: (page: number) => Promise<void>;
}

/**
 * Prepara el texto de un PDF en segundo plano (D3): arranca el bombeo al haber
 * doc y expone progreso, páginas listas y prioridad para el riel.
 */
export function usePdfText(key: string | null, doc: PDFDocumentProxy | null): PdfTextPrep {
  const subscribe = useCallback(
    (cb: () => void) => (key ? subscribePdfText(key, cb) : () => {}),
    [key],
  );
  const getSnapshot = useCallback(() => (key ? getPdfTextSnapshot(key) : IDLE), [key]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => IDLE);

  useEffect(() => {
    if (key && doc) preparePdfText(key, doc);
  }, [key, doc]);

  const page = useCallback(
    (p: number) => (key ? getPdfTextPage(key, p) : undefined),
    [key],
  );
  const ensurePage = useCallback(
    (p: number) => (key ? ensurePdfTextPage(key, p) : Promise.resolve()),
    [key],
  );

  return { ...snapshot, page, ensurePage };
}
