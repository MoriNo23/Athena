"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Peek: carrusel de páginas desde el borde inferior. Presionar en la zona
 * caliente + arrastrar hacia arriba lo abre; el movimiento horizontal hojea
 * (~64 px por página). Mientras está abierto, el cuerpo lleva «gesture-lock»:
 * el gesto nunca compite con la selección de texto del documento.
 */
export function usePeekGesture(opts: {
  initialPage: number;
  numPages: number;
  /** lee la página actual viva (pageNumRef) para anclar el gesto */
  getPage: () => number;
  /** salto silencioso al soltar el gesto o elegir del carrusel */
  onJump: (page: number) => void;
}) {
  const { initialPage, numPages, getPage, onJump } = opts;
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekSel, setPeekSel] = useState(initialPage);
  const peekOpenRef = useRef(false);
  const peekSelRef = useRef(initialPage);
  const peekGesture = useRef<{
    startY: number | null;
    anchorX: number;
    anchorSel: number;
    opened: boolean;
    /** elemento y pointer capturados: se liberan SIEMPRE (up o cancel) */
    el: HTMLDivElement | null;
    pid: number | null;
  }>({ startY: null, anchorX: 0, anchorSel: 1, opened: false, el: null, pid: null });

  const setPeek = (open: boolean) => {
    peekOpenRef.current = open;
    setPeekOpen(open);
    // síncrono e idempotente: el gesto nunca compite con la selección de texto
    try {
      document.body.classList.toggle("gesture-lock", open);
      if (open) window.getSelection()?.removeAllRanges();
    } catch {
      /* noop */
    }
  };

  const releaseCapture = (g: { el: HTMLDivElement | null; pid: number | null }) => {
    try {
      if (g.el && g.pid != null && g.el.hasPointerCapture?.(g.pid)) {
        g.el.releasePointerCapture(g.pid);
      }
    } catch {
      /* noop */
    }
    g.el = null;
    g.pid = null;
  };

  const onPeekDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // sin selección de texto ni drag nativo mientras se arrastra el dock
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    peekGesture.current = {
      startY: e.clientY,
      anchorX: e.clientX,
      anchorSel: getPage(),
      opened: false,
      el: e.currentTarget,
      pid: e.pointerId,
    };
  };

  const onPeekMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = peekGesture.current;
    if (g.startY == null) return;
    if (!g.opened) {
      if (g.startY - e.clientY > 44) {
        g.opened = true;
        g.anchorX = e.clientX;
        g.anchorSel = getPage();
        peekSelRef.current = g.anchorSel;
        setPeekSel(g.anchorSel);
        setPeek(true);
      }
      return;
    }
    // horizontal = hojear: ~64 px por página
    const target = Math.min(
      Math.max(1, Math.round(g.anchorSel + (e.clientX - g.anchorX) / 64)),
      numPages
    );
    peekSelRef.current = target;
    setPeekSel(target);
  };

  const onPeekUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = peekGesture.current;
    releaseCapture(g);
    if (g.opened) {
      setPeek(false);
      onJump(peekSelRef.current);
    }
    g.opened = false;
    g.startY = null;
  };

  const onPeekCancel = useCallback(() => {
    // Escape/pointercancel a mitad del gesto: liberar la captura SIEMPRE —
    // si queda viva, todos los clicks de la app caen en la zona caliente
    // y el lector parece «congelado» (bug cazado con el e2e de EPUB).
    releaseCapture(peekGesture.current);
    setPeek(false);
    peekGesture.current = { startY: null, anchorX: 0, anchorSel: 1, opened: false, el: null, pid: null };
  }, [setPeek]);

  // Mientras el carrusel está abierto no se puede seleccionar texto:
  // el gesto de arrastre no debe pelear con la selección del documento
  useEffect(() => {
    if (!peekOpen) return;
    document.body.classList.add("gesture-lock");
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      /* noop */
    }
    return () => {
      document.body.classList.remove("gesture-lock");
    };
  }, [peekOpen]);

  const scrubTo = useCallback((p: number) => {
    peekSelRef.current = p;
    setPeekSel(p);
  }, []);

  return { peekOpen, peekSel, peekOpenRef, peekSelRef, setPeek, setPeekSel: scrubTo, onPeekDown, onPeekMove, onPeekUp, onPeekCancel };
}
