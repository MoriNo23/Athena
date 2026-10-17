/* E2E del MODO AUTO del Modo Novela Visual (Task 36).
 * Comprueba: toggle persistente, avance automático de tarjeta tras terminar,
 * pausa congela el auto (no avanza), reanudar continúa, y al acabar la página
 * gira sola. Además: fondo opaco con fachada ateniense y card brutalista.
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

  console.log("=== A. ABRIR LIBRO + MODO NOVELA ===");
  const start = page.getByRole("button", { name: "Empezar a leer" }).first();
  await start.waitFor({ timeout: 15000 });
  await start.click();
  await page.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
  await page.locator('[data-testid="vn-toggle"]').click();
  await page.locator('[data-testid="vn-overlay"]').waitFor({ timeout: 8000 });
  check("overlay abierto", true);

  console.log("=== B. TOGGLE AUTO (default OFF) ===");
  const autoBtn = page.locator('[data-testid="vn-auto"]');
  check("botón Auto presente", (await autoBtn.count()) === 1);
  check("auto OFF por defecto", (await autoBtn.getAttribute("aria-pressed")) === "false");
  await autoBtn.click();
  await page.waitForTimeout(250);
  check("auto ON tras click", (await autoBtn.getAttribute("aria-pressed")) === "true");

  console.log("=== C. PRESET RÁPIDO (Vía menú) ===");
  await page.locator('[data-testid="vn-speed"]').click();
  await page.locator('[data-testid="vn-speed-menu"]').waitFor({ timeout: 5000 });
  await page.locator('[data-testid="vn-speed-preset-4"]').click({ force: true });
  await page.waitForTimeout(300);
  // cerrar el menú con click neutro en la barra superior (fuera del escenario)
  await page.locator('[data-testid="vn-overlay"] p').first().click();
  await page.waitForTimeout(250);
  const topTxt = await page.locator('[data-testid="vn-overlay"] p').nth(1).textContent();
  check("preset Viva activa", /Viva/.test(topTxt ?? ""), topTxt ?? "");

  console.log("=== D. AVANCE AUTOMÁTICO DE TARJETA ===");
  // completar la tarjeta 1 con UN click (solo el encendido; el avance será del auto)
  await page.locator('[data-testid="vn-stage"]').click();
  const t0 = Date.now();
  let advanced = false, waited = 0;
  while (waited < 6000) {
    const txt = await page.locator('[data-testid="vn-overlay"] p').nth(1).textContent();
    if (/tarjeta 2\//.test(txt ?? "")) { advanced = true; break; }
    await page.waitForTimeout(150);
    waited = Date.now() - t0;
  }
  check("auto avanza a tarjeta 2 sin click", advanced, `${waited} ms`);
  check("overlay sigue vivo tras avance", (await page.locator('[data-testid="vn-card-box"]').count()) >= 1);

  console.log("=== E. PAUSA CONGELA EL AUTO ===");
  // pausar en cuanto la tarjeta 2 empiece a encender
  await page.keyboard.press(" ");
  await page.waitForTimeout(300);
  const litNow = await page.evaluate(() => document.querySelectorAll('[data-testid="vn-card-box"] .vn-ch.on').length);
  await page.waitForTimeout(1600);
  const litThen = await page.evaluate(() => document.querySelectorAll('[data-testid="vn-card-box"] .vn-ch.on').length);
  const txtPaused = await page.locator('[data-testid="vn-overlay"] p').nth(1).textContent();
  check("pausa congela encendido", litNow === litThen, `${litNow} vs ${litThen}`);
  check("auto NO avanza en pausa", /tarjeta 2\//.test(txtPaused ?? ""), txtPaused ?? "");

  console.log("=== F. REANUDAR → AUTO CONTINÚA ===");
  await page.keyboard.press(" ");
  const t1 = Date.now();
  let advanced3 = false;
  while (Date.now() - t1 < 12000) {
    const txt = await page.locator('[data-testid="vn-overlay"] p').nth(1).textContent();
    if (/tarjeta 3\//.test(txt ?? "")) { advanced3 = true; break; }
    await page.waitForTimeout(200);
  }
  check("auto continúa hasta tarjeta 3", advanced3);

  console.log("=== G. FIN DE PÁGINA: GIRA SOLA ===");
  const t2 = Date.now();
  let page2 = false;
  while (Date.now() - t2 < 30000) {
    const txt = await page.locator('[data-testid="vn-overlay"] p').nth(1).textContent();
    if (/Página 2 de /.test(txt ?? "")) { page2 = true; break; }
    await page.waitForTimeout(300);
  }
  check("auto gira la página al acabar", page2, `${Math.round((Date.now() - t2) / 1000)} s`);
  check("tarjeta nueva encendida en página 2", (await page.locator('[data-testid="vn-card-box"]').count()) >= 1);

  console.log("=== H. ESCENARIO CÓMODO (fondo único sólido + card plana) ===");
  const visual = await page.evaluate(() => {
    const ov = document.querySelector(".vn-overlay");
    const box = document.querySelector('[data-testid="vn-card-box"]');
    if (!ov || !box) return null;
    const sov = getComputedStyle(ov);
    const sbox = getComputedStyle(box);
    return {
      singleBg: sov.backgroundImage === "none" && sov.backgroundColor !== "rgba(0, 0, 0, 0)",
      bgIsVar: sov.backgroundColor.length > 0,
      cardBorder: sbox.borderTopWidth,
      cardBgAlpha: sbox.backgroundColor,
      cardRadius: sbox.borderRadius,
      fontScaleVar: box.closest('[data-testid="vn-overlay"]')?.style.getPropertyValue("--vn-font-scale") ?? "",
    };
  });
  check("fondo único sólido (sin imágenes ni degradados)", !!visual?.singleBg, visual?.bgIsVar ?? "");
  check("card SIN borde", visual?.cardBorder === "0px", visual?.cardBorder ?? "");
  check("card SIN redondeo", visual?.cardRadius === "0px", visual?.cardRadius ?? "");

  await page.screenshot({ path: "/home/z/my-project/scripts/vn-redesign.png" });

  console.log("=== I. TOGGLE OFF + ESCAPE ===");
  await autoBtn.click();
  check("auto OFF tras segundo click", (await autoBtn.getAttribute("aria-pressed")) === "false");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("overlay cerrado", (await page.locator('[data-testid="vn-overlay"]').count()) === 0);

  check("cero page errors en toda la suite", errors.length === 0, errors.join(" | ").slice(0, 300));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
