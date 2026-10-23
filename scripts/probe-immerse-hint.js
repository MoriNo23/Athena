/**
 * Sonda P0 #2: pista única del auto-hide del chrome (inmersión).
 *
 * Verifica en dev (localhost:3000):
 *   A. En un dispositivo fresco, la PRIMERA auto-inmersión muestra la pastilla
 *      «rv.immerseHint» (es) junto al libro solitario.
 *   B. La pastilla se retira al despertar el chrome con el mouse.
 *   C. La segunda auto-inmersión ya NO repite la pista (clave localStorage
 *      riel-immerse-hint-seen); el timing de 4 s queda intacto.
 *
 * No toca progreso de lectura (nada de reset-all). Uso: node scripts/probe-immerse-hint.js
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

const IMMERS = ".chrome-immersed";
const PILL = '[data-testid="immerse-hint"]';
// el auto-ocultado corre a 4 s (idleSeconds); margen para el fundido de 0.55 s
const IDLE_STILL_MS = 5800;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.ATENA_CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("riel-immerse-hint-seen"));

  await page.getByRole("button", { name: /Continuar|Empezar a leer/ }).first().click();
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 20000 });

  // el puntero sale de cualquier caja chrome: resting sobre el visor no frena el ocultado
  await page.mouse.move(720, 500);
  await page.waitForSelector(IMMERS, { timeout: 15000 });

  const pill = page.locator(PILL);
  check("A1 primera inmersión muestra la pista (una sola)", (await pill.count()) === 1);
  check(
    "A2 la pista dice cómo vuelve (es)",
    (await pill.textContent().catch(() => "")) === "La interfaz vuelve al mover el mouse"
  );
  check(
    "A3 la clave del dispositivo quedó marcada",
    (await page.evaluate(() => localStorage.getItem("riel-immerse-hint-seen"))) === "1"
  );

  // despierta el chrome con el mouse: la pista no debe resistirse
  await page.mouse.move(722, 504);
  await page.waitForFunction(() => !document.querySelector(".chrome-immersed"), { timeout: 8000 });
  const pillsAfterWake = await page.locator(PILL).count();
  check("B1 la pista se retira al despertar el chrome", pillsAfterWake === 0, `${pillsAfterWake} pastilla(s) tras despertar`);

  // segunda inmersión: sin pista de nuevo; el timing propio de 4 s no cambió
  await page.mouse.move(720, 500);
  await page.waitForTimeout(IDLE_STILL_MS);
  check("C1 el chrome se auto-oculta otra vez (timing intacto)", (await page.locator(IMMERS).count()) === 1);
  check("C2 la pista NO se repite", (await page.locator(PILL).count()) === 0);

  check("sin errores de página", errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n${pass} PASS${fail ? ` — ${fail} FAIL` : ", todo verde"}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("SONDA FALLÓ:", e);
  process.exit(1);
});
