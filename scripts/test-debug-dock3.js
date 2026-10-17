/* Debug v3: rastrear la propagación del click y el estado de React */
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
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const logs = [];
  page.on("console", (m) => logs.push(m.text().slice(0, 150)));
  page.on("pageerror", (e) => logs.push("PAGEERROR: " + String(e).slice(0, 200)));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await startBookButton(page).then((b) => b.click());
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="toggle-dock"]');
    // rastro completo de la propagación
    btn.addEventListener("click", () => console.log("P1-btn-burbuja"), false);
    btn.parentElement.addEventListener("click", () => console.log("P2-padre-burbuja"), false);
    document.addEventListener("click", () => console.log("P3-document-burbuja"), false);
    window.addEventListener("click", () => console.log("P4-window-burbuja"), false);
    window.addEventListener("click", () => console.log("P5-window-captura"), true);
    // ¿el botón tiene listeners de React? via getEventListeners no está en page.evaluate
    console.log("btn existe:", !!btn, "| deshabilitado:", btn.disabled);
  });

  await page.evaluate(() => document.querySelector('[data-testid="toggle-dock"]').click());
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => ({
    dock: document.querySelectorAll('[data-dock="modes"]').length,
    aria: document.querySelector('[data-testid="toggle-dock"]')?.getAttribute("aria-label"),
  }));
  console.log("estado:", JSON.stringify(s));
  console.log("--- trazas ---");
  logs.forEach((l) => console.log(l));
  await browser.close();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
