/* Sonda 2: réplica EXACTA de test-tp-rebuild A→F con dumps de estado. */
const { chromium } = require("playwright");
const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  try { await fetch(`${BASE}/api/progress/reset-all`, { method: "POST" }); } catch {}
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const dump = async (label) => {
    const st = await page.evaluate(() => {
      const ov = document.querySelector('[data-testid="tp-overlay"]');
      const sp = document.querySelector('[data-testid="tp-speed"]');
      const csr = sp ? getComputedStyle(sp) : null;
      return {
        ov: ov ? (ov.className.includes("tp-immersed") ? "INMERSO" : "visible") : "sin overlay",
        sp: sp ? { vis: csr.visibility, op: csr.opacity } : "NO EXISTE",
        focus: document.activeElement ? String(document.activeElement.tagName) + ":" + String(document.activeElement.getAttribute("data-testid") || document.activeElement.className).slice(0, 24) : "none",
      };
    });
    console.log(label, JSON.stringify(st));
  };

  // B: abrir primer libro (igual que el suite)
  const continuar = page.getByRole("button", { name: "Continuar" }).first();
  if (await continuar.count()) {
    console.log("abriendo con: Continuar");
    await continuar.click();
  } else {
    console.log("abriendo con: Empezar a leer");
    await page.getByRole("button", { name: "Empezar a leer" }).first().click();
  }
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 30000 });
  await page.waitForTimeout(1800);
  const bookTitle = await page.locator("h1, [data-testid]").first().textContent().catch(() => "?");
  console.log("libro abierto (primer h1):", bookTitle);

  // C: modo teleprompter
  await page.getByTestId("tp-toggle").click();
  await page.waitForSelector('[data-testid="tp-overlay"]', { timeout: 10000 });
  await page.waitForTimeout(900);
  for (let i = 0; i < 20; i++) {
    if ((await page.getByTestId("tp-card-box").count()) >= 1) break;
    await page.waitForTimeout(250);
  }
  await dump("C: overlay + tarjetas      ");

  // D: encendido progresivo (3 lecturas, ~3.2s sin eventos)
  await page.waitForTimeout(1600);
  await page.waitForTimeout(1600);
  await dump("D: tras 3.2s sin eventos   ");

  // E: pausa / reanudar
  await page.keyboard.press(" ");
  await page.waitForTimeout(300);
  await dump("E1: Space +300ms (pausa)   ");
  await page.waitForTimeout(1600);
  await page.keyboard.press(" ");
  await page.waitForTimeout(1400);
  await dump("E2: Space +1400ms (reanudar)");

  // F: pausa + click en tp-speed
  await page.keyboard.press(" ");
  await page.waitForTimeout(250);
  await dump("F: Space +250ms            ");
  try {
    await page.getByTestId("tp-speed").click({ timeout: 4000 });
    console.log("F: click tp-speed OK");
    await page.waitForSelector('[data-testid="tp-speed-menu"]', { timeout: 5000 });
    console.log("F: menú abierto OK");
  } catch (e) {
    console.log("F: click FALLÓ:", String(e).split("\n")[0]);
    await dump("F: tras fallo              ");
  }
  await browser.close();
})();
