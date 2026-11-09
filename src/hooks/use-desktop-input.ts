import * as React from "react";

/** ¿La entrada principal es de escritorio (puntero fino + hover)? */
const QUERY = "(hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Entrada de escritorio: ratón/trackpad + hover. En un teléfono o tablet
 * táctil es false — el lugar donde los recordatorios de TECLAS no pintan
 * nada (no hay teclado) y solo tapan la lectura. Un Android con teclado
 * físico conectado suele reportar pointer: fine, así que el recordatorio
 * vuelve a tener sentido justo cuando hay teclas que recordar.
 */
export function useIsDesktopInput(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
