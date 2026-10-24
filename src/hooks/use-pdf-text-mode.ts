"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePdfText } from "@/hooks/use-pdf-text";
import { useI18n } from "@/lib/i18n";
import { foldPdfTextIndex, type PdfTextIndex } from "@/lib/pdf-text";
import { probePdfTextLayer } from "@/lib/pdf-text-index";
import type { TeleprompterBlock } from "@/lib/teleprompter";
import type { BookDTO } from "@/lib/types";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface UsePdfTextModeOpts {
  book: BookDTO;
  doc: PDFDocumentProxy | null;
  isEpub: boolean;
  pageNum: number;
  /** navegación real (riel, hitos, guardado): la página real manda siempre */
  goToPage: (target: number, opts?: { silent?: boolean; noPause?: boolean }) => void;
  patchExtras: (patch: { readerMode?: "page" | "text" }) => void;
  /** modo guardado en el libro (`extras.readerMode`) */
  readerMode: "page" | "text" | undefined;
}

/**
 * Modo texto del PDF (Página | Texto): dominio completo del reflujo.
 *
 * El toggle solo se ofrece con capa de texto real y el modo se recuerda en el
 * libro (`extras.readerMode`). La extracción corre en segundo plano y el riel
 * puede adelantar la página que espera (`ensurePage`). La navegación virtual
 * deja la elección local solo dentro de su página real; lo demás se deriva de
 * `pageNum` (nada de espejos en efectos): riel, hitos y ETA siguen hablando de
 * páginas reales mientras el lector vive en páginas virtuales.
 */
export function usePdfTextMode({ book, doc, isEpub, pageNum, goToPage, patchExtras, readerMode }: UsePdfTextModeOpts) {
  const { t } = useI18n();

  const [hasTextLayer, setHasTextLayer] = useState(false);

  useEffect(() => {
    if (isEpub || !doc) return;
    let alive = true;
    probePdfTextLayer(doc)
      .then((ok) => alive && setHasTextLayer(ok))
      .catch(() => alive && setHasTextLayer(false));
    return () => {
      alive = false;
    };
  }, [isEpub, doc]);

  const textMode = !isEpub && hasTextLayer && readerMode === "text";

  // Extracción en segundo plano: la lectura arranca con el prefijo ya listo
  const {
    ready: textReady,
    total: textTotal,
    page: textPage,
    ensurePage: textEnsure,
  } = usePdfText(textMode ? book.id : null, textMode ? doc : null);

  /** páginas virtuales del prefijo extraído (null mientras no hay nada paginable) */
  const foldRef = useRef<{ token: string; base: number; index: PdfTextIndex } | null>(null);
  const textIndex = useMemo<PdfTextIndex | null>(() => {
    if (!textMode || textReady === 0) return null;
    let fold = foldRef.current;
    // el prefijo extraído es contiguo (pdf-text-index lo garantiza); si cambió
    // de libro o el fold es más largo que lo listo, arranca de cero
    if (!fold || fold.token !== book.id || fold.base > textReady) fold = null;
    const base = fold?.base ?? 0;
    if (textReady > base) {
      // solo plega lo NUEVO: el prefix 1..base ya está en fold.index
      const nuevas = Array.from({ length: textReady - base }, (_, i) => textPage(base + 1 + i) ?? []);
      fold = {
        token: book.id,
        base: textReady,
        index: foldPdfTextIndex(fold?.index ?? null, nuevas, base),
      };
      foldRef.current = fold;
    }
    return fold ? fold.index : null;
  }, [textMode, textReady, textPage, book.id]);

  // Navegación virtual: la elección local solo vale dentro de su página real;
  // lo demás se deriva de `pageNum` (nada de espejos en efectos).
  const [localVirtual, setLocalVirtual] = useState<number | null>(null);
  const textLastReal =
    textIndex && textIndex.pages.length > 0 ? textIndex.pageStart[textIndex.pages.length - 1] : 0;
  /** página real pedida por el riel que aún no es paginable (el visor espera con indicador) */
  const waitingReal = textMode && textIndex !== null && pageNum > textLastReal ? pageNum : null;
  /** página virtual actual (1-based) */
  const textVirtual = useMemo(() => {
    if (!textIndex || textIndex.pages.length === 0) return 1;
    if (
      localVirtual !== null &&
      localVirtual >= 1 &&
      localVirtual <= textIndex.pages.length &&
      textIndex.pageStart[localVirtual - 1] === pageNum
    ) {
      return localVirtual;
    }
    const v = textIndex.realToVirtual[pageNum - 1] ?? -1;
    return v >= 0 ? v + 1 : 1;
  }, [textIndex, pageNum, localVirtual]);

  // La página que espera el riel se adelanta en la extracción (prioridad)
  useEffect(() => {
    if (waitingReal === null) return;
    void textEnsure(waitingReal);
  }, [waitingReal, textEnsure]);

  /** Navegación virtual: la página real de origen manda para riel, hitos y ETA */
  const goToVirtual = useCallback(
    (v: number, opts?: { silent?: boolean; noPause?: boolean }) => {
      if (!textIndex || textIndex.pages.length === 0) return;
      const clamped = Math.max(1, Math.min(textIndex.pages.length, Math.round(v)));
      setLocalVirtual(clamped);
      goToPage(textIndex.pageStart[clamped - 1], opts);
    },
    [textIndex, goToPage]
  );

  /** Saltos de fuera del reflujo (riel, número de página, peek): sin ancla local */
  const jumpOutsideText = useCallback(
    (p: number, opts?: { silent?: boolean; noPause?: boolean }) => {
      setLocalVirtual(null);
      goToPage(p, opts);
    },
    [goToPage]
  );

  const setPdfReadingMode = useCallback(
    (mode: "page" | "text") => {
      patchExtras({ readerMode: mode });
    },
    [patchExtras]
  );

  /** modo texto con páginas virtuales listas: el teleprompter las consume */
  const tpTextMode = textMode && textIndex !== null && textIndex.pages.length > 0;

  /** bloques de una página virtual para el teleprompter (mismo contrato que el EPUB) */
  const tpVirtualBlocks = useCallback(
    async (v: number): Promise<TeleprompterBlock[]> => {
      const pages = textIndex?.pages;
      if (!pages || pages.length === 0) return [];
      const page = pages[Math.min(Math.max(1, Math.round(v)), pages.length) - 1];
      return page.blocks.map((b) => ({ kind: b.kind, text: b.text }));
    },
    [textIndex]
  );

  // Aviso de página sin texto: el riel pidió una página vacía y el flujo
  // continúa en la siguiente con contenido (realToVirtual ya la mapeó).
  const textEmptyNotice = useMemo(() => {
    if (!textMode || !textIndex || waitingReal !== null) return null;
    const page = textIndex.pages[textVirtual - 1];
    if (!page || page.realPage <= pageNum) return null;
    return t("reader.textEmptyPage", { n: pageNum, m: page.realPage });
  }, [textMode, textIndex, textVirtual, pageNum, waitingReal, t]);

  return {
    hasTextLayer,
    textMode,
    textReady,
    textTotal,
    textIndex,
    textVirtual,
    waitingReal,
    goToVirtual,
    jumpOutsideText,
    setPdfReadingMode,
    tpTextMode,
    tpVirtualBlocks,
    textEmptyNotice,
  };
}
