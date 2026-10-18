/* Diagnóstico: qué produce extractVnPageText en la página abierta */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Continuar" }).first().click();
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 30000 });
  await page.waitForTimeout(2500);

  await page.getByTestId("tp-toggle").click();
  await page.waitForSelector('[data-testid="tp-overlay"]', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="tp-overlay"]');
    const box = document.querySelector('[data-testid="tp-card-box"]');
    const empty = document.querySelector('[data-testid="tp-empty"]');
    const card = document.querySelector('[data-testid="tp-card"]');
    return {
      overlayText: overlay ? overlay.querySelector(".tp-top").textContent.slice(0, 160) : null,
      boxExists: !!box,
      boxChars: box ? box.querySelectorAll(".tp-ch").length : -1,
      boxText: box ? box.textContent.slice(0, 90) : null,
      emptyShown: !!empty,
      emptyText: empty ? empty.textContent.slice(0, 80) : null,
      cardExists: !!card,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  console.log("pageerrors:", errors.length ? errors : "ninguno");
  await browser.close();
})().catch((e) => { console.error("CRASH:", e); process.exit(1); });
