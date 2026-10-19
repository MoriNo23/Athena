"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  buildTeleprompterStream,
  extractPdfPageBlocksForTeleprompter,
  teleprompterCharCount,
  type TeleprompterBlock,
} from "@/lib/teleprompter";
import { createViewAnim } from "@/lib/view-anim";

/** Ventana de lectura: la página actual y la siguiente (DOM acotado a dos) */
export interface StreamWindow {
  /** primera página de la ventana (1-based) */
  start: number;
  /** [página start, página start+1]; el segundo hueco puede no existir */
  pages: (TeleprompterBlock[] | null)[];
}

/** Ancla de vista para un cambio de ventana: el carácter newIndex de la
    ventana NUEVA debe quedar, tras el intercambio, en la misma posición
    visual que tenía el ancla en la ventana vieja. Lo publica el jugador
    justo antes de setWin y lo consume el layout effect sobre [win]. */
export interface StreamViewAnchor {
  /** índice del ancla en la ventana VIEJA (trazabilidad del caso) */
  oldIndex: number;
  /** índice del mismo carácter en la ventana NUEVA */
  newIndex: number;
  /** posición visual del ancla antes del cambio: top relativo al contenedor */
  viewportY: number;
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
  const viewAnchorRef = useRef<StreamViewAnchor | null>(null);

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
  const cancelViewAnim = useCallback((): boolean => {
    if (viewAnimRef.current) {
      cancelAnimationFrame(viewAnimRef.current);
      viewAnimRef.current = 0;
      return true; // había una transición en vuelo
    }
    return false;
  }, []);

  const animateScrollTopTo = useCallback(
    (target: number) => {
      const root = scrollRef.current;
      if (!root) return;
      cancelViewAnim();
      const delta = target - root.scrollTop;
      if (Math.abs(delta) < 1) return;
      // La cámara cede ante cualquier otro desplazamiento (ver lib/view-anim):
      // la rueda manda aunque el navegador la resuelva fuera de nuestro rAF.
      const anim = createViewAnim({
        el: root,
        target,
        duration: viewAnimDuration(delta),
        t0: performance.now(),
        ease: easeOutCubic,
      });
      const step = (now: number) => {
        if (!scrollRef.current) {
          viewAnimRef.current = 0; // desmontado: el bucle muere solo
          return;
        }
        viewAnimRef.current = anim.step(now) === "run" ? requestAnimationFrame(step) : 0;
      };
      viewAnimRef.current = requestAnimationFrame(step);
    },
    [cancelViewAnim]
  );

  /** Publica el ancla de vista para el PRÓXIMO cambio de ventana: el carácter
      newIndex de la ventana nueva debe quedar tras el swap donde está ahora
      el carácter oldIndex (posición visual medida sobre los spans reales, no
      scrollTop). El layout effect sobre [win] lo consume y compensa sin
      animación antes del pintado. Sin span medible, no publica (el motor
      re-ancla con su primera orden). */
  const stageViewAnchor = useCallback((oldIndex: number, newIndex: number) => {
    const root = scrollRef.current;
    const el = spansRef.current[oldIndex];
    if (!root || !el) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    viewAnchorRef.current = { oldIndex, newIndex, viewportY: r.top - rr.top };
  }, []);

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
  // useLayoutEffect: la compensación de ancla corre antes del pintado y
  // necesita los spans de la ventana NUEVA ya coleccionados y medibles.
  useLayoutEffect(() => {
    spansRef.current = Array.from(
      scrollRef.current?.querySelectorAll<HTMLSpanElement>(".tp-ch") ?? []
    );
  }, [win]);

  // Ventana nueva (cruce, rebobinado, reconstrucción): si el jugador publicó
  // un ancla, la vista se compensa ATÓMICAMENTE —sin animación y antes del
  // pintado— para que el carácter ancla quede donde estaba y la columna no
  // se reacomode (el navegador clampea al rango válido: con la página nueva
  // al inicio de la columna el asentamiento cae al tope). Sin ancla, cualquier
  // transición vieja apunta a contenido que ya no existe — se cancela y el
  // motor re-ancla con su primer scrollToChar contra el DOM fresco.
  useLayoutEffect(() => {
    const anchor = viewAnchorRef.current;
    viewAnchorRef.current = null;
    cancelViewAnim();
    const root = scrollRef.current;
    if (!root || !anchor) return;
    const el = spansRef.current[anchor.newIndex];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const docOffset = r.top - rr.top + root.scrollTop;
    root.scrollTop = docOffset - anchor.viewportY;
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
    stageViewAnchor,
    windowBlocks,
    stream,
    firstLen,
    totalChars,
  };
}
