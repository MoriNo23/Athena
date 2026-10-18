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

/** ease-out cúbico: arranca rápido y asienta suave (sin cola visible) */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Duración de la transición de vista escalada por distancia:
    ≈90 ms para pasos de línea, hasta ≈400 ms en saltos grandes (título,
    cruce de página, revelado completo, rebobinado). */
function viewAnimDuration(deltaPx: number): number {
  const d = Math.abs(deltaPx);
  return Math.min(400, Math.max(90, 90 + (d / 600) * 310));
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

  // ---------- animador de vista: transición breve por orden de cámara ----------
  // Un SOLO rAF activo a la vez: cada orden de cámara (scrollToChar) fija un
  // objetivo nuevo contra el DOM real y retoma desde la posición actual, así
  // retargetar a mitad de vuelo nunca tira de vuelta. Con preset instantáneo
  // o movimiento reducido el animador no se activa (la vista salta, como hoy).
  const viewAnimRef = useRef(0);
  const viewInstantRef = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewInstantRef.current = presetWps == null || reduced;
  }, [presetWps]);

  /** Cancela la transición en curso: el desplazamiento manual manda sobre el
      seguimiento (rueda, ↑) y el objetivo se recalcula contra el DOM real. */
  const cancelViewAnim = useCallback(() => {
    if (viewAnimRef.current) {
      cancelAnimationFrame(viewAnimRef.current);
      viewAnimRef.current = 0;
    }
  }, []);

  const animateScrollTopTo = useCallback(
    (target: number) => {
      const root = scrollRef.current;
      if (!root) return;
      cancelViewAnim();
      const from = root.scrollTop;
      const delta = target - from;
      if (Math.abs(delta) < 1) return;
      const dur = viewAnimDuration(delta);
      const t0 = performance.now();
      const step = (now: number) => {
        const el = scrollRef.current;
        if (!el) return; // desmontado: el bucle muere solo
        const p = Math.min(1, (now - t0) / dur);
        el.scrollTop = from + delta * easeOutCubic(p);
        viewAnimRef.current = p < 1 ? requestAnimationFrame(step) : 0;
      };
      viewAnimRef.current = requestAnimationFrame(step);
    },
    [cancelViewAnim]
  );

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

  // Ventana nueva (cruce, rebobinado, reconstrucción): cualquier transición
  // vieja apunta a contenido que ya no existe — se cancela y el motor re-ancla
  // con su primer scrollToChar contra el DOM fresco.
  useEffect(() => {
    cancelViewAnim();
  }, [win, cancelViewAnim]);

  /** deja el carácter `idx` a ~40 % del alto visible, con transición breve.
      El objetivo SIEMPRE se calcula contra el DOM real (rects frescos): así la
      reanudación tras releer o un cruce de página nunca anima desde una
      posición vieja — parten de donde esté la vista ahora. */
  const scrollToChar = useCallback(
    (idx: number) => {
      const root = scrollRef.current;
      const el = spansRef.current[idx];
      if (!root || !el) return;
      const r = el.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      const target = root.scrollTop + (r.top - rr.top - root.clientHeight * 0.4);
      if (viewInstantRef.current) {
        cancelViewAnim();
        root.scrollTop = target;
        return;
      }
      animateScrollTopTo(target);
    },
    [animateScrollTopTo, cancelViewAnim]
  );

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
    cancelViewAnim,
    windowBlocks,
    stream,
    firstLen,
    totalChars,
  };
}
