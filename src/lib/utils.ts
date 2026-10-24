import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Transición de giro de página: la página nueva ENTRA desde el lado del
 *  avance (derecha al avanzar, izquierda al retroceder) con un fundido
 *  corto — se lee como pasar la hoja, no como un parpadeo. Consciente del
 *  tema: en oscuro el fondo ya es negro, así que la atenuación es más suave
 *  (hundirla sería un guiño a ciego). `prefers-reduced-motion` la apaga. */
export function animarGiroPagina(el: HTMLElement, oscuro: boolean, direccion: 1 | -1 = 1, duracion = 300): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const desde = oscuro ? 0.6 : 0.35;
  const desdeX = 26 * direccion;
  el.animate(
    [{ opacity: desde, transform: `translateX(${desdeX}px)` }, { opacity: 1, transform: "translateX(0px)" }],
    { duration: duracion, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" }
  );
}
