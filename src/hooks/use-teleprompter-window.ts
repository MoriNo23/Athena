"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  buildTeleprompterStream,
  extractPdfPageBlocksForTeleprompter,
  teleprompterCharCount,
  type TeleprompterBlock,
} from "@/lib/teleprompter";

/** Ventana de lectura: la página actual y la siguiente (DOM acotado a dos) */
export interface StreamWindow {
  /** primera página de la ventana (1-based) */
  start: number;
  /** [página start, página start+1]; el segundo hueco puede no existir */
  pages: (TeleprompterBlock[] | null)[];
}

interface UseTeleprompterWindowOpts {
  doc: PDFDocumentProxy | null;
  /** EPUB: bloques reales de la página (h1-h4 en el flujo) */
  getPageBlocks?: (page: number) => Promise<TeleprompterBlock[]>;
  numPages: number;
  /** wps del preset activo: tempo del flujo encendido */
  presetWps: number | null;
}

/**
 * Capa de datos y DOM del teleprompter: carga de bloques con caché, ventana de
 * dos páginas (la actual y la siguiente), colección de spans del DOM y el
 * seguimiento de scroll que deja el carácter activo a ~40 % del alto visible.
 * El control de reproducción vive en `use-teleprompter-player`.
 */
export function useTeleprompterWindow({ doc, getPageBlocks, numPages, presetWps }: UseTeleprompterWindowOpts) {
  const [win, setWin] = useState<StreamWindow | null>(null);
  const winRef = useRef<StreamWindow | null>(null);
  const winSourceRef = useRef<string | null>(null);
  const cacheRef = useRef<Map<number, TeleprompterBlock[]>>(new Map());
  const spansRef = useRef<HTMLSpanElement[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ---------- carga de bloques (PDF: heurística compartida con el modo texto) ----
  const loadBlocks = useCallback(
    async (page: number): Promise<TeleprompterBlock[]> => {
      if (page < 1 || page > numPages) return [];
      const cached = cacheRef.current.get(page);
      if (cached) return cached;
      const blocks = getPageBlocks
        ? await getPageBlocks(page)
        : doc
          ? await extractPdfPageBlocksForTeleprompter(doc, page)
          : [];
      cacheRef.current.set(page, blocks);
      return blocks;
    },
    [getPageBlocks, doc, numPages]
  );

  // ---------- spans del DOM (para encendido, scroll y rebobinado) ----------
  useEffect(() => {
    spansRef.current = Array.from(
      scrollRef.current?.querySelectorAll<HTMLSpanElement>(".tp-ch") ?? []
    );
  }, [win]);

  /** deja el carácter `idx` a ~40 % del alto visible */
  const scrollToChar = useCallback((idx: number) => {
    const root = scrollRef.current;
    const el = spansRef.current[idx];
    if (!root || !el) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    root.scrollTop += r.top - rr.top - root.clientHeight * 0.4;
  }, []);

  const windowBlocks = useMemo(
    () => (win ? [...(win.pages[0] ?? []), ...(win.pages[1] ?? [])] : []),
    [win]
  );
  const stream = useMemo(() => buildTeleprompterStream(windowBlocks, presetWps), [windowBlocks, presetWps]);
  const firstLen = useMemo(() => teleprompterCharCount(win?.pages[0] ?? []), [win]);
  const totalChars = stream.steps.length;

  return {
    win,
    setWin,
    winRef,
    winSourceRef,
    loadBlocks,
    spansRef,
    scrollRef,
    scrollToChar,
    windowBlocks,
    stream,
    firstLen,
    totalChars,
  };
}
