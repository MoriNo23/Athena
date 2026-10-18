/* Prueba las rutas de "teclas muertas": dock, input de página, botones del header */
const { chromium } = require("playwright");

// tras el reinicio de casa ningún libro tiene progreso: «Continuar» no existe.
// Arrancamos con el primer botón de «Empezar a leer» disponible.
async function startBookButton(page) {
  const cont = page.getByRole("button", { name: "Continuar" }).first();
  if (await cont.count()) return cont;
  return page.getByRole("button", { name: "Empezar a leer" }).first();
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.ATENA_CHROMIUM || undefined });
  // REGLA DE LA CASA: cada prueba parte de cero (insignias, sesiones, página 1
  // en todos los libros, incluidos los capturados img). Pide el endpoint de
  // reinicio total antes de tocar nada.
  try { await fetch("http://localhost:3000/api/progress/reset-all", { method: "POST" }); } catch {}
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await startBookButton(page).then((b) => b.click());
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const scroll = () => page.evaluate(() => document.querySelector('[data-viewport="pdf"]').scrollTop);
  const active = () => page.evaluate(() => {
    const el = document.activeElement;
    return el?.tagName + (el?.getAttribute?.("aria-label") ? `(${el.getAttribute("aria-label").slice(0, 30)})` : "");
  });
  const pressAndMeasure = async (label) => {
    const before = await scroll();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(650);
    const after = await scroll();
    console.log(`${label}: scrollTop ${before}→${after} ${after > before ? "✅ FUNCIONA" : "❌ MUERTO"} | foco: ${await active()}`);
  };

  console.log("--- RUTA 1: tras foco en botón del dock de ajustes ---");
  // el dock abre por defecto; solo togglear si vino cerrado
  if (!(await page.locator('[data-dock="modes"]').count())) {
    await page.getByTestId("toggle-dock").click();
    await page.waitForTimeout(400);
  }
  const dockBtn = page.locator('[data-dock="modes"] button').first();
  if (await dockBtn.count()) {
    // focus (no click): click en el engranaje abriría el popover y el
    // bloqueo de flechas sería legítimo, no un bug
    await dockBtn.focus();
    await page.waitForTimeout(300);
    await pressAndMeasure("flecha tras foco dock");
    // cerrar el dock para dejar estado limpio
    await page.getByTestId("toggle-dock").click();
    await page.waitForTimeout(300);
    await pressAndMeasure("flecha tras cerrar dock");
  } else {
    console.log("no hay botones de dock visibles");
  }

  console.log("--- RUTA 2: tras escribir en el input de página ---");
  const pageInput = page.getByLabel("Número de página");
  await pageInput.click();
  await pageInput.fill("3");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  await pressAndMeasure("flecha tras Enter en input página");

  console.log("--- RUTA 3: tras click en botón normal del header (zoom +) ---");
  const zoomBtn = page.getByRole("button", { name: /Acercar|Zoom|ampliar/i }).first();
  if (await zoomBtn.count()) {
    await zoomBtn.click();
    await page.waitForTimeout(300);
    await pressAndMeasure("flecha tras click zoom");
  } else {
    console.log("sin botón de zoom con ese nombre");
  }

  console.log("--- RUTA 4: tras click en «Página siguiente» del header ---");
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await page.waitForTimeout(600);
  await pressAndMeasure("flecha tras botón pág siguiente");

  await browser.close();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
