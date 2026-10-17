const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Empezar a leer" }).first().click();
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 30000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: "/home/z/my-project/scripts/capa2-lector.png" });

  // modo novela visual encima de la capa 2
  await page.getByTestId("vn-toggle").click();
  await page.waitForSelector('[data-testid="vn-overlay"]', { timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "/home/z/my-project/scripts/capa2-novela.png" });
  await page.keyboard.press("Escape");

  console.log("PAGEERRORS:", errors.length, errors.slice(0, 2));
  await browser.close();
})();
