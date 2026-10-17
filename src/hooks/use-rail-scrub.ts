"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Scrub del riel: presionar y arrastrar para saltar de página. Mientras se
 * arrastra, riel y perilla siguen el dedo (sin transición) y el cuerpo lleva
 * «gesture-lock» para no pelear con la selección de texto.
 */
export function useRailScrub(opts: {
  totalPages: number;
  vertical: boolean;
  compact: boolean;
  onSeek?: (page: number) => void;
}) {
  const { totalPages, vertical, compact, onSeek } = opts;
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const [scrubPage, setScrubPage] = useState<number | null>(null);
  const scrubbing = scrubPage != null;

  /** Página bajo el puntero. Riel vertical: el origen (pág. 1) está ABAJO. */
  const pageAt = useCallback(
    (clientX: number, clientY: number): number | null => {
      const el = trackRef.current;
      if (!el || totalPages <= 0) return null;
      const rect = el.getBoundingClientRect();
      const frac = vertical
        ? 1 - (clientY - rect.top) / Math.max(1, rect.height)
        : (clientX - rect.left) / Math.max(1, rect.width);
      // el relleno mide páginas leídas: la perilla de la pág. p está en (p-1)/N,
      // así que la fracción f del riel corresponde a la pág. round(f·N)+1
      const p = Math.round(Math.min(1, Math.max(0, frac)) * totalPages) + 1;
      return Math.min(totalPages, Math.max(1, p));
    },
    [vertical, totalPages]
  );

  const lockSelection = (on: boolean) => {
    try {
      document.body.classList.toggle("gesture-lock", on);
    } catch {
      /* noop */
    }
  };

  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek || compact || e.button !== 0) return;
    // sin selección de texto ni drag nativo durante el gesto
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    scrubbingRef.current = true;
    lockSelection(true);
    setScrubPage(pageAt(e.clientX, e.clientY));
  };

  const onTrackMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    setScrubPage(pageAt(e.clientX, e.clientY));
  };

  const onTrackUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    lockSelection(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const p = pageAt(e.clientX, e.clientY);
    setScrubPage(null);
    if (p != null && onSeek) onSeek(p);
  };

  const onTrackCancel = useCallback(() => {
    scrubbingRef.current = false;
    lockSelection(false);
    setScrubPage(null);
  }, []);

  return {
    trackRef,
    scrubbing,
    scrubPage,
    handlers: {
      onPointerDown: onTrackDown,
      onPointerMove: onTrackMove,
      onPointerUp: onTrackUp,
      onPointerCancel: onTrackCancel,
    },
  };
}
