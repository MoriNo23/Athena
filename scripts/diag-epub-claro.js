/* Diagnóstico: en tema CLARO + filtro papel, el fondo del lector EPUB sale
 * marrón oscuro en vez de papel pálido. Camina el DOM desde .epub-p hasta
 * html recogiendo backgrounds/filters reales para señalar al culpable.
 */
const { chromium } = require("playwright");
const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });

  // tema claro + papel (igual que el repro)
  await page.evaluate(() => {
    localStorage.setItem("theme", "light");
    const filters = { preset: "papel", brightness: 103, contrast: 96, sepia: 18, saturate: 95, warmth: 22, invert: 0 };
    const raw = localStorage.getItem("riel-settings-v1");
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 10 };
    parsed.state = { ...(parsed.state || {}), filters };
    parsed.version = 10;
    localStorage.setItem("riel-settings-v1", JSON.stringify(parsed));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const openBtn = page.locator('[aria-label="Abrir La Sombra del Riel"]');
  if (await openBtn.count()) await openBtn.click();
  await page.locator('[data-testid="epub-viewport"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(900);

  const info = await page.evaluate(() => {
    const out = { chain: [], htmlClasses: document.documentElement.className, overlays: [] };
    let el = document.querySelector(".epub-p");
    while (el && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      out.chain.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 60)) || "",
        bg: cs.backgroundColor,
        bgImage: cs.backgroundImage !== "none" ? cs.backgroundImage.slice(0, 80) : "none",
        filter: cs.filter !== "none" ? cs.filter : "none",
        mixBlend: cs.mixBlendMode !== "normal" ? cs.mixBlendMode : "",
        color: cs.color,
        opacity: cs.opacity,
      });
      el = el.parentElement;
    }
    const csHtml = getComputedStyle(document.documentElement);
    out.vars = {
      bg: csHtml.getPropertyValue("--background").trim(),
      fg: csHtml.getPropertyValue("--foreground").trim(),
      vnBg: csHtml.getPropertyValue("--tp-bg").trim(),
      scrollThumb: csHtml.getPropertyValue("--scroll-thumb").trim(),
    };
    out.bodyBg = getComputedStyle(document.body).backgroundColor;
    // capas absolutas que puedan tapar (capa2, tinte cálido)
    document.querySelectorAll("body *").forEach((n) => {
      const cs = getComputedStyle(n);
      if (cs.mixBlendMode !== "normal" || (cs.position === "fixed" && cs.zIndex !== "auto" && parseInt(cs.zIndex) < 0)) {
        out.overlays.push({
          cls: String(n.className).slice(0, 60),
          blend: cs.mixBlendMode,
          bg: cs.backgroundColor,
          bgImage: cs.backgroundImage.slice(0, 60),
          zIndex: cs.zIndex,
          opacity: cs.opacity,
        });
      }
    });
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await page.screenshot({ path: "scripts/diag-claro-papel-full.png" });
  await ctx.close();
  await browser.close();
})();
