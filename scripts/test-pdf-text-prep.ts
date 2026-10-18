/* Test de la preparación no bloqueante del modo texto (tarea 4.2 del change
 * «Teleprompter y lector») contra un PDF largo real (~670 páginas).
 *
 * Verifica:
 *  - la lectura empieza antes de terminar la preparación (progreso > 0, no done);
 *  - la prioridad del riel: `ensurePdfTextPage` adelanta la página destino;
 *  - la caché por sesión: un segundo `preparePdfText` no re-extrae;
 *  - la instantánea es estable (requisito de useSyncExternalStore).
 *
 * Imprime los tiempos medidos (los números van al informe de la auditoría).
 *
 *   bun scripts/test-pdf-text-prep.ts
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  ensurePdfTextPage,
  getPdfTextPage,
  getPdfTextSnapshot,
  preparePdfText,
  resetPdfTextCache,
  subscribePdfText,
} from "../src/lib/pdf-text-index";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PDF = join(HERE, "libro-largo-670.pdf");
const KEY = "test-largo-670";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

async function until(cond: () => boolean, timeoutMs: number, every = 20): Promise<number> {
  const t0 = performance.now();
  while (!cond()) {
    if (performance.now() - t0 > timeoutMs) throw new Error("timeout esperando condición");
    await new Promise((r) => setTimeout(r, every));
  }
  return performance.now() - t0;
}

if (!existsSync(PDF)) {
  const gen = spawnSync("python3", [join(HERE, "make-big-pdf.py"), "670", "--nopad", "--out", "libro-largo-670.pdf"], {
    stdio: "inherit",
  });
  if (!existsSync(PDF)) {
    console.log(`SKIP: no hay ${PDF} y no se pudo generar (exit ${gen.status})`);
    process.exit(0);
  }
}

console.log("Abriendo el tomo de prueba…");
const loadingTask = getDocument({ url: new URL("file://" + PDF).href, verbosity: 0 });
const doc = await loadingTask.promise;
const TOTAL = doc.numPages;
console.log(`PDF de ${TOTAL} páginas\n`);

resetPdfTextCache();

// coste real de extraer una página suelta (el poll de bun sufre contención del
// fake worker: este número es el que verá la primera página en el navegador)
const tp0 = performance.now();
const primera = await doc.getPage(1);
await primera.getTextContent();
const tUnaPagina = performance.now() - tp0;

const snapIdle = getPdfTextSnapshot(KEY);
check("sin preparación: instantánea IDLE estable", snapIdle === getPdfTextSnapshot(KEY) && snapIdle.total === 0);

// --- arranque no bloqueante ---
let notificaciones = 0;
const unsubscribe = subscribePdfText(KEY, () => {
  notificaciones += 1;
});

const t0 = performance.now();
preparePdfText(KEY, doc);
const tPrimera = await until(() => getPdfTextSnapshot(KEY).ready >= 1, 30000);
const snapInicio = getPdfTextSnapshot(KEY);
check(
  "la lectura empieza antes de terminar (ready ≥ 1 y no done)",
  snapInicio.ready >= 1 && !snapInicio.done,
  `ready=${snapInicio.ready}/${TOTAL}, extracted=${snapInicio.extracted}, ${tPrimera.toFixed(0)} ms`,
);
check("la instantánea cambia y es estable entre lecturas", snapInicio === getPdfTextSnapshot(KEY) && snapInicio !== snapIdle);

// --- prioridad del riel ---
const tAntes = performance.now();
const ensureDone = await Promise.race([
  ensurePdfTextPage(KEY, 600).then(() => true),
  new Promise<boolean>((r) => setTimeout(() => r(false), 30000)),
]);
const tPag600 = performance.now() - tAntes;
const snap600 = getPdfTextSnapshot(KEY);
const bloques600 = getPdfTextPage(KEY, 600);
check(
  "ensurePdfTextPage(600) adelanta la página destino",
  ensureDone && bloques600 !== undefined && (bloques600?.length ?? 0) > 0,
  `${tPag600.toFixed(0)} ms, ready=${snap600.ready} (el cursor secuencial no llegó)`,
);
check(
  "el adelanto no finge un prefijo listo",
  snap600.ready < 600 && !snap600.done,
  `ready=${snap600.ready}, extracted=${snap600.extracted}`,
);

// --- contenido extraído de una página real ---
const b2 = getPdfTextPage(KEY, 2) ?? [];
const palabras2 = b2.reduce((n, b) => n + b.words, 0);
check(
  "página 2: título + cuerpo con texto real",
  b2[0]?.kind === "h2" && b2[0]?.text === "Capitulo gordo 2" && palabras2 > 100,
  `bloques=${b2.length}, palabras=${palabras2}, primero=${b2[0]?.kind}:${b2[0]?.text.slice(0, 24)}`,
);

// --- fin de la preparación + caché por sesión ---
const tTotal = await until(() => getPdfTextSnapshot(KEY).done, 180000, 50);
const snapFin = getPdfTextSnapshot(KEY);
const paginasListas = Array.from({ length: TOTAL }, (_, i) => getPdfTextPage(KEY, i + 1)).filter((b) => b !== undefined).length;
check(
  "todo extraído al terminar",
  snapFin.done && snapFin.extracted === TOTAL && paginasListas === TOTAL,
  `extracted=${snapFin.extracted}/${TOTAL}, listas=${paginasListas}`,
);

const refsAntes = getPdfTextPage(KEY, 300);
preparePdfText(KEY, doc);
await new Promise((r) => setTimeout(r, 150));
check(
  "la caché por sesión no re-extrae",
  getPdfTextSnapshot(KEY) === snapFin && getPdfTextPage(KEY, 300) === refsAntes,
);
check(
  "progreso coalescido (no una notificación por página)",
  notificaciones >= 4 && notificaciones < TOTAL,
  `${notificaciones} notificaciones para ${TOTAL} páginas`,
);

unsubscribe();
await loadingTask.destroy();
resetPdfTextCache();

console.log("\n--- tiempos (PDF de %d páginas) ---", TOTAL);
console.log(`  una página suelta:     ${tUnaPagina.toFixed(0)} ms`);
console.log(`  primera página lista:  ${tPrimera.toFixed(0)} ms (poll de bun; el fake worker retrasa el temporizador)`);
console.log(`  página 600 (riel):     ${tPag600.toFixed(0)} ms`);
console.log(`  preparación completa:  ${tTotal.toFixed(0)} ms (${(tTotal / TOTAL).toFixed(1)} ms/página)`);
console.log(`  arranque (prepare):    ${(performance.now() - t0 - tTotal).toFixed(0)} ms de overhead`);

console.log(`\n${fail ? "FALLOS" : "PREPARACIÓN SANA"} — ${pass} pasan, ${fail} fallan`);
process.exit(fail ? 1 : 0);
