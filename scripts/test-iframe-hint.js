/* E2E iframe: pastilla de foco embebido + reclamación + teclas */
const { chromium } = require("playwright");

// tras el reinicio de casa ningún libro tiene progreso: «Continuar» no existe.
// Arrancamos con el primer botón de «Empezar a leer» disponible.
async function startBookButton(page) {
  const cont = page.getByRole("button", { name: "Continuar" }).first();
  if (await cont.count()) return cont;
  return page.getByRole("button", { name: "Empezar a leer" }).first();
}

(async () => {
  const browser = await chromium.launch();
  // REGLA DE LA CASA: cada prueba parte de cero (insignias, sesiones, página 1
  // en todos los libros, incluidos los capturados img). Pide el endpoint de
  // reinicio total antes de tocar nada.
  try { await fetch("http://localhost:3000/api/progress/reset-all", { method: "POST" }); } catch {}
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("http://localhost:3000/iframe-test.html", { waitUntil: "networkidle" });
  const frame = page.frameLocator("#app");
  await frame.locator("button").first().waitFor({ timeout: 20000 });

  const state = () =>
    page.evaluate(() => {
      const doc = document.querySelector("iframe#app")?.contentDocument;
      const v = doc?.querySelector('[data-viewport="pdf"]');
      return {
        hint: !!doc?.querySelector('[data-testid="kbd-focus-hint"]'),
        iframeFocus: doc?.hasFocus(),
        scrollTop: v ? v.scrollTop : null,
      };
    });

  console.log("=== B1: app en iframe SIN click previo ===");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(500);
  console.log("sin click:", JSON.stringify(await state()));

  console.log("=== B2: click en «Continuar» dentro del iframe ===");
  await startBookButton(frame).then((b) => b.click());
  await frame.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(650);
  console.log("tras abrir libro:", JSON.stringify(await state()));

  console.log("=== B3: el padre ROBA el foco (usuario escribe en el chat) ===");
  await page.evaluate(() => window.focus());
  await page.waitForTimeout(400);
  console.log("foco robado:", JSON.stringify(await state()));

  console.log("=== B4: click de vuelta en el libro ===");
  await frame.locator('[data-viewport="pdf"]').click({ position: { x: 900, y: 400 } });
  await page.waitForTimeout(400);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(650);
  console.log("tras volver:", JSON.stringify(await state()));

  await browser.close();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
