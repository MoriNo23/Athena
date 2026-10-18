/* Test de la migración del store `riel-settings-v1` (v10 → v11).
 *
 * Reglas del change «Teleprompter y lector» (D6): el ajuste del modo renace
 * como `teleprompter` conservando velocidad, sonido, auto y tamaño; la fuente
 * de lectura entra con la recomendada de la casa; el preset de filtros pasa a
 * `auto` (el libro sigue al tema) salvo que el guardado sea `custom`.
 *
 *   bun scripts/test-settings-migrate.ts
 */
import { migrateSettings } from "../src/lib/settings";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

console.log("=== A. V10 CON AJUSTES PROPIOS ===");
const v10 = {
  lang: "pt",
  vn: { speedPreset: "4", sound: false, auto: true, fontScale: 1.3 },
  filters: { preset: "papel", brightness: 103, contrast: 96, sepia: 18, saturate: 95, warmth: 22, invert: 0 },
  reading: { dailyGoal: 25, scrollStepPct: 50, wheelBoost: 2 },
};
const a = migrateSettings(v10, 10);
check(
  "ajuste `vn` renace como `teleprompter` (velocidad, sonido, auto, tamaño)",
  a.teleprompter.speedPreset === "4" &&
    a.teleprompter.sound === false &&
    a.teleprompter.auto === true &&
    a.teleprompter.fontScale === 1.3,
  JSON.stringify(a.teleprompter),
);
check("la clave vieja `vn` no sobrevive", !("vn" in (a as unknown as Record<string, unknown>)));
check("idioma conservado", a.lang === "pt", a.lang);
check(
  "lectura conservada + fuente recomendada por defecto",
  a.reading.dailyGoal === 25 && a.reading.wheelBoost === 2 && a.reading.font === "literata",
  JSON.stringify(a.reading),
);
check("preset papel → auto (el libro sigue al tema)", a.filters.preset === "auto", a.filters.preset);
check(
  "valores de filtros intactos (preset elegible a mano después)",
  a.filters.sepia === 18 && a.filters.brightness === 103,
  `sepia=${a.filters.sepia} brightness=${a.filters.brightness}`,
);

console.log("=== B. V10 CON PRESET CUSTOM ===");
const b = migrateSettings({ ...v10, filters: { ...v10.filters, preset: "custom" } }, 10);
check("custom se respeta", b.filters.preset === "custom", b.filters.preset);

console.log("=== C. V11 YA MIGRADO ===");
const v11 = {
  lang: "en",
  teleprompter: { speedPreset: "2-5", sound: true, auto: false, fontScale: 0.9 },
  filters: { preset: "custom", brightness: 110, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
  reading: { dailyGoal: 30, scrollStepPct: 40, wheelBoost: 1, font: "atkinson" },
};
const c = migrateSettings(v11, 11);
check(
  "teleprompter se lee tal cual",
  c.teleprompter.speedPreset === "2-5" && c.teleprompter.fontScale === 0.9,
  JSON.stringify(c.teleprompter),
);
check("fuente elegida se conserva", c.reading.font === "atkinson", c.reading.font);
check("preset custom se conserva", c.filters.preset === "custom", c.filters.preset);

console.log(`\n${fail ? "FALLOS" : "MIGRACIÓN SANA"} — ${pass} pasan, ${fail} fallan`);
process.exit(fail ? 1 : 0);
