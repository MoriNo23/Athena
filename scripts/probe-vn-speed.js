/* Sonda: ¿por qué vn-speed queda invisible en test-vn-rebuild sección F?
 * Replica D→E→F con instrumentación de clase/estilo/foco en cada paso. */
const { chromium } = require("playwright");
const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  // abre el primer libro (Quijote) y el modo novela
  await page.getByRole("button", { name: "Empezar a leer" }).first().click();
  await page.waitForTimeout(2500);
  await page.getByTestId("vn-toggle").click();
  await page.locator('[data-testid="vn-overlay"]').waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);

  const dump = async (label) => {
    const st = await page.evaluate(() => {
      const ov = document.querySelector('[data-testid="vn-overlay"]');
      const sp = document.querySelector('[data-testid="vn-speed"]');
      const csr = sp ? getComputedStyle(sp) : null;
      const box = sp ? sp.getBoundingClientRect() : null;
      return {
        ovClass: ov ? ov.className : "?",
        speed: sp
          ? { vis: csr.visibility, op: csr.opacity, disp: csr.display, w: Math.round(box.width), h: Math.round(box.height) }
          : "NO EXISTE",
        focus: document.activeElement && (document.activeElement.tagName + "." + String(document.activeElement.className).slice(0, 30)),
      };
    });
    console.log(label, JSON.stringify(st));
  };

  await dump("tras abrir overlay      ");
  await page.keyboard.press(" "); // pausa (E)
  await page.waitForTimeout(300);
  await dump("E: Space+300ms          ");
  await page.keyboard.press(" "); // reanudar (F)
  await page.waitForTimeout(250);
  await dump("F: Space+250ms          ");
  const clickable = await page.getByTestId("vn-speed").isVisible().catch(() => false);
  console.log("vn-speed visible para click:", clickable);
  if (clickable) {
    await page.getByTestId("vn-speed").click();
    await page.waitForSelector('[data-testid="vn-speed-menu"]', { timeout: 5000 }).catch(() => {});
    console.log("menú de velocidad:", (await page.locator('[data-testid="vn-speed-menu"]').count()) > 0);
  } else {
    // ¿despierta con un movimiento de mouse?
    await page.mouse.move(700, 400);
    await page.waitForTimeout(200);
    await dump("tras mouse.move         ");
    console.log("vn-speed visible tras mouse:", await page.getByTestId("vn-speed").isVisible().catch(() => false));
  }
  await browser.close();
})();
