/* E2E post-fix: dock, tabs, sliders, tecla H, input página Escape, iframe + pastilla */
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

  console.log("=== A. DOCK DE AJUSTES (abierto por defecto) ===");
  // el dock abre por defecto (localStorage vacío en contexto fresco);
  // si una carrera anterior lo dejó cerrado, lo abrimos con el toggle
  if (!(await page.locator('[data-dock="modes"]').count())) {
    await page.getByTestId("toggle-dock").click();
    await page.waitForTimeout(600);
  }
  const dockVisible = await page.locator('[data-dock="modes"]').count();
  console.log("dock visible:", dockVisible);
  if (dockVisible) {
    // A1: foco en el engranaje del dock → flecha debe funcionar (antes estaba
    // bloqueada; click() abriría el popover y el bloqueo sería legítimo)
    const preset = page.locator('[data-dock="modes"] button[aria-label*="Opciones"]').first();
    await preset.focus();
    await page.waitForTimeout(300);
    const before = await scroll();
    await press("ArrowDown");
    const after = await scroll();
    console.log(`A1 flecha tras foco en botón dock: ${before}→${after} ${after > before ? "✅" : "❌"}`);

    // A2: foco en una pestaña del dock → ArrowRight cambia pestaña, NO la página
    const tab = page.locator('[data-dock="modes"] [role="tab"]').first();
    if (await tab.count()) {
      await tab.focus();
      await page.waitForTimeout(200);
      const beforeTab = await scroll();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(400);
      const afterTab = await scroll();
      console.log(`A2 flecha con tab enfocado: ${beforeTab}→${afterTab} ${afterTab === beforeTab ? "✅ (no navega página)" : "❌ (navegó página)"}`);
    }

    // A3: tecla H con foco en botón del dock → UI se oculta
    await preset.focus(); // foco en botón del dock
    await page.waitForTimeout(200);
    await press("h");
    const headerHidden = await page.evaluate(() => !!document.querySelector(".chrome-immersed"));
    console.log(`A3 tecla H tras click en dock: ${headerHidden ? "✅ UI oculta" : "❌"}`);
    await press("h"); // volver a mostrar
    await page.getByTestId("toggle-dock").click(); // cerrar dock
    await page.waitForTimeout(300);
  }

  console.log("=== B. INPUT DE PÁGINA (Escape) ===");
  const pageInput = page.getByLabel("Número de página");
  await pageInput.click();
  await pageInput.fill("2");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const before = await scroll();
  await press("ArrowDown");
  const after = await scroll();
  console.log(`B1 flecha tras Escape en input: ${before}→${after} ${after > before ? "✅" : "❌"} | foco: ${await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName)}`);

  console.log("=== C. AJUSTES (sheet con sliders) — regresión ===");
  await page.getByRole("button", { name: "Abrir ajustes del riel" }).click();
  await page.waitForTimeout(600);
  const sheetOpen = await page.locator('[role="dialog"]').count();
  console.log("sheet abierto:", sheetOpen > 0);
  if (sheetOpen) {
    const slider = page.locator('[role="dialog"] [role="slider"]').first();
    if (await slider.count()) {
      await slider.focus();
      await page.waitForTimeout(200);
      const bs = await scroll();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(400);
      const as2 = await scroll();
      console.log(`C1 flecha con slider enfocado en sheet: ${bs}→${as2} ${as2 === bs ? "✅ (slider la consume)" : "❌ (navegó página)"}`);
    }
    await page.keyboard.press("Escape"); // cerrar sheet
    await page.waitForTimeout(400);
  }
  const b2 = await scroll();
  await press("ArrowDown");
  const a2 = await scroll();
  console.log(`C2 flecha tras cerrar sheet: ${b2}→${a2} ${a2 > b2 ? "✅" : "❌"}`);

  console.log("=== D. SIN CLICK NINGUNO (recarga en limpio) ===");
  await page.evaluate(() => { try { localStorage.setItem("riel-last-book", localStorage.getItem("riel-last-book")); } catch {} });
  await page.reload({ waitUntil: "networkidle" });
  await startBookButton(page).then((b) => b.click());
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 20000 });
  await page.waitForTimeout(1200);
  const foco = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName);
  const bd = await scroll();
  await press("ArrowDown");
  const ad = await scroll();
  console.log(`D1 foco tras abrir libro (sin click en página): ${foco}`);
  console.log(`D1 flecha sin click previo: ${bd}→${ad} ${ad > bd ? "✅" : "❌"}`);

  console.log("=== CONSOLA ===");
  console.log(errors.length ? `❌ errores:\n${errors.slice(0, 5).join("\n")}` : "✅ sin errores de consola/pageerror");

  await browser.close();
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
