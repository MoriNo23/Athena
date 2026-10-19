/**
 * Transición de vista del teleprompter (la cámara), como función pura.
 *
 * Contrato (spec «La relectura manual manda»): la cámara escribe `scrollTop`
 * cuadro a cuadro, pero SOLO mientras nadie más lo haya movido. Si entre dos
 * cuadros el `scrollTop` real no es el que la cámara dejó (rueda, scroll suave
 * del compositor, teclado, arrastre…), la animación cede y no vuelve a
 * escribir: el lector manda y la vista se queda donde él la puso, sea cual sea
 * el camino por el que llegó el desplazamiento.
 */

/** Margen (px) para el redondeo de subpíxeles al escribir/leer `scrollTop` */
export const VIEW_YIELD_PX = 2;

export interface ScrollLike {
  scrollTop: number;
}

export type ViewAnimStatus = "run" | "done" | "yield";

export interface ViewAnim {
  /** Avanza al instante `now` (ms). `run`: pedir otro cuadro; `done`: llegó; `yield`: cedió. */
  step(now: number): ViewAnimStatus;
}

export function createViewAnim(opts: {
  el: ScrollLike;
  target: number;
  duration: number;
  t0: number;
  ease: (p: number) => number;
}): ViewAnim {
  const { el, target, duration, t0, ease } = opts;
  const from = el.scrollTop;
  const delta = target - from;
  // lo último que la cámara dejó escrito (releído: el navegador redondea y clampa)
  let expected = from;
  return {
    step(now) {
      if (Math.abs(el.scrollTop - expected) > VIEW_YIELD_PX) return "yield";
      const p = Math.min(1, (now - t0) / duration);
      el.scrollTop = from + delta * ease(p);
      expected = el.scrollTop;
      return p < 1 ? "run" : "done";
    },
  };
}
