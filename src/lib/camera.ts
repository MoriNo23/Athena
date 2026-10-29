/**
 * Cámara del teleprompter: UN solo bucle rAF persistente con interpolación
 * exponencial (change teleprompter-camara-estable).
 *
 * Por qué reemplaza a `view-anim.ts`: la cámara vieja creaba una animación
 * ease-out NUEVA por cada orden de cámara. En modo automático las órdenes
 * llegan letra a letra (cada 20-160 ms según la velocidad) y cada reinicio
 * arrancaba su curva con velocidad máxima: la columna avanzaba a tirones
 * («brincos») y al terminar cada curva se detenía en seco hasta la siguiente.
 *
 * La cámara nueva NO se reinicia nunca: mantiene un objetivo (`target`) que
 * las órdenes actualizan, y cada cuadro avanza hacia él con un suavizado
 * exponencial (`pos += (target - pos) · (1 - e^(-dt/τ))`). La velocidad es
 * continua en cada retarget — retargetear a mitad de vuelo solo cambia el
 * destino, nunca el ritmo — y el bucle vive solo mientras hay distancia que
 * recorrer: a reposo no hay rAF activo.
 *
 * Contrato de cesión (spec «La relectura manual manda», heredado): la cámara
 * escribe `scrollTop` cuadro a cuadro, pero SOLO mientras nadie más lo haya
 * movido. Si entre dos cuadros el `scrollTop` real no es el que la cámara
 * dejó (rueda, teclado, arrastre, scroll del compositor), la cámara queda
 * DORMIDA y no vuelve a escribir hasta una orden explícita: el lector manda.
 */

/** Margen (px) para el redondeo de subpíxeles al escribir/leer `scrollTop`. */
export const CAMERA_YIELD_PX = 2;

/** A menos de esta distancia (px) del objetivo, se asienta exacto y para. */
export const CAMERA_SETTLE_PX = 0.75;

/** Constante de tiempo del suavizado (ms): ≈90 ms alcanza el 68 % del tramo
    en ese tiempo — respuesta viva sin sacudidas. Espejado en el SDD. */
export const CAMERA_TAU_MS = 90;

export interface ScrollLike {
  scrollTop: number;
}

export type CameraStatus = "run" | "settled" | "yield" | "detached";

/** Dependencias inyectables para auditar/testear sin DOM ni rAF real. */
export interface CameraDeps<E extends ScrollLike = ScrollLike> {
  /** contenedor con scroll (se lee por si el host se desmonta y remonta) */
  el: () => E | null;
  /** instante actual en ms */
  now: () => number;
  /** programa el siguiente cuadro y devuelve su id */
  schedule: (cb: (now: number) => void) => number;
  /** cancela un cuadro programado */
  cancel: (id: number) => void;
  /** ¿el elemento sigue en el documento? (desmontado: el bucle muere) */
  attached?: (el: E) => boolean;
  tauMs?: number;
}

export interface CameraController {
  /** Fija/actualiza el objetivo de cámara. Con `instant` escribe exacto y
      sin animación (rebobinado: el resultado depende solo del layout). */
  order(target: number, opts?: { instant?: boolean }): void;
  /** Detiene el bucle y olvida el objetivo (cruce de página, desmontaje). */
  cancel(): void;
  /** ¿hay un bucle vivo persiguiendo un objetivo? */
  isActive(): boolean;
}

/**
 * Crea el controlador. Sin órdenes no hay rAF; con órdenes hay UN bucle que
 * se apaga solo al asentarse, ceder o desmontarse el host.
 */
export function createCameraController<E extends ScrollLike>(deps: CameraDeps<E>): CameraController {
  const tau = deps.tauMs ?? CAMERA_TAU_MS;
  const attached = deps.attached ?? ((el: E) => true);
  let rafId = 0;
  let target: number | null = null;
  /** lo último que la cámara dejó escrito (leído de vuelta: el navegador redondea) */
  let expected = 0;
  let lastNow = 0;

  const stop = () => {
    if (rafId) deps.cancel(rafId);
    rafId = 0;
    target = null;
  };

  const step = (now: number) => {
    rafId = 0;
    const el = deps.el();
    if (!el || target == null) return; // desmontado o cancelado: nada que perseguir
    if (!attached(el)) {
      stop();
      return;
    }
    // cesión: otro movió el scroll — el lector manda y la cámara duerme
    if (Math.abs(el.scrollTop - expected) > CAMERA_YIELD_PX) {
      stop();
      return;
    }
    const dt = Math.max(0, now - lastNow);
    lastNow = now;
    const restante = target - el.scrollTop;
    if (Math.abs(restante) <= CAMERA_SETTLE_PX) {
      el.scrollTop = target;
      expected = el.scrollTop;
      stop();
      return;
    }
    // suavizado exponencial: velocidad continua para CUALQUIER retarget
    const alpha = 1 - Math.exp(-dt / tau);
    el.scrollTop = el.scrollTop + restante * alpha;
    expected = el.scrollTop;
    rafId = deps.schedule(step);
  };

  return {
    order(next, opts) {
      const el = deps.el();
      if (!el) return;
      if (opts?.instant) {
        stop();
        el.scrollTop = next;
        expected = el.scrollTop;
        return;
      }
      target = next;
      if (rafId) return; // bucle vivo: solo cambió el destino (retarget barato)
      // arranque limpio: parte de donde está la vista AHORA (nunca de una
      // posición vieja), y si una orden previa ya escribió aquí, no cuenta
      // como cesión ajena
      expected = el.scrollTop;
      lastNow = deps.now();
      rafId = deps.schedule(step);
    },
    cancel: stop,
    isActive: () => rafId !== 0,
  };
}
