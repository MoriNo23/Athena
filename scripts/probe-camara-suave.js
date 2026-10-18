/**
 * Sonda E2E de la cámara suave del teleprompter (change: camara-suave-y-metas-por-libro).
 *
 * Verifica en dev (localhost:3000):
 *   A. Con preset animado (Lenta), la vista LLEGA con transición: valores
 *      intermedios de scrollTop entre origen y objetivo (sin salto en seco).
 *   B. Con preset Instantánea, la vista salta como hoy (sin animación).
 *   C. La rueda manda: un giro manual a mitad de vuelo no pelea con el
 *      seguimiento (la vista queda donde el lector puso, sin tirón).
 *
 * Uso: node scripts/probe-camara-suave.js
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

async function despertar(page) {
  await page.mouse.move(720, 450);
  await page.waitForTimeout(250);
}

async function scrollTopSamples(page, ms) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        // setInterval, no rAF: los BeginFrame de headless llegan agrupados y
        // falsearían la granularidad; el timer ve cada asignación de scrollTop.
        const root = document.querySelector('[data-testid="tp-scroll"]');
        const out = [];
        const t0 = performance.now();
        const id = setInterval(() => {
          out.push({ t: Math.round(performance.now() - t0), y: root ? root.scrollTop : -1 });
          if (performance.now() - t0 >= duration) {
            clearInterval(id);
            resolve(out);
          }
        }, 8);
      }),
    ms
  );
}

(async () => {
  const browser = await chromium.launch({
    args: ["--disable-frame-rate-limit", "--disable-gpu-vsync"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator("article").filter({ hasText: "Don Quijote" }).getByRole("button", { name: /Empezar a leer|Continuar/ }).click();
  await page.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(900);

  // --- A. preset Lenta (1,5 pal/s): el salto del título llega con transición ---
  await page.locator('[data-testid="tp-toggle"]').click();
  await page.locator('[data-testid="tp-overlay"]').waitFor({ timeout: 8000 });
  await page.waitForTimeout(700);
  await despertar(page);
  await page.locator('[data-testid="tp-auto"]').click(); // sin Auto: control limpio
  await despertar(page);

  // revelado completo (clic en el escenario) → orden de cámara grande.
  // El muestreo ARRANCA ANTES del clic: nada se pierde entre clic y sondeo.
  const sampling = scrollTopSamples(page, 600);
  await page.waitForTimeout(30);
  const before = await page.evaluate(() => document.querySelector('[data-testid="tp-scroll"]').scrollTop);
  await page.mouse.click(640, 500);
  const samples = await sampling;
  const distinct = [...new Set(samples.map((s) => Math.round(s.y)))];
  const final = samples[samples.length - 1].y;
  const moved = final - before;
  // En headless los BeginFrame llegan agrupados: la interpolación se mide tosca.
  // Un salto en seco daría EXACTAMENTE 2 valores (origen → destino); con ≥3 hay
  // al menos un valor intermedio REAL entre ambos, ordenado en el tiempo.
  const interVals = distinct.filter((v) => v > Math.min(before, final) + 1 && v < Math.max(before, final) - 1);
  const firstInterIdx = samples.findIndex((s) => Math.round(s.y) === interVals[0]);
  const finalIdx = samples.map((s) => Math.round(s.y)).lastIndexOf(Math.round(final));
  check(
    `A1 revelado completo llega con transición (${samples.length} muestras en 600 ms)`,
    moved > 40 && interVals.length >= 1 && firstInterIdx < finalIdx,
    `Δ=${moved}px, valores=${distinct.length} distintos, intermedios=${interVals.length} (intermedio antes del final: ${firstInterIdx < finalIdx})`
  );

  // --- C. la rueda manda: giro manual a mitad del flujo animado ---
  await page.keyboard.press("ArrowLeft"); // rebobinar un poco (animado)
  await page.waitForTimeout(80); // a mitad de la transición
  const preWheel = await page.evaluate(() => document.querySelector('[data-testid="tp-scroll"]').scrollTop);
  await page.mouse.wheel(0, -240); // releer hacia arriba
  await page.waitForTimeout(120); // el seguimiento NO debe arrastrar de vuelta
  const afterWheel = await page.evaluate(() => document.querySelector('[data-testid="tp-scroll"]').scrollTop);
  const fighting = await scrollTopSamples(page, 200);
  const drift = Math.max(...fighting.map((s) => Math.abs(s.y - afterWheel)));
  check(
    "C1 la rueda deja la vista donde el lector pidió (sin pelea)",
    afterWheel <= preWheel + 5 && drift < 30,
    `pre=${preWheel.toFixed(0)} post=${afterWheel.toFixed(0)} deriva=${drift.toFixed(1)}px`
  );

  // --- B. preset Instantánea: la vista salta, como hoy ---
  await despertar(page);
  await page.locator('[data-testid="tp-speed"]').click();
  await page.locator('[data-testid="tp-speed-preset-instant"]').click();
  await page.keyboard.press("Escape"); // cerrar menú
  await page.waitForTimeout(300);
  await despertar(page);
  await page.mouse.click(640, 500); // revelado completo instantáneo
  const jumpSamples = await scrollTopSamples(page, 300);
  const jumpDistinct = [...new Set(jumpSamples.map((s) => Math.round(s.y)))];
  check(
    "B1 instantánea: la vista salta sin animación",
    jumpDistinct.length <= 4,
    `${jumpDistinct.length} valores distintos`
  );

  check("cero errores de consola/pageerror", errors.length === 0, errors.slice(0, 2).join(" | "));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})();
