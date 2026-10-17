/* Debug v2: instrumentar el click del toggle-dock */
const { chromium } = require("playwright");

// tras el reinicio de casa ningún libro tiene progreso: «Continuar» no existe.
// Arrancamos con el primer botón de «Empezar a leer» disponible.
async function startBookButton(page) {
  const cont = page.getByRole("button", { name: "Continuar" }).first();
  if (await cont.count()) return cont;
  return page.getByRole("button", { name: "Empezar a leer" }).first();
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const logs = [];
  page.on("console", (m) => logs.push(`${m.type()}: ${m.text().slice(0, 120)}`));
  page.on("pageerror", (e) => logs.push("PAGEERROR: " + String(e).slice(0, 200)));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await startBookButton(page).then((b) => b.click());
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  // listener nativo para saber si el click llega físicamente al botón
  await page.evaluate(() => {
    const b = document.querySelector('[data-testid="toggle-dock"]');
    b.addEventListener("click", () => console.log("TOGGLE-CLICKED nativo"), { once: true });
    // observar remontajes del header
    const header = document.querySelector('[data-chrome-kind="header"]');
    if (header) console.log("HEADER-PRESENTE al instrumentar");
  });

  await page.getByTestId("toggle-dock").click();
  await page.waitForTimeout(150);
  const s1 = await page.evaluate(() => ({
    aria: document.querySelector('[data-testid="toggle-dock"]')?.getAttribute("aria-label"),
    dock: document.querySelectorAll('[data-dock="modes"]').length,
    ls: localStorage.getItem("riel-dock-open"),
  }));
  console.log("150ms tras click:", JSON.stringify(s1));
  await page.waitForTimeout(800);
  const s2 = await page.evaluate(() => ({
    aria: document.querySelector('[data-testid="toggle-dock"]')?.getAttribute("aria-label"),
    dock: document.querySelectorAll('[data-dock="modes"]').length,
    ls: localStorage.getItem("riel-dock-open"),
  }));
  console.log("950ms tras click:", JSON.stringify(s2));
  console.log("logs:", logs.filter((l) => l.includes("TOGGLE") || l.includes("HEADER") || l.includes("ERROR")).join(" | ") || "(sin marcas)");
  await browser.close();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
