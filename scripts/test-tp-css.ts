/**
 * Contrato CSS del retroceso directo (sin navegador):  bun scripts/test-tp-css.ts
 *
 * Una transición CSS toma la declaración del estado de DESTINO, así que la
 * dirección se codifica en el CSS: lo declarado en `.on` solo corre al
 * encender; lo del estado base corre al apagar (retroceder). Este test fija
 * que el estado base no anima ni se desplaza, para que el retroceso no pueda
 * volver a heredar la animación de la lectura.
 */
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}
/** cuerpo de la regla cuyo selector es exactamente `sel` (fuera de @media) */
function rule(sel: string): string {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : "";
}

const base = rule(".tp-ch");
const on = rule(".tp-ch.on");
check("`.tp-ch` (apagado) no tiene transición: apagar es instantáneo", /transition:\s*none/.test(base) && !/transition:\s*opacity/.test(base));
check("`.tp-ch.on` lleva el fundido: corre solo al encender", /transition:\s*opacity\s+130ms/.test(on));
check("las letras de un título no heredan el fundido", /transition:\s*none/.test(rule(".tp-block-h .tp-ch.on")));

const h = rule(".tp-block-h");
const hOn = rule(".tp-block-h.on");
check("título apagado: sin transform en reposo (no «baja» al retroceder)", !/transform\s*:/.test(h));
check("título apagado: sin transición (se atenúa al instante)", !/transition\s*:/.test(h));
check("título encendido: la aparición es una animación de `.on`", /animation:\s*tp-heading-in/.test(hOn));
check("keyframes de aparición definidos", /@keyframes tp-heading-in/.test(css));

// movimiento reducido: sin transiciones ni animaciones
const reduced = css.split("@media (prefers-reduced-motion: reduce)").slice(1).join("\n");
check("movimiento reducido anula la transición de `.tp-ch.on`", /\.tp-ch,\s*\n\s*\.tp-ch\.on\s*\{[^}]*transition:\s*none/.test(reduced));
check("movimiento reducido anula la animación del título", /\.tp-block-h\.on\s*\{[^}]*animation:\s*none/.test(reduced));

console.log(`\n${pass}/${pass + fail} OK`);
process.exit(fail ? 1 : 0);
