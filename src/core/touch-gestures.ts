/**
 * Gestos táctiles del teleprompter (comodidad en el APK — leer con el dedo).
 *
 * Decisiones PURAS, separadas del DOM: el overlay solo registra puntos y
 * pregunta aquí qué significan. Así el tacto se puede testear sin WebView
 * y la conducta del dedo queda clavada por tests (como la cámara).
 *
 * Contrato con la dueña (regla vigente del escenario): tocar NUNCA avanza
 * página — avanzar es del botón o del teclado. El tap pausa/reanuda, y el
 * arrastre hacia atrás (releer) pausa, igual que la rueda arriba en PC.
 */

/** Movimiento máximo (px) entre bajar y soltar el dedo para llamarlo tap. */
export const TAP_SLOP_PX = 12;

/** Duración máxima (ms) de un tap: más tiempo es una pulsación larga. */
export const TAP_MAX_MS = 400;

/** Delta vertical de dedo (px) en un tramo para leer intención de arrastre. */
export const DRAG_INTENT_PX = 6;

/** Estado de un gesto en curso: dónde y cuándo empezó. */
export interface GestoActivo {
  x: number;
  y: number;
  t: number;
}

/** Registra el inicio de un gesto (pointerdown / touchstart). */
export function iniciarGesto(x: number, y: number, t: number): GestoActivo {
  return { x, y, t };
}

/**
 * ¿El gesto terminó siendo un tap (dedo quieto y breve)? El tap es el
 * gesto de pausa/reanudar: el equivalente táctil de la barra espaciadora.
 */
export function esTap(g: GestoActivo, x: number, y: number, t: number): boolean {
  return (
    Math.abs(x - g.x) <= TAP_SLOP_PX &&
    Math.abs(y - g.y) <= TAP_SLOP_PX &&
    t - g.t <= TAP_MAX_MS
  );
}

export type DireccionArrastre = "atras" | "adelante" | "quieto";

/**
 * Dirección vertical del último tramo del dedo. «atras» = el dedo BAJA = la
 * columna retrocede = la lectora está releyendo → pausa (mismo contrato que
 * la rueda hacia arriba en escritorio). «adelante» no pausa: dejarse llevar
 * hacia adelante no interrumpe el flujo.
 */
export function direccionArrastre(dyTramo: number): DireccionArrastre {
  if (dyTramo >= DRAG_INTENT_PX) return "atras";
  if (dyTramo <= -DRAG_INTENT_PX) return "adelante";
  return "quieto";
}
