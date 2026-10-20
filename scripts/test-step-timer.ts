/**
 * Regresión «el Auto se queda trabado en los títulos» (sin navegador):
 *   bun scripts/test-step-timer.ts
 * Simula el motor reiniciándose cada segundo (el lector se re-renderiza por el
 * cronómetro de sesión) mientras espera una pausa de título de 1042 ms.
 */
import { plannedStepDelay, stepWait, type PendingStep } from "../src/lib/step-timer";

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}
const WIN = {}; // identidad de la ventana de lectura

/** Motor simulado: devuelve cuándo (ms) se ejecuta el paso, o null si nunca */
function simular(opts: { pausa: number; reinicioCada: number; recuerda: boolean; horizonte?: number }): number | null {
  let now = 0;
  let pending: PendingStep<object> | null = null;
  const horizonte = opts.horizonte ?? 10_000;
  let espera = stepWait(opts.pausa, null, 12, WIN, now);
  pending = { at: now + espera, lit: 12, win: WIN };
  let vence = now + espera;
  let proximoReinicio = opts.reinicioCada;
  while (now < horizonte) {
    if (vence <= proximoReinicio) return vence; // el timer se cumple antes del reinicio
    now = proximoReinicio;
    proximoReinicio += opts.reinicioCada;
    // el efecto se reinicia: nuevo timer
    espera = opts.recuerda ? stepWait(opts.pausa, pending, 12, WIN, now) : Math.max(8, opts.pausa);
    pending = { at: now + espera, lit: 12, win: WIN };
    vence = now + espera;
  }
  return null;
}

// el bug: sin recordar la espera, una pausa de 1042 ms con reinicios cada 1000 ms no vence nunca
check("sin recordar la espera, la pausa de 1042 ms NO vence (reproduce el atasco)",
  simular({ pausa: 1042, reinicioCada: 1000, recuerda: false }) === null);
const t = simular({ pausa: 1042, reinicioCada: 1000, recuerda: true });
check("recordando la espera, vence a tiempo pese a los reinicios", t !== null && t <= 1100, `vence a ${t} ms`);
const t2 = simular({ pausa: 2083, reinicioCada: 1000, recuerda: true });
check("también con la pausa lenta (velocidad 2: 2083 ms)", t2 !== null && t2 <= 2200, `vence a ${t2} ms`);

// reglas de la función
check("otra letra → espera completa", stepWait(500, { at: 100, lit: 5, win: WIN }, 6, WIN, 0) === 500);
check("otra ventana → espera completa", stepWait(500, { at: 100, lit: 5, win: {} }, 5, WIN, 0) === 500);
check("vencido hace rato → mínimo (no se re-espera)", stepWait(500, { at: 100, lit: 5, win: WIN }, 5, WIN, 9_000) === 8);
check("nunca espera más que lo planeado", stepWait(500, { at: 10_000, lit: 5, win: WIN }, 5, WIN, 0) === 500);

// ---- pausa de 2 s antes del cruce de página en Auto ----
const cruce = { lit: 600, firstLen: 600, hasNext: true, auto: true, allowCross: false, stepDelay: 1042, turnMs: 2000 };
check("Auto, fin de página: el cruce espera 2000 ms", plannedStepDelay(cruce) === 2000);
check("Auto, a mitad de página: retardo normal del carácter", plannedStepDelay({ ...cruce, lit: 100 }) === 1042);
check("señal manual (allowCross): no espera", plannedStepDelay({ ...cruce, allowCross: true }) === 1042);
check("sin Auto: no hay espera de cruce (queda en pageDone)", plannedStepDelay({ ...cruce, auto: false }) === 1042);
check("sin página siguiente cargada: no es un cruce", plannedStepDelay({ ...cruce, hasNext: false }) === 1042);
check("página solo-título (12 letras): también espera 2000 ms", plannedStepDelay({ ...cruce, lit: 12, firstLen: 12 }) === 2000);
// la espera de 2 s sobrevive a reinicios del efecto (el lector se re-renderiza cada segundo)
{
  const pend: PendingStep<object> = { at: 1500, lit: 600, win: WIN };
  const w = stepWait(2000, pend, 600, WIN, 1000);
  check("tras un reinicio a mitad de la pausa solo espera lo que faltaba", w === 500, `espera ${w} ms`);
}

console.log(`\n${pass}/${pass + fail} OK`);
process.exit(fail ? 1 : 0);
