/* Reproduce el bug de hotkeys en contexto iframe vs standalone */
const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const report = {};

  // ---------- ESCENARIO A: standalone (pestaña normal) ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Continuar" }).first().click();
    await page.waitForSelector('[data-viewport="pdf"]', { timeout: 20000 });
    await page.waitForTimeout(1200);
    const st = async () =>
      page.evaluate(() => {
        const v = document.querySelector('[data-viewport="pdf"]');
        return { scrollTop: v ? v.scrollTop : null, active: document.activeElement?.tagName, focus: document.hasFocus() };
      });
    report.A_beforeKeys = await st();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(700);
    report.A_afterKeyNoClick = await st();
    // click en la página y repetir
    await page.mouse.click(960, 540);
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(700);
    report.A_afterClickThenKey = await st();
    await page.close();
  }

  // ---------- ESCENARIO B: app dentro de un iframe (como el preview del chat) ----------
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto("http://localhost:3000/iframe-test.html", { waitUntil: "networkidle" });
    const frame = page.frameLocator("#app");
    await frame.getByRole("button", { name: "Continuar" }).first().waitFor({ timeout: 20000 });

    const st = () =>
      page.evaluate(() => {
        const doc = document.querySelector("iframe#app")?.contentDocument;
        const v = doc?.querySelector('[data-viewport="pdf"]');
        return {
          iframeHasFocus: doc?.hasFocus(),
          parentHasFocus: document.hasFocus(),
          scrollTop: v ? v.scrollTop : null,
          activeInIframe: doc?.activeElement?.tagName,
        };
      });

    // B1: sin NINGÚN click, apretar flecha (el foco está en el padre)
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(700);
    report.B1_keyWithoutAnyClick = await st();

    // B2: click en el botón Continuar (dentro del iframe) → ¿el iframe hereda foco y la flecha funciona?
    await frame.getByRole("button", { name: "Continuar" }).first().click();
    await frame.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    report.B2_afterOpenBook = await st();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(700);
    report.B2_afterKeyJustOpened = await st();

    // B3: click en la página del libro → flecha
    await frame.locator('[data-viewport="pdf"]').click({ position: { x: 960, y: 500 } });
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(700);
    report.B3_afterClickPageThenKey = await st();
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
