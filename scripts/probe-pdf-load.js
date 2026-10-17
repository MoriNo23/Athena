/* Sonda: ¿la carga del PDF falla al abrir→volver→reabrir rápido?
 * Reproduce el patrón de la suite de estrés y captura el stack del error. */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  try { await fetch("http://localhost:3000/api/progress/reset-all", { method: "POST" }); } catch {}
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push({ text: m.text().slice(0, 200), loc: m.location()?.url });
  });
  page.on("pageerror", (e) => errs.push({ text: "PAGEERROR " + String(e).slice(0, 200) }));

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  for (let round = 1; round <= 3; round++) {
    const libro = round === 2 ? "Meditations" : "Cuaderno de Atenas";
    const card = page.locator("article").filter({ hasText: libro }).first();
    await card.getByRole("button", { name: /Empezar a leer|Continuar/ }).click();
    const okLoad = await page
      .locator('[data-viewport="pdf"]')
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    console.log(`ronda ${round} (${libro}): visor=${okLoad ? "OK" : "FALLO"}`);
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Volver a la biblioteca" }).first().click();
    await page.waitForTimeout(400);
  }

  console.log("\nERRORES CAPTURADOS:", errs.length);
  errs.forEach((e, i) => console.log(` ${i + 1})`, e.text, e.loc ? `@${e.loc}` : ""));
  await browser.close();
})();
