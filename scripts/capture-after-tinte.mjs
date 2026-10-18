/* Captura «después» del change contraste-azul-sobre-tinte:
 * lector EPUB + teleprompter × 2 temas × 2 viewports (8 capturas).
 * Saca screenshot PNG y el outerHTML renderizado para el detector impeccable.
 * Uso: node scripts/capture-after-tinte.mjs  (dev server en :3000, biblioteca con el EPUB de prueba)
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = path.resolve("docs/screenshots");
const SNAPS = path.resolve("scripts/audit-snapshots");
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(SNAPS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });

// ---------- setup: el EPUB de prueba en la biblioteca (subir solo si falta) ----------
const setup = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p0 = await setup.newPage();
await p0.goto(BASE, { waitUntil: "networkidle" });
const yaEsta = await p0.locator('[aria-label="Abrir La Sombra del Riel"]').count();
if (yaEsta === 0) {
  console.log("subiendo EPUB de prueba…");
  await p0.setInputFiles('input[type="file"]', path.resolve("scripts/test-epub-libro.epub"));
  await p0.locator("#book-title").waitFor({ timeout: 20000 });
  await p0.getByRole("button", { name: "Añadir al riel" }).click();
  await sleep(2000);
}
await setup.close();

// ---------- capturas ----------
const combos = [];
for (const theme of ["dark", "light"])
  for (const [w, h] of [[1280, 800], [390, 844]])
    for (const surface of ["epub", "tp"])
      combos.push({ theme, w, h, surface });

for (const { theme, w, h, surface } of combos) {
  const name = `after-tinte-${surface}-${theme}-${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((t) => {
    window.localStorage.setItem("theme", t);
  }, theme);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // deja asentar la entrada animada de la biblioteca
  const abrir = page.locator('[aria-label="Abrir La Sombra del Riel"]');
  await abrir.scrollIntoViewIfNeeded();
  await abrir.click({ timeout: 30000 });
  await page.locator('[data-testid="epub-viewport"]').waitFor({ timeout: 20000 });
  // despierta el chrome (idle 4 s) y deja el cursor SOBRE la cabecera: mientras
  // repose en ella el auto-ocultado no dispara, y la captura sale con chrome
  await page.mouse.move(90, 16);
  await sleep(400);

  if (surface === "tp") {
    await page.locator('[data-testid="tp-toggle"]').click();
    await page.locator('[data-testid="tp-overlay"]').waitFor({ timeout: 8000 });
    await sleep(700);
    // despierta el chrome (auto-ocultado a los 3,5 s) y captura rápido
    await page.mouse.move(w / 2, h / 2);
    await sleep(250);
  }

  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  const html = await page.content();
  fs.writeFileSync(path.join(SNAPS, `${name}.raw`), html);
  console.log(`ok: ${name}`);
  await ctx.close();
}

await browser.close();
console.log("capturas listas");
