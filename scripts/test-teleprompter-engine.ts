/**
 * Test del motor real del modo teleprompter (src/lib/teleprompter.ts) con bun.
 * Valida que la implementación TypeScript produce EXACTAMENTE la matemática
 * auditada por scripts/audit_vn_timing.py.
 *
 *   bun scripts/test-tp-engine.ts
 */
import {
  buildTeleprompterStream,
  buildTeleprompterTimeline,
  teleprompterBaseDelayMs,
  teleprompterRewind,
  TELEPROMPTER_COMMA_PAUSE_LETTERS,
  TELEPROMPTER_HEADING_PAUSE_LETTERS,
  TELEPROMPTER_LETTERS_PER_WORD,
  TELEPROMPTER_PERIOD_PAUSE_LETTERS,
} from "../src/lib/teleprompter";

let fails = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  if (!ok) fails++;
}

console.log("MOTOR REAL (src/lib/teleprompter.ts) vs matemática auditada");
console.log(`constantes: LPW=${TELEPROMPTER_LETTERS_PER_WORD} COMMA=${TELEPROMPTER_COMMA_PAUSE_LETTERS} PERIOD=${TELEPROMPTER_PERIOD_PAUSE_LETTERS}`);

// --- retardo base ---
const base15 = teleprompterBaseDelayMs(1.5);
check("base Lenta = 1000/(1.5·6) = 111.11 ms", Math.abs(base15 - 1000 / 9) < 1e-9, base15.toFixed(2));

// --- timeline exacta de "Hola, mundo." ---
{
  const tl = buildTeleprompterTimeline("Hola, mundo.", 1.5);
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
  const base = 1000 / (1.5 * TELEPROMPTER_LETTERS_PER_WORD);
  const tl = buildTeleprompterTimeline("¿Qué?! Siguió… y calló.", 1.5);
  const dExcl = tl.steps.find((s) => s.char === "!")!.delay;
  check("«?!» = UNA pausa: ! cuesta base·10", Math.abs(dExcl - base * 10) < 1.5, `${dExcl.toFixed(1)} ms vs ${(base * 10).toFixed(1)}`);
  const iDots = tl.steps.findIndex((s) => s.char === "…");
  const dSpace = tl.steps[iDots + 1].delay;
  check("«…» = UNA pausa: el espacio tras él cuesta base·10", Math.abs(dSpace - base * 10) < 1.5, `${dSpace.toFixed(1)} ms`);
}

// --- instantánea ---
{
  const tl = buildTeleprompterTimeline("Texto cualquiera, con pausas. ¡Y signos!", null);
  check("Instantánea: todos los delays = 0", tl.steps.every((s) => s.delay === 0));
  check("Instantánea: total 0 ms", tl.totalMs === 0);
}

// --- degenerados ---
{
  const vacio = buildTeleprompterTimeline("", 1.5);
  check("texto vacío: 0 pasos, 0 ms", vacio.steps.length === 0 && vacio.totalMs === 0);
  const solo = buildTeleprompterTimeline("   ...   ", 0.8);
  check("solo espacios y puntos: delays finitos y > 0",
    solo.steps.every((s) => Number.isFinite(s.delay) && s.delay > 0),
    `total ${solo.totalMs} ms`);
}

