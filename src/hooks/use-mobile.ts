import * as React from "react"

/**
 * ¿La interfaz debe ser la de móvil?
 *
 * Dos consultas, no una. Antes el corte era solo de ancho (768 px) y un
 * teléfono en horizontal (~800 dp) recibía el layout de escritorio: dock
 * lateral de 352 px, riel lateral, telemetría. El criterio real es «pantalla
 * estrecha, o puntero grueso en una pantalla de tablet o menor» — así el
 * portátil táctil ancho se queda en escritorio.
 */
const MOBILE_BREAKPOINT = 768;
const TABLET_MAX = 1024;
const QUERY_ESTRECHA = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
const QUERY_TACTIL = `(pointer: coarse) and (max-width: ${TABLET_MAX - 1}px)`;

function subscribe(onChange: () => void) {
  const estrecha = window.matchMedia(QUERY_ESTRECHA);
  const tactil = window.matchMedia(QUERY_TACTIL);
  estrecha.addEventListener("change", onChange);
  tactil.addEventListener("change", onChange);
  return () => {
    estrecha.removeEventListener("change", onChange);
    tactil.removeEventListener("change", onChange);
  };
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () =>
      window.innerWidth < MOBILE_BREAKPOINT ||
      window.matchMedia(QUERY_TACTIL).matches,
    () => false
  );
}
