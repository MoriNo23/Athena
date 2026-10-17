/* Debug: por qué el dock no aparece */
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
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await startBookButton(page).then((b) => b.click());
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  await page.getByTestId("toggle-dock").click();
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => ({
    dockCount: document.querySelectorAll('[data-dock="modes"]').length,
    dockChrome: document.querySelectorAll('[data-chrome-kind="dock"]').length,
    togglePressed: document.querySelector('[data-testid="toggle-dock"]')?.getAttribute("aria-label"),
    preset: JSON.parse(localStorage.getItem("riel-settings-v1") || "{}")?.state?.modes?.preset ?? "(sin settings)",
    dockLS: localStorage.getItem("riel-dock-open"),
  }));
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: "scripts/e2e-debug-dock.png" });
  await browser.close();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
