/* E2E del MODO AUTO del modo teleprompter (Task 36, adaptado al flujo continuo).
 * Comprueba: toggle persistente, encendido automático sin interacción, pausa
 * congela el encendido (no avanza), reanudar continúa, y al acabar la página
 * gira sola con Auto. Además: fondo único sólido y columna plana.
 * REGLA DE LA CASA: reset-all ANTES de tocar nada. 0 page errors exigido.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  try { await fetch("http://localhost:3000/api/progress/reset-all", { method: "POST" }); } catch {}
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: "networkidle" });

  console.log("=== A. ABRIR LIBRO + MODO TELEPROMPTER ===");
  const start = page.getByRole("button", { name: "Empezar a leer" }).first();
  await start.waitFor({ timeout: 15000 });
  await start.click();
  await page.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
  await page.locator('[data-testid="tp-toggle"]').click();
  await page.locator('[data-testid="tp-overlay"]').waitFor({ timeout: 8000 });
  check("overlay abierto", true);

  console.log("=== B. TOGGLE AUTO (default OFF) ===");
  const autoBtn = page.locator('[data-testid="tp-auto"]');
  check("botón Auto presente", (await autoBtn.count()) === 1);
  check("auto OFF por defecto", (await autoBtn.getAttribute("aria-pressed")) === "false");
  await autoBtn.click();
  await page.waitForTimeout(250);
  check("auto ON tras click", (await autoBtn.getAttribute("aria-pressed")) === "true");

  console.log("=== C. PRESET RÁPIDO (Vía menú) ===");
  await page.locator('[data-testid="tp-speed"]').click();
  await page.locator('[data-testid="tp-speed-menu"]').waitFor({ timeout: 5000 });
  await page.locator('[data-testid="tp-speed-preset-4"]').click({ force: true });
  await page.waitForTimeout(300);
  // cerrar el menú con click neutro en la barra superior (fuera del escenario)
  await page.locator('[data-testid="tp-overlay"] p').first().click();
  await page.waitForTimeout(250);
  const topTxt = await page.locator('[data-testid="tp-overlay"] p').nth(1).textContent();
  check("preset Viva activa", /Viva/.test(topTxt ?? ""), topTxt ?? "");

  console.log("=== D. ENCENDIDO AUTOMÁTICO SIN INTERACCIÓN ===");
  // sin tarjetas: el flujo continuo enciende solo con Auto activo
  const litCount = () =>
    page.evaluate(() => document.querySelectorAll('[data-testid="tp-stream"] .tp-ch.on').length);
  const lit0 = await litCount();
  const t0 = Date.now();
  let advanced = false, waited = 0;
  while (waited < 15000) {
    if ((await litCount()) > lit0) { advanced = true; break; }
    await page.waitForTimeout(200);
    waited = Date.now() - t0;
  }
  check("auto enciende solo sin click", advanced, `${waited} ms`);
  check("overlay sigue vivo tras avance", (await page.locator('[data-testid="tp-stream"]').count()) >= 1);

  console.log("=== E. PAUSA CONGELA EL AUTO ===");
  // pausar con el flujo en marcha
  await page.keyboard.press(" ");
  await page.waitForTimeout(300);
  const pageStartPaused = await page.evaluate(() => document.querySelector('[data-testid="tp-stream"]')?.getAttribute("data-page-start"));
  const litNow = await litCount();
  await page.waitForTimeout(1600);
  const litThen = await litCount();
  const pageStartAfter = await page.evaluate(() => document.querySelector('[data-testid="tp-stream"]')?.getAttribute("data-page-start"));
  const txtPaused = await page.locator('[data-testid="tp-overlay"] p').nth(1).textContent();
  check("pausa congela encendido", litNow === litThen, `${litNow} vs ${litThen}`);
  check("auto NO avanza en pausa", pageStartPaused === pageStartAfter, txtPaused ?? "");

  console.log("=== F. REANUDAR → AUTO CONTINÚA ===");
  await page.keyboard.press(" ");
  const t1 = Date.now();
  let advanced3 = false;
  while (Date.now() - t1 < 15000) {
    if ((await litCount()) > litThen) { advanced3 = true; break; }
    await page.waitForTimeout(200);
  }
  check("auto continúa tras reanudar", advanced3);

  console.log("=== G. FIN DE PÁGINA: GIRA SOLA ===");
  const t2 = Date.now();
  let page2 = false;
  while (Date.now() - t2 < 60000) {
    const txt = await page.locator('[data-testid="tp-overlay"] p').nth(1).textContent();
    if (/Página 2 de /.test(txt ?? "")) { page2 = true; break; }
    await page.waitForTimeout(300);
  }
  check("auto gira la página al acabar", page2, `${Math.round((Date.now() - t2) / 1000)} s`);
  check("página nueva encendida en la columna", (await litCount()) > 0);

  console.log("=== H. ESCENARIO CÓMODO (fondo único sólido + columna plana) ===");
  const visual = await page.evaluate(() => {
    const ov = document.querySelector(".tp-overlay");
    const box = document.querySelector('[data-testid="tp-stream"]');
    if (!ov || !box) return null;
    const sov = getComputedStyle(ov);
    const sbox = getComputedStyle(box);
    return {
      singleBg: sov.backgroundImage === "none" && sov.backgroundColor !== "rgba(0, 0, 0, 0)",
      bgIsVar: sov.backgroundColor.length > 0,
      boxBorder: sbox.borderTopWidth,
      boxBgAlpha: sbox.backgroundColor,
      boxRadius: sbox.borderRadius,
      fontScaleVar: box.closest('[data-testid="tp-overlay"]')?.style.getPropertyValue("--tp-font-scale") ?? "",
    };
  });
  check("fondo único sólido (sin imágenes ni degradados)", !!visual?.singleBg, visual?.bgIsVar ?? "");
  check("columna SIN borde", visual?.boxBorder === "0px", visual?.boxBorder ?? "");
  check("columna SIN redondeo", visual?.boxRadius === "0px", visual?.boxRadius ?? "");

  await page.screenshot({ path: `${__dirname}/tp-redesign.png` });

  console.log("=== I. TOGGLE OFF + ESCAPE ===");
  // H lee CSS sin generar eventos: el chrome se auto-oculta (3.5 s) y el
  // toggle vive ahí. Un movimiento de mouse lo despierta (diseño del overlay).
  await page.mouse.move(720, 60);
  await page.waitForTimeout(200);
  await autoBtn.click();
  check("auto OFF tras segundo click", (await autoBtn.getAttribute("aria-pressed")) === "false");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("overlay cerrado", (await page.locator('[data-testid="tp-overlay"]').count()) === 0);

  check("cero page errors en toda la suite", errors.length === 0, errors.join(" | ").slice(0, 300));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
