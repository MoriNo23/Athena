/* Diagnóstico visual: qué pasa tras el click en Continuar */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 300)); });

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const before = await page.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent ?? null,
    buttons: Array.from(document.querySelectorAll("button")).map((b) => b.textContent?.trim()).filter((t) => t && t.length < 30).slice(0, 12),
  }));
  console.log("ANTES:", JSON.stringify(before, null, 2));

  const btn = page.getByRole("button", { name: "Continuar" }).first();
  console.log("botones Continuar:", await btn.count());
  await btn.click({ timeout: 8000 }).catch((e) => console.log("click error:", String(e).slice(0, 200)));

  await page.waitForTimeout(6000);
  const after = await page.evaluate(() => ({
    viewport: document.querySelectorAll('[data-viewport="pdf"]').length,
    canvas: document.querySelectorAll("canvas").length,
    overlayNext: !!document.querySelector(".nextjs-portal"),
    bodyText: document.body.innerText.replace(/\s+/g, " ").slice(0, 220),
  }));
  console.log("DESPUÉS:", JSON.stringify(after, null, 2));
  await page.screenshot({ path: "scripts/diag-state.png" });
  console.log("errores:", errors.length ? errors.slice(0, 6) : "ninguno");
  await browser.close();
})().catch((e) => { console.error("CRASH:", e); process.exit(1); });
