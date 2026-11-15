/**
 * Back de Android (change apk-back).
 *
 * Capacitor no intercepta el atrás: la actividad lo terminaría siempre. La
 * actividad nativa (`MainActivity`) pregunta a la web antes de cerrar, y la
 * web responde `true` si el gesto ya tuvo efecto (cerrar el teleprompter, el
 * dock, un panel, el carrusel peek…) y `false` si no queda nada por cerrar —
 * que es cuando la actividad sí debe salir.
 *
 * Un único handler activo: el montado más abajo en el árbol gana. El lector
 * registra el suyo (cadena completa) y la biblioteca el de sus diálogos.
 */

type BackHandler = () => boolean;

let activo: BackHandler | null = null;

/** Registra (o quita, con null) el handler que decide sobre el atrás. */
export function setBackHandler(fn: BackHandler | null): void {
  activo = fn;
}

/** true si la interfaz consumió el gesto; la actividad NO debe terminar. */
export function athenaBack(): boolean {
  try {
    return activo ? activo() === true : false;
  } catch {
    // un handler roto nunca debe dejar el atrás sin respuesta
    return false;
  }
}

// El lado nativo llama a window.__athenaBack().
if (typeof window !== "undefined") {
  (window as unknown as { __athenaBack?: () => boolean }).__athenaBack = athenaBack;
}
