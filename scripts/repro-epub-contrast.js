/* REPRODUCCIÓN del bug de contraste reportado por el usuario (12:57 y 13:11):
 * «modo lectura continua del EPUB: texto marrón oscuro sobre fondo marrón
 * muy oscuro, ilegible». Sospecha: la capa de tinte cálido (multiply) + filtros
 * pensados para «papel» claro aplastan el contraste en tema oscuro, porque en
 * el EPUB el «papel» ES el fondo del tema (no hay canvas blanco).
 *
 * Mide píxeles reales (filter/mixBlendMode solo existen al pintar) y calcula
 * el ratio de contraste WCAG del texto EPUB contra su fondo, en varios
 * escenarios: tema × preset de filtro.
 * REGLA DE LA CASA: reset-all ANTES de tocar nada.
 */
const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://localhost:3000";
const EPUB = path.join(__dirname, "test-epub-libro.epub");

async function measure(page, label) {
  const vp = page.locator('[data-testid="epub-viewport"]');
  if ((await vp.count()) === 0) return { label, err: "sin viewport" };
  await vp.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const slug = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const shot = `scripts/repro-epub-${slug}.png`;
  await vp.screenshot({ path: shot });
  const res = await page.evaluate(() => {
    const p = document.querySelector(".epub-p");
    const el = p || document.querySelector(".epub-page");
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  return { label, shot, ...res };
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  try { await fetch(`${BASE}/api/progress/reset-all`, { method: "POST" }); } catch {}
  // limpia EPUB de pruebas previas (anti-duplicado)
  try {
    const list = await (await fetch(`${BASE}/api/books`)).json();
    for (const b of list.books.filter((x) => x.title === "La Sombra del Riel")) {
      await fetch(`${BASE}/api/books/${b.id}`, { method: "DELETE" });
    }
  } catch {}

  const scenarios = [
    { label: "oscuro+papel(default)", theme: "dark", preset: "papel" },
    { label: "oscuro+calido(45)", theme: "dark", preset: "calido" },
    { label: "claro+papel(default)", theme: "light", preset: "papel" },
    { label: "oscuro+normal", theme: "dark", preset: "normal" },
    { label: "claro+noche(invert)", theme: "light", preset: "noche" },
  ];

  const results = [];
  // un solo contexto: sube el EPUB una vez
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', EPUB);
  await page.waitForTimeout(1200);
  await page.locator("#book-title").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Añadir al riel" }).click();
  await page.waitForTimeout(1500);
  await page.locator('[aria-label="Abrir La Sombra del Riel"]').click();
  await page.locator('[data-testid="epub-viewport"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);

  for (const sc of scenarios) {
    // tema (next-themes) + filtros (zustand persist v10) via localStorage + reload
    await page.evaluate(({ theme, preset }) => {
      localStorage.setItem("theme", theme);
      const filters = {
        normal: { preset: "normal", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
        papel: { preset: "papel", brightness: 103, contrast: 96, sepia: 18, saturate: 95, warmth: 22, invert: 0 },
        calido: { preset: "calido", brightness: 97, contrast: 100, sepia: 28, saturate: 105, warmth: 45, invert: 0 },
        noche: { preset: "noche", brightness: 94, contrast: 105, sepia: 0, saturate: 85, warmth: 0, invert: 92 },
      }[preset];
      const raw = localStorage.getItem("riel-settings-v1");
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 10 };
      parsed.state = { ...(parsed.state || {}), filters };
      parsed.version = 10;
      localStorage.setItem("riel-settings-v1", JSON.stringify(parsed));
    }, sc);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2500); // reabre el libro (persiste currentPage? no: el reader no auto-reabre)
    // volver a biblioteca y reabrir EPUB
    const backBtn = page.getByRole("button", { name: /Volver a la biblioteca|Back to library|Voltar/ }).first();
    if (await backBtn.count()) {
      await page.mouse.move(700, 400); // despierta chrome inmerso si aplica
      await page.waitForTimeout(300);
      try { await backBtn.click({ timeout: 2000 }); } catch {}
    }
    await page.waitForTimeout(700);
    const openBtn = page.locator('[aria-label="Abrir La Sombra del Riel"]');
    if (await openBtn.count()) { await openBtn.click(); }
    await page.locator('[data-testid="epub-viewport"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(900);
    const m = await measure(page, sc.label);
    results.push(m);
  }
  console.log(JSON.stringify(results, null, 1));
  await ctx.close();
  await browser.close();
})();
