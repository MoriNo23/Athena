/* E2E final: dock (abierto por defecto), botones del panel de ajustes, tabs, tecla H, toggle */
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
  // REGLA DE LA CASA: cada prueba parte de cero (insignias, sesiones, página 1
  // en todos los libros, incluidos los capturados img). Pide el endpoint de
  // reinicio total antes de tocar nada.
  try { await fetch("http://localhost:3000/api/progress/reset-all", { method: "POST" }); } catch {}
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await startBookButton(page).then((b) => b.click());
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const scroll = () => page.evaluate(() => document.querySelector('[data-viewport="pdf"]').scrollTop);
  const press = async (key) => { await page.keyboard.press(key); await page.waitForTimeout(650); };

  console.log("=== A. DOCK ABIERTO POR DEFECTO ===");
  const dockOpen = await page.locator('[data-dock="modes"]').count();
  console.log("dock abierto al entrar:", dockOpen === 1 ? "sí" : "no");
  if (dockOpen) {
    // A1: foco en el engranaje del dock → flecha funciona (Fix A: el guard ya no
    // bloquea el dock entero; click() abriría el popover y el bloqueo sería legítimo)
    const dockBtn = page.locator('[data-dock="modes"] button[aria-label*="Opciones"]').first();
    await dockBtn.focus();
    await page.waitForTimeout(300);
    const b1 = await scroll();
    await press("ArrowDown");
    const a1 = await scroll();
    console.log(`A1 flecha tras foco en botón dock: ${b1}→${a1} ${a1 > b1 ? "✅" : "❌"}`);

    // A2: foco en tab del dock → ArrowRight cambia pestaña, NO la página (regresión del guard)
    const tab = page.locator('[data-dock="modes"] [role="tab"]').first();
    if (await tab.count()) {
      await tab.focus();
      await page.waitForTimeout(200);
      const b2 = await scroll();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(400);
      const a2 = await scroll();
      console.log(`A2 flecha con tab enfocado: ${b2}→${a2} ${a2 === b2 ? "✅ (tab la consume)" : "❌ (navegó página)"}`);
    }

    // A3: tecla H con foco en botón del dock → UI se oculta
    await dockBtn.focus();
    await page.waitForTimeout(200);
    await press("h");
    const hidden = await page.evaluate(() => !!document.querySelector(".chrome-immersed"));
    console.log(`A3 tecla H tras click en dock: ${hidden ? "✅ UI oculta" : "❌"}`);
    await press("h");

    // A4: toggle del dock cierra y abre
    await page.getByTestId("toggle-dock").click();
    await page.waitForTimeout(300);
    const closed = (await page.locator('[data-dock="modes"]').count()) === 0;
    await page.getByTestId("toggle-dock").click();
    await page.waitForTimeout(300);
    const reopened = (await page.locator('[data-dock="modes"]').count()) === 1;
    console.log(`A4 toggle dock: cerrar ${closed ? "✅" : "❌"} / abrir ${reopened ? "✅" : "❌"}`);
  }

  console.log("=== CONSOLA ===");
  console.log(errors.length ? `❌ errores:\n${errors.slice(0, 5).join("\n")}` : "✅ sin errores de consola/pageerror");
  await browser.close();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
