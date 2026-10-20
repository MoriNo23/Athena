/**
 * Espera del próximo paso del motor del teleprompter.
 *
 * El motor es un efecto de React que programa un `setTimeout` por carácter.
 * Cualquier dependencia que cambie de identidad lo reinicia; si el reinicio
 * volviera a pedir la espera COMPLETA, una pausa más larga que el intervalo de
 * re-render del lector (≈1 s: el cronómetro de sesión) nunca llegaría a
 * cumplirse y el Auto se quedaría clavado (síntoma: títulos). Por eso el paso
 * pendiente anota cuándo vence y, al reiniciar, solo espera lo que faltaba.
 */
export interface PendingStep<W> {
  /** instante (ms, performance.now) en que vence el paso */
  at: number;
  /** índice de la letra a la que corresponde */
  lit: number;
  /** ventana de lectura para la que se programó */
  win: W | null;
}

export const MIN_STEP_WAIT_MS = 8;

export function stepWait<W>(
  planned: number,
  pending: PendingStep<W> | null,
  lit: number,
  win: W | null,
  now: number
): number {
  const plannedWait = Math.max(MIN_STEP_WAIT_MS, planned);
  if (pending && pending.win === win && pending.lit === lit) {
    return Math.max(MIN_STEP_WAIT_MS, Math.min(plannedWait, pending.at - now));
  }
  return plannedWait;
}

/**
 * Espera planeada del paso que empieza en la letra `lit`. Con Auto, al llegar
 * al final de la página (con página siguiente cargada) el paso es el CRUCE y
 * espera `turnMs` para que el cambio no sea brusco; las señales manuales
 * (`allowCross`) no esperan. Fuera de ahí, el retardo normal del carácter.
 */
export function plannedStepDelay(o: {
  lit: number;
  firstLen: number;
  hasNext: boolean;
  auto: boolean;
  allowCross: boolean;
  stepDelay: number;
  turnMs: number;
}): number {
  const atBoundary = o.hasNext && o.lit >= o.firstLen;
  return atBoundary && o.auto && !o.allowCross ? o.turnMs : o.stepDelay;
}
