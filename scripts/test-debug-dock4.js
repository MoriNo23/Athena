/* Debug v4: inspeccionar props de React en el botón toggle-dock */
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
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await startBookButton(page).then((b) => b.click());
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="toggle-dock"]');
    const fk = Object.keys(btn).find((k) => k.startsWith("__reactFiber$"));
    const pk = Object.keys(btn).find((k) => k.startsWith("__reactProps$"));
    const props = pk ? btn[pk] : null;
    // comparar con un botón que SÍ funciona
    const zoomMinus = document.querySelector('button[aria-label="Reducir zoom"]');
    const zpk = zoomMinus ? Object.keys(zoomMinus).find((k) => k.startsWith("__reactProps$")) : null;
    return {
      toggle: {
        hasFiber: !!fk,
        hasProps: !!pk,
        onClick: props ? typeof props.onClick : "sin props",
        propsAria: props ? props["aria-label"] : null,
        domAria: btn.getAttribute("aria-label"),
      },
      zoomMinus: {
        hasProps: !!zpk,
        onClick: zpk ? typeof zoomMinus[zpk].onClick : "sin props",
      },
      reactRoots: Array.from(document.querySelectorAll("body *")).filter((el) =>
        Object.keys(el).some((k) => k.startsWith("__reactContainer$"))
      ).length,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
