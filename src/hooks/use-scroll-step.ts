"use client";

import { useCallback } from "react";

/**
 * Salto vertical con ↑/↓ sobre el visor de PDF: avanza una fracción del visor
 * configurable (`reading.scrollStepPct`). Devuelve false cuando no puede
 * desplazarse (ya en el borde o página entera visible): el llamador interpreta
 * eso como «gira la página».
 */
export function useScrollStep(scrollStepPct: number) {
  return useCallback(
    (dir: 1 | -1): boolean => {
      const el = document.querySelector<HTMLElement>('[data-viewport="pdf"]');
      if (!el) return false;
      const maxTop = el.scrollHeight - el.clientHeight;
      if (maxTop <= 1) return false;
      if (dir === 1 && el.scrollTop >= maxTop - 2) return false;
      if (dir === -1 && el.scrollTop <= 2) return false;
      const step = el.clientHeight * (scrollStepPct / 100);
      el.scrollBy({ top: dir * step, behavior: "smooth" });
      return true;
    },
    [scrollStepPct]
  );
}
