/**
 * Prueba de la transición de vista (change: teleprompter-verificacion-y-rueda, C1).
 * No necesita navegador ni servidor:  bun scripts/test-view-anim.ts
 */
import { createViewAnim } from "../src/lib/view-anim";

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}
const ease = (p: number) => 1 - Math.pow(1 - p, 3);
/** columna simulada: redondea a 1/2 px (pantallas HiDPI) y clampa a [0, max] */
function column(initial: number, max = 5000) {
  let v = initial;
  return {
    get scrollTop() { return v; },
    set scrollTop(x: number) { v = Math.min(max, Math.max(0, Math.round(x * 2) / 2)); },
  };
}

// 1. sin interferencia: llega al destino y termina
{
  const el = column(214);
  const a = createViewAnim({ el, target: 1257, duration: 400, t0: 0, ease });
  let s = "run", t = 0;
  while (s === "run" && t < 2000) { t += 16; s = a.step(t); }
  check("llega al destino sin interferencia", s === "done" && el.scrollTop === 1257, `scrollTop=${el.scrollTop}`);
}

// 2. C1: la rueda (−240) a mitad de vuelo gana: la cámara cede y no la arrastra de vuelta
{
  const el = column(214);
  const a = createViewAnim({ el, target: 1257, duration: 400, t0: 0, ease });
  let t = 0, s = "run";
  while (t < 80) { t += 16; s = a.step(t); }
  const donde = el.scrollTop;
  el.scrollTop = donde - 240; // la rueda
  const lector = el.scrollTop;
  t += 16; s = a.step(t);
  check("cede ante la rueda", s === "yield", `estado=${s}`);
  while (t < 1000) { t += 16; a.step(t); }
  check("la vista se queda donde el lector la puso (deriva < 30 px)", Math.abs(el.scrollTop - lector) < 30, `lector=${lector} final=${el.scrollTop}`);
}

// 3. el redondeo de subpíxeles no se confunde con un desplazamiento ajeno
{
  const el = column(100.3);
  const a = createViewAnim({ el, target: 900.7, duration: 300, t0: 0, ease });
  let s = "run", t = 0, cedio = false;
  while (s === "run" && t < 2000) { t += 16; s = a.step(t); if (s === "yield") cedio = true; }
  check("el redondeo no provoca cesión", !cedio && s === "done");
}

// 4. clamp al fondo: destino fuera de rango no se interpreta como interferencia
{
  const el = column(0, 600);
  const a = createViewAnim({ el, target: 900, duration: 300, t0: 0, ease });
  let s = "run", t = 0, cedio = false;
  while (s === "run" && t < 2000) { t += 16; s = a.step(t); if (s === "yield") cedio = true; }
  check("el clamp del navegador no provoca cesión", !cedio && el.scrollTop === 600, `scrollTop=${el.scrollTop}`);
}

console.log(`\n${pass}/${pass + fail} OK`);
process.exit(fail ? 1 : 0);
