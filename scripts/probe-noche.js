const { chromium } = require("playwright");
const BASE = "http://localhost:3000";
(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.setItem("theme", "light");
    const filters = { preset: "noche", brightness: 94, contrast: 105, sepia: 0, saturate: 85, warmth: 0, invert: 92 };
    const raw = localStorage.getItem("riel-settings-v1");
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 10 };
    parsed.state = { ...(parsed.state || {}), filters };
    parsed.version = 10;
    localStorage.setItem("riel-settings-v1", JSON.stringify(parsed));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const open = page.locator('[aria-label="Abrir La Sombra del Riel"]');
  if (await open.count()) await open.click();
  await page.locator('[data-testid="epub-viewport"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const el = document.querySelector(".epub-page");
    const cs = el && getComputedStyle(el);
    const raw = localStorage.getItem("riel-settings-v1");
    const st = JSON.parse(raw || "{}").state || {};
    return {
      filter: cs ? cs.filter : "NO ELEMENT",
      bg: cs ? cs.backgroundColor : "",
      htmlClass: document.documentElement.className,
      storeFilters: st.filters,
      storePreset: st.filters && st.filters.preset,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
