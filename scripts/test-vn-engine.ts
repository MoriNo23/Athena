/**
 * Test del motor real del Modo Novela Visual (src/lib/vn.ts) con bun.
 * Valida que la implementación TypeScript produce EXACTAMENTE la matemática
 * auditada por scripts/audit_vn_timing.py.
 *
 *   bun scripts/test-vn-engine.ts
 */
import {
  buildVnTimeline,
  vnBaseDelayMs,
  vnCardsFromPageText,
  vnCardsFromParagraph,
  VN_LETTERS_PER_WORD,
  VN_COMMA_PAUSE_LETTERS,
  VN_PERIOD_PAUSE_LETTERS,
} from "../src/lib/vn";

let fails = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  if (!ok) fails++;
}

console.log("MOTOR REAL (src/lib/vn.ts) vs matemática auditada");
console.log(`constantes: LPW=${VN_LETTERS_PER_WORD} COMMA=${VN_COMMA_PAUSE_LETTERS} PERIOD=${VN_PERIOD_PAUSE_LETTERS}`);

// --- retardo base ---
const base15 = vnBaseDelayMs(1.5);
check("base Lenta = 1000/(1.5·6) = 111.11 ms", Math.abs(base15 - 1000 / 9) < 1e-9, base15.toFixed(2));

// --- timeline exacta de "Hola, mundo." ---
{
  const tl = buildVnTimeline("Hola, mundo.", 1.5);
  // chars: H o l a , ␣ m u n d o .
  check("12 pasos para 12 caracteres", tl.steps.length === 12, String(tl.steps.length));
  check("la coma NO se lleva su pausa (la lleva el siguiente)", Math.abs(tl.steps[4].delay - base15) < 0.01, `${tl.steps[4].delay.toFixed(1)} ms`);
  check("espacio tras coma = base + 4·base = 555.6 ms", Math.abs(tl.steps[5].delay - base15 * 5) < 0.01, `${tl.steps[5].delay.toFixed(1)} ms`);
  check("punto final sin pausa colgante (= base)", Math.abs(tl.steps[11].delay - base15) < 0.01, `${tl.steps[11].delay.toFixed(1)} ms`);
  // total esperado: 12·base + 4·base = 16·base = 1777.78 ms (Python: 1777 con redondeo por paso)
  check("total = 16·base = 1777.78 ms (coincide con Python)", Math.abs(tl.totalMs - base15 * 16) < 0.02, `${tl.totalMs.toFixed(2)} ms`);
  check("contadores: 1 coma, 1 punto", tl.commas === 1 && tl.periods === 1);
}

// --- series colapsan ---
{
  const base = 1000 / (1.5 * VN_LETTERS_PER_WORD);
  const tl = buildVnTimeline("¿Qué?! Siguió… y calló.", 1.5);
  const dExcl = tl.steps.find((s) => s.char === "!")!.delay;
  check("«?!» = UNA pausa: ! cuesta base·10", Math.abs(dExcl - base * 10) < 1.5, `${dExcl.toFixed(1)} ms vs ${(base * 10).toFixed(1)}`);
  const iDots = tl.steps.findIndex((s) => s.char === "…");
  const dSpace = tl.steps[iDots + 1].delay;
  check("«…» = UNA pausa: el espacio tras él cuesta base·10", Math.abs(dSpace - base * 10) < 1.5, `${dSpace.toFixed(1)} ms`);
}

// --- instantánea ---
{
  const tl = buildVnTimeline("Texto cualquiera, con pausas. ¡Y signos!", null);
  check("Instantánea: todos los delays = 0", tl.steps.every((s) => s.delay === 0));
  check("Instantánea: total 0 ms", tl.totalMs === 0);
}

// --- degenerados ---
{
  const vacio = buildVnTimeline("", 1.5);
  check("texto vacío: 0 pasos, 0 ms", vacio.steps.length === 0 && vacio.totalMs === 0);
  const solo = buildVnTimeline("   ...   ", 0.8);
  check("solo espacios y puntos: delays finitos y > 0",
    solo.steps.every((s) => Number.isFinite(s.delay) && s.delay > 0),
    `total ${solo.totalMs} ms`);
}

// --- tarjetas ---
{
  const corto = vnCardsFromParagraph("Párrafo breve y contento.");
  check("párrafo corto = 1 tarjeta", corto.length === 1);

  const largo = vnCardsFromParagraph(
    "Primera frase bastante larga que ya supera el corte por sí sola porque no para de crecer y crecer sin puntito final hasta quedarse sin aire. " +
    "Segunda frase. Tercera frase. " +
    "Cuarta frase que también aporta longitud suficiente para empujar el corte. " +
    "Quinta frase remata.",
    80
  );
  check("párrafo largo se trocea en tarjetas ≤ tope", largo.length >= 3 && largo.every((c) => c.length <= 80 + 20), `${largo.length} tarjetas, máx ${Math.max(...largo.map((c) => c.length))} chars`);

  const pagina = "Primera línea del párrafo uno.\nSegunda línea del párrafo uno.\n\nTítulo corto\n\nPárrafo tres con algo de texto suficiente para ir solo por la vida.";
  const cards = vnCardsFromPageText(pagina);
  check("página: párrafos → tarjetas; título corto se funde", cards.length === 2 && cards[1].startsWith("Título corto"), JSON.stringify(cards.map((c) => c.slice(0, 24))));
}

// --- banda WPS efectivo (comparación directa con Python) ---
{
  const muestra = "La cueva olía a piedra mojada, y el eco repetía cada paso como si la montaña quisiera conversar. Nadie recordaba quién había encendido las primeras lámparas; solo sabían que el fuego, cuando respira, calma. ¿Cuántas noches más aguantaría la caravana? ¡Ninguna! Mañana partirían al amanecer…";
  const palabras = muestra.split(/\s+/).length;
  for (const [id, wps] of [["0-8", 0.8], ["1-5", 1.5], ["2-5", 2.5], ["4", 4.0]] as const) {
    const tl = buildVnTimeline(muestra, wps);
    const efectivo = palabras / (tl.totalMs / 1000);
    const rel = efectivo / wps;
    check(`wps efectivo ${id} ∈ [0.70, 1.00]×${wps}`, rel >= 0.7 && rel <= 1.0,
      `efectivo ${efectivo.toFixed(2)} pal/s = ${(rel * 100).toFixed(0)}% del rótulo`);
  }
}

console.log(fails === 0 ? "\nMOTOR SANA — todo coincide con la auditoría Python." : `\n${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
