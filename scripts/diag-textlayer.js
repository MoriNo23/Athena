/* Sonda de textLayer con reintentos (el visor puede tardar o fallar transitorio) */
const { chromium } = require("playwright");

async function openReader(page, title) {
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  if (title) {
    await page.locator('[data-testid="book-card"]', { hasText: title }).first().getByRole("button", { name: /Continuar|Empezar|Volver a leer/ }).click();
  } else {
    await page.getByRole("button", { name: "Continuar" }).first().click();
  }
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const ok = await page.evaluate(() => {
      const vp = document.querySelector('[data-viewport="pdf"]');
      const c = document.querySelector("canvas");
      return !!(vp && c && c.width > 0);
    });
    if (ok) return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const opened = await openReader(page, null);
  console.log("lector abierto:", opened);
  if (!opened) process.exit(1);

  for (const probe of [117, 2, 5, 9]) {
    await page.evaluate((p) => {
      const inp = document.querySelector('input[aria-label="Número de página"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(inp, String(p));
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    }, probe);
    await page.waitForTimeout(2800);
    const info = await page.evaluate(() => {
      const tl = document.querySelector(".textLayer");
      return {
        tlExists: !!tl,
        spans: document.querySelectorAll(".textLayer span").length,
        chars: (tl?.textContent || "").trim().length,
        sample: (tl?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70),
      };
    });
    console.log(`página ${probe}:`, JSON.stringify(info));
  }
  await browser.close();
})().catch((e) => { console.error("CRASH:", e); process.exit(1); });
