/* E2E del modo teleprompter reconstruido (letras + pausas + disolvencia).
 * Suite: apertura, encendido progresivo, pausa/reanudar, presets, disolvencia
 * cruzada (capa saliente única), retroceso, giro de página real, Escape,
 * reduced-motion y hero Atenea. 0 page errors exigido.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

(async () => {
  const browser = await chromium.launch();
  // REGLA DE LA CASA: cada prueba parte de cero (insignias, sesiones, página 1
  // en todos los libros, incluidos los capturados img). Pide el endpoint de
  // reinicio total antes de tocar nada.
  try { await fetch("http://localhost:3000/api/progress/reset-all", { method: "POST" }); } catch {}
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: "networkidle" });

  console.log("=== A. HERO ATENEA (biblioteca) ===");
  const heroTitle = await page.locator("h1", { hasText: "Atena" }).count();
  check("hero «Atena» visible", heroTitle >= 1);
  const owl = await page.locator(".atena-hero svg").count();
  check("búho SVG en el hero", owl >= 1);

  console.log("=== B. ABRIR SOFÍA ===");
  // Tras el reinicio de casa todo el libro está en página 1: si no hay
  // «Continuar» se arranca con «Empezar a leer».
  const continuar = page.getByRole("button", { name: "Continuar" }).first();
  if (await continuar.count()) {
    await continuar.click();
  } else {
    await page.getByRole("button", { name: "Empezar a leer" }).first().click();
  }
  await page.waitForSelector('[data-viewport="pdf"]', { timeout: 30000 });
  await page.waitForTimeout(1800);

  console.log("=== C. MODO TELEPROMPTER: APERTURA ===");
  check("botón tp-toggle presente", (await page.getByTestId("tp-toggle").count()) === 1);
  await page.getByTestId("tp-toggle").click();
  await page.waitForSelector('[data-testid="tp-overlay"]', { timeout: 10000 });
  await page.waitForTimeout(900); // carga de texto de la página
  check("overlay abierto", (await page.getByTestId("tp-overlay").count()) === 1);
  let cardCount = 0;
  for (let i = 0; i < 20; i++) {
    cardCount = await page.getByTestId("tp-card-box").count();
    if (cardCount >= 1) break;
    await page.waitForTimeout(250);
  }
  check("hay tarjeta viva", cardCount >= 1, `vistas: ${cardCount}`);
  const emptyState = await page.getByTestId("tp-empty").count();
  check("página actual con texto seleccionable", emptyState === 0, emptyState ? "APARECIÓ ESTADO VACÍO" : "");

  // silenciar el tipeo para el resto de la suite
  const soundBtn = await page.getByTestId("tp-sound").count();
  if (soundBtn === 1) await page.getByTestId("tp-sound").click();

  console.log("=== D. ENCENDIDO PROGRESIVO (letra a letra) ===");
  const litAt = () => page.evaluate(() => document.querySelectorAll('[data-testid="tp-card-box"] .tp-ch.on').length);
  const totalCh = await page.evaluate(() => document.querySelectorAll('[data-testid="tp-card-box"] .tp-ch').length);
  check("tarjeta con caracteres", totalCh > 20, `${totalCh} chars`);
  const lit0 = await litAt();
  await page.waitForTimeout(1600);
  const lit1 = await litAt();
  await page.waitForTimeout(1600);
  const lit2 = await litAt();
  check("las letras se encienden solas", lit0 < lit1 && lit1 <= lit2, `t0=${lit0} t1.6=${lit1} t3.2=${lit2} de ${totalCh}`);
  check("rituo Lenta: ~13-25 letras en 1,6 s", lit1 - lit0 >= 6 && lit1 - lit0 <= 40, `${lit1 - lit0} letras/1.6s`);

  console.log("=== E. PAUSA / REANUDAR (Espacio) ===");
  // REGLA DEL OVERLAY: Space sobre una tarjeta TERMINADA avanza, no pausa.
  // Nos colocamos en una tarjeta EN MARCHA antes de probar la pausa.
  {
    const tot = await page.evaluate(() => document.querySelectorAll('[data-testid="tp-card-box"] .tp-ch').length);
    const now = await litAt();
    if (tot > 0 && now >= tot) {
      await page.getByTestId("tp-next").click();
      await page.waitForTimeout(400);
    }
  }
  await page.keyboard.press(" ");
  await page.waitForTimeout(200);
  const p0 = await litAt();
  await page.waitForTimeout(1400);
  const p1 = await litAt();
  check("pausa detiene el encendido", p0 === p1, `${p0} vs ${p1}`);
  await page.keyboard.press(" ");
  await page.waitForTimeout(1400);
  const p2 = await litAt();
  check("reanudar continúa el encendido", p2 > p1, `${p1} → ${p2}`);

  console.log("=== F. PRESETS DE VELOCIDAD (menú) ===");
  // pausa: con el encendido corriendo el menú se desmonta a mitad del click
  await page.keyboard.press(" ");
  await page.waitForTimeout(250);
  await page.getByTestId("tp-speed").click();
  await page.waitForSelector('[data-testid="tp-speed-menu"]', { timeout: 5000 });
  const presetBtns = await page.locator('[data-testid^="tp-speed-preset-"]').count();
  check("5 presets en el menú", presetBtns === 5, String(presetBtns));
  await page.getByTestId("tp-speed-preset-0-8").click();
  await page.waitForTimeout(300);
  const labelSlow = await page.getByTestId("tp-overlay").textContent();
  check("preset Contemplativa activa", labelSlow.includes("Contemplativa"));
  // el menú sigue ABIERTO tras elegir Contemplativa (el popover no se cierra
  // al pulsar un ítem): el segundo click sobre el gatillo LO CERRABA y el
  // preset quedaba desmontado. Elegimos directo, con force por el re-render.
  await page.getByTestId("tp-speed-preset-1-5").click({ force: true });
  await page.waitForTimeout(300);
  await page.keyboard.press(" "); // reanudar para las secciones siguientes

  console.log("=== G. DISOLVENCIA CRUZADA (capa saliente) ===");
  let burstPeak = 0;
  await page.getByTestId("tp-next").click();          // completa la tarjeta
  await page.waitForTimeout(150);
  await page.getByTestId("tp-next").click();          // avanza → capa saliente
  await page.waitForTimeout(120);
  const leaving1 = await page.getByTestId("tp-card-leaving").count();
  check("capa saliente congelada aparece", leaving1 === 1, String(leaving1));
  for (let i = 0; i < 3; i++) {
    await page.getByTestId("tp-next").click();
    await page.waitForTimeout(90);
    const c = await page.getByTestId("tp-card-leaving").count();
    burstPeak = Math.max(burstPeak, c);
  }
  // La capa saliente se disuelve a los 320 ms por diseño («que apenas se
  // perciba el residuo»): medirla a los 350 ms daba 0. Lo que importa de la
  // ráfaga: NUNCA se apilan capas (el estado Leaving es un objeto único, no
  // una lista). Se muestrea DURANTE la ráfaga y se exige ≤1 en todo momento.
  await page.waitForTimeout(80);
  const burstMax = burstPeak;
  check("ráfaga de 3 clics = a lo sumo UNA saliente viva", burstMax <= 1, `pico=${burstPeak}`);

  console.log("=== H. RETROCESO ===");
  const tagline = () => page.evaluate(() => {
    // el status vive en la barra superior (.tp-chrome, antes .tp-top en el
    // overlay viejo): segundo <p> del overlay = título + status
    const el = document.querySelectorAll('[data-testid="tp-overlay"] p')[1];
    return el ? el.textContent : "";
  });
  const tBefore = await tagline();
  await page.getByTestId("tp-prev").click();
  await page.waitForTimeout(250);
  const tAfter = await tagline();
  check("tp-prev vuelve a la tarjeta anterior", tBefore !== tAfter, `${tBefore} → ${tAfter}`);

  console.log("=== I. GIRO DE PÁGINA REAL ===");
  const pageNumBefore = await page.evaluate(() => {
    const inp = document.querySelector('input[aria-label="Número de página"]');
    return inp ? inp.value : "?";
  });
  for (let i = 0; i < 40; i++) {
    const label = await page.getByTestId("tp-next").textContent();
    if (label && label.includes("Página siguiente")) break;
    await page.getByTestId("tp-next").click();
    await page.waitForTimeout(110);
  }
  const atEnd = await page.getByTestId("tp-next").textContent();
  check("última tarjeta muestra «Página siguiente»", atEnd.includes("Página siguiente"), atEnd.trim());
  // dos golpes: el 1º TERMINA la tarjeta recién llegada, el 2º GIRA la página
  await page.getByTestId("tp-next").click();
  await page.waitForTimeout(200);
  await page.getByTestId("tp-next").click();
  let pageNumAfter = "?";
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(300);
    pageNumAfter = await page.evaluate(() => {
      const inp = document.querySelector('input[aria-label="Número de página"]');
      return inp ? inp.value : "?";
    });
    if (pageNumAfter !== pageNumBefore) break;
  }
  check("el libro gira de verdad", pageNumBefore !== pageNumAfter, `${pageNumBefore} → ${pageNumAfter}`);

  console.log("=== J. ESCAPE CIERRA ===");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("overlay cerrado", (await page.getByTestId("tp-overlay").count()) === 0);

  console.log("=== K. REDUCED MOTION (contexto aparte) ===");
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page2 = await ctx2.newPage();
  page2.on("pageerror", (e) => errors.push("RM: " + String(e)));
  await page2.goto(BASE, { waitUntil: "networkidle" });
  const cont2 = page2.getByRole("button", { name: "Continuar" }).first();
  if (await cont2.count()) {
    await cont2.click();
  } else {
    await page2.getByRole("button", { name: "Empezar a leer" }).first().click();
  }
  await page2.waitForSelector('[data-viewport="pdf"]', { timeout: 30000 });
  await page2.waitForTimeout(1200);
  await page2.getByTestId("tp-toggle").click();
  await page2.waitForSelector('[data-testid="tp-card-box"]', { timeout: 10000 });
  await page2.waitForTimeout(400);
  const rm = await page2.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('[data-testid="tp-card-box"] .tp-ch'));
    const on = spans.filter((s) => getComputedStyle(s).opacity === "1").length;
    return { total: spans.length, on };
  });
  check("reduced-motion: TODO visible al instante", rm.total > 0 && rm.on === rm.total, `${rm.on}/${rm.total}`);
  await ctx2.close();

  console.log("=== L. VUELTA A BIBLIOTECA ===");
  // el reposo de la sección K (6 s) autooculta la UI: mover el mouse la despierta
  await page.mouse.move(720, 20);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Volver a la biblioteca" }).click();
  await page.waitForTimeout(900);
  const backHero = await page.locator("h1", { hasText: "Atena" }).count();
  check("regreso al hero Atenea", backHero >= 1);

  check("cero page errors en toda la suite", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