// --- flujo continuo por bloques ---
{
  const base = teleprompterBaseDelayMs(2.5);
  const stream = buildTeleprompterStream(
    [
      { kind: "p", text: "Hola, mundo." },
      { kind: "h2", text: "El título" },
      { kind: "p", text: "Cuerpo que sigue." },
    ],
    2.5
  );
  check(
    "bloques contiguos: 12 + 9 + 17 caracteres",
    stream.blocks.length === 3 && stream.blocks.map((b) => b.length).join(",") === "12,9,17",
    stream.blocks.map((b) => `${b.kind}:${b.start}+${b.length}`).join(" ")
  );
  check(
    "metadatos de título",
    stream.blocks[1].heading && !stream.blocks[0].heading && stream.blocks[2].start === 21
  );
  const hStart = stream.blocks[1].start;
  const hEnd = hStart + stream.blocks[1].length;
  check(
    "pausa de título: primer carácter = base·(1+PUNTO+TÍTULO)",
    Math.abs(
      stream.steps[hStart].delay -
        base * (1 + TELEPROMPTER_PERIOD_PAUSE_LETTERS + TELEPROMPTER_HEADING_PAUSE_LETTERS)
    ) < 0.01,
    `${stream.steps[hStart].delay.toFixed(1)} ms`
  );
  check(
    "el resto del título se enciende de golpe",
    stream.steps.slice(hStart + 1, hEnd).every((s) => s.delay === 0)
  );
  check(
    "pausa tras el título antes del cuerpo",
    Math.abs(stream.steps[hEnd].delay - base * (1 + TELEPROMPTER_HEADING_PAUSE_LETTERS)) < 0.01,
    `${stream.steps[hEnd].delay.toFixed(1)} ms`
  );
  check(
    "instantánea: títulos y cuerpo a cero",
    buildTeleprompterStream(
      [
        { kind: "h2", text: "T" },
        { kind: "p", text: "Cuerpo." },
      ],
      null
    ).steps.every((s) => s.delay === 0)
  );
}

// --- rebobinado inverso y cruce de página encendida ---
{
  const stream = buildTeleprompterStream([{ kind: "p", text: "Uno dos." }], 1.5);
  const visitados: number[] = [];
  let cursor: { page: number; lit: number } | null = { page: 1, lit: stream.steps.length };
  while (cursor && cursor.page === 1) {
    visitados.push(cursor.lit);
    cursor = teleprompterRewind(cursor);
    if (!cursor || cursor.lit === -1) break;
  }
  check(
    "orden inverso: del último carácter al primero, uno a uno",
    visitados[0] === stream.steps.length &&
      visitados[visitados.length - 1] === 0 &&
      visitados.every((v, i) => i === 0 || v === visitados[i - 1] - 1),
    visitados.join(",")
  );
  check(
    "cruce: página 2 al inicio ⇒ página 1 ENCENDIDA",
    JSON.stringify(teleprompterRewind({ page: 2, lit: 0 })) === JSON.stringify({ page: 1, lit: -1 })
  );
  check("primera página al inicio ⇒ no hay retroceso", teleprompterRewind({ page: 1, lit: 0 }) === null);
  check(
    "página anterior encendida = todos sus pasos",
    buildTeleprompterStream([{ kind: "p", text: "Anterior." }], 1.5).steps.length === 9
  );
}

// --- banda WPS efectivo (comparación directa con Python) ---
{
  const muestra = "La cueva olía a piedra mojada, y el eco repetía cada paso como si la montaña quisiera conversar. Nadie recordaba quién había encendido las primeras lámparas; solo sabían que el fuego, cuando respira, calma. ¿Cuántas noches más aguantaría la caravana? ¡Ninguna! Mañana partirían al amanecer…";
  const palabras = muestra.split(/\s+/).length;
  for (const [id, wps] of [["0-8", 0.8], ["1-5", 1.5], ["2-5", 2.5], ["4", 4.0]] as const) {
    const tl = buildTeleprompterTimeline(muestra, wps);
    const efectivo = palabras / (tl.totalMs / 1000);
    const rel = efectivo / wps;
    check(`wps efectivo ${id} ∈ [0.70, 1.00]×${wps}`, rel >= 0.7 && rel <= 1.0,
      `efectivo ${efectivo.toFixed(2)} pal/s = ${(rel * 100).toFixed(0)}% del rótulo`);
  }
}

console.log(fails === 0 ? "\nMOTOR SANA — todo coincide con la auditoría Python." : `\n${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
