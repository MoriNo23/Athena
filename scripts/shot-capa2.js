const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/home/z/my-project/scripts/capa2-biblioteca.png" });
  // capa 2 presente y estática (sin animación)
  const capa = await page.evaluate(() => {
    const el = document.querySelector(".atena-capa2");
    if (!el) return null;
    const st = getComputedStyle(el);
    const img = getComputedStyle(el.querySelector(".atena-capa2__fachada"));
    const busto = getComputedStyle(el.querySelector(".atena-capa2__busto"));
    const anims = [st, img, busto].map((s) => s.animationName + "/" + s.transitionProperty);
    return {
      position: st.position, z: st.zIndex, pe: st.pointerEvents,
      fachadaImg: img.backgroundImage.includes("atena-capa2-fachada"),
      bustoImg: busto.backgroundImage.includes("atena-capa2-busto"),
      anims,
    };
  });
  console.log("CAPA2:", JSON.stringify(capa));
  // sello presente, búho muerto
  const seal = await page.evaluate(() => {
    const svg = document.querySelector(".atena-hero svg.seal-glow, .atena-hero svg");
    return svg ? { lines: svg.querySelectorAll("line").length, circles: svg.querySelectorAll("circle").length } : null;
  });
  console.log("SELLO:", JSON.stringify(seal));
  // libros pintados
  const cards = await page.locator("[data-testid^='book-card'], .book-card, article").count();
  console.log("TARJETAS:", cards);
  console.log("PAGEERRORS:", errors.length, errors.slice(0, 3));
  await browser.close();
})();
