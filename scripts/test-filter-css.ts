/* Test de los filtros de comodidad (tarea 3.4 del change «Teleprompter y lector»).
 *
 * Reglas:
 *  - `auto` sigue al tema: PDF en oscuro = render nocturno; en claro, limpio.
 *    Los presets manuales son override explícito.
 *  - «Noche» no se apila sobre el render nocturno del tema (doble inversión).
 *  - Texto reflowable (EPUB): nunca invierte; solo tintes suaves.
 *
 *   bun scripts/test-filter-css.ts
 */
import { filterCss, reflowFilterCss } from "../src/lib/settings";
import { FILTER_PRESETS } from "../src/lib/types";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

const auto = FILTER_PRESETS.auto.filters;
const noche = FILTER_PRESETS.noche.filters;
const papel = FILTER_PRESETS.papel.filters;

console.log("=== PDF (página imagen) ===");
check("auto en oscuro = render nocturno", filterCss(auto, true) === FILTER_PRESETS.noche.css, filterCss(auto, true));
check("auto en claro = página limpia", filterCss(auto, false) === "none");
check(
  "noche manual en oscuro = una sola inversión",
  (filterCss(noche, true).match(/invert\(/g) ?? []).length === 1,
  filterCss(noche, true),
);
check("noche manual en claro también oscurece", filterCss(noche, false).includes("invert("));
check("papel manual no invierte", !filterCss(papel, true).includes("invert("));
check("normal no filtra", filterCss(FILTER_PRESETS.normal.filters, true) === "none");

console.log("=== Texto reflowable (EPUB y modo texto) ===");
check("auto = sin filtro (la noche la dan los tokens)", reflowFilterCss(auto) === "none");
check(
  "noche jamás invierte ni gira el tono",
  !reflowFilterCss(noche).includes("invert(") && !reflowFilterCss(noche).includes("hue-rotate"),
  reflowFilterCss(noche),
);
check("papel conserva su tinte suave", reflowFilterCss(papel).includes("sepia("), reflowFilterCss(papel));
check(
  "custom con invert guardado tampoco invierte",
  !reflowFilterCss({ preset: "custom", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 80 }).includes("invert("),
);

console.log(`\n${fail ? "FALLOS" : "FILTROS SANOS"} — ${pass} pasan, ${fail} fallan`);
process.exit(fail ? 1 : 0);
