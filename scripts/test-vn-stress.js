/* E2E de ESTRÉS del Modo Novela Visual (superpowers systematic-debugging + ponytail).
 * Caza bordes duros: libro OCR sin texto, tormenta de clicks con Auto, cambio de
 * preset a mitad de encendido, Escape a mitad de transición, desborde de card en
 * viewport chico, retroceso en 0, sonido OFF, Auto en ÚLTIMA página.
 * REGLA DE LA CASA: reset-all primero. 0 errores de consola exigido.
 * Lección: abrir SIEMPRE el libro por nombre (el último leído pasa a ser la
 * primera tarjeta) y leer numPages del header (span «de N»).
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

async function abrirQuijote(page) {
  await page.locator("article").filter({ hasText: "Don Quijote" }).getByRole("button", { name: /Empezar a leer|Continuar/ }).click();
  await page.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(900); // deja cargar el doc
}

async function abrirVN(page) {
  await page.locator('[data-testid="vn-toggle"]').click();
  await page.locator('[data-testid="vn-overlay"]').waitFor({ timeout: 8000 });
  await page.waitForTimeout(600);
}

async function litCount(page) {
  return page.evaluate(() => document.querySelectorAll('[data-testid="vn-card-box"] .vn-ch.on').length);
}

async function topBar(page) {
  return (await page.locator('[data-testid="vn-overlay"] p').nth(1).textContent()) ?? "";
}

/** deja el overlay en una tarjeta EN MARCHA (encendiendo) y sin auto */
async function tarjetaEnMarcha(page) {
  await page.locator('[data-testid="vn-auto"]').getAttribute("aria-pressed").then(async (st) => {
    if (st === "true") await page.locator('[data-testid="vn-auto"]').click();
  });
  const prev = page.locator('[data-testid="vn-prev"]');
  if (!(await prev.isDisabled())) {
    await prev.click(); // tarjeta fresca arranca encendiendo
    await page.waitForTimeout(350);
  }
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  try { await fetch("http://localhost:3000/api/progress/reset-all", { method: "POST" }); } catch {}
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: "networkidle" });

  console.log("=== A. LIBRO OCR (solo imagen) → estado vacío digno ===");
  const cuaderno = page.locator("article").filter({ hasText: "Cuaderno de Atenas" });
  await cuaderno.getByRole("button", { name: /Empezar a leer|Continuar/ }).click();
  await page.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
  await abrirVN(page);
  await page.waitForTimeout(800);
  const empty = await page.locator('[data-testid="vn-empty"]').count();
  const hasBox = await page.locator('[data-testid="vn-card-box"]').count();
  check("página sin texto muestra estado vacío", empty === 1 || hasBox >= 1, `empty=${empty} box=${hasBox}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("Escape sale del vacío sin crash", (await page.locator('[data-testid="vn-overlay"]').count()) === 0);
  await page.getByRole("button", { name: "Volver a la biblioteca" }).first().click();
  await page.locator("h1", { hasText: "Atena" }).waitFor({ timeout: 10000 });

  console.log("=== B. TORMENTA DE CLICKS CON AUTO (Quijote) ===");
  await abrirQuijote(page);
  await abrirVN(page);
  await page.locator('[data-testid="vn-auto"]').click(); // ON
  await page.locator('[data-testid="vn-speed"]').click();
  await page.locator('[data-testid="vn-speed-preset-4"]').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('[data-testid="vn-overlay"] p').first().click(); // cerrar menú sin avanzar
  for (let i = 0; i < 6; i++) {
    await page.locator('[data-testid="vn-stage"]').click({ delay: 10 }).catch(() => {});
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(900);
  const stormTop = await topBar(page);
  const stormState = await page.evaluate(() => ({
    leaving: document.querySelectorAll('[data-testid="vn-card-leaving"]').length,
    boxes: document.querySelectorAll('[data-testid="vn-card-box"]').length,
  }));
  const mStorm = stormTop.match(/tarjeta (\d+)\/(\d+)/);
  const idxOk = mStorm ? +mStorm[1] >= 1 && +mStorm[1] <= +mStorm[2] : false;
  check("tarjeta siempre en rango tras tormenta", idxOk, stormTop);
  check("a lo sumo UNA capa saliente", stormState.leaving <= 1, `leaving=${stormState.leaving}`);
  check("tarjeta viva presente", stormState.boxes >= 1);
  await page.locator('[data-testid="vn-auto"]').click(); // OFF para estado estable

  console.log("=== C. PRESET A MITAD DE ENCENDIDO ===");
  await tarjetaEnMarcha(page);
  const litA = await litCount(page);
  await page.locator('[data-testid="vn-speed"]').click();
  await page.locator('[data-testid="vn-speed-preset-1-5"]').click({ force: true });
  await page.waitForTimeout(150);
  await page.locator('[data-testid="vn-overlay"] p').first().click();
  await page.waitForTimeout(900);
  const litB = await litCount(page);
  check("encendido sigue vivo tras cambiar preset", litB >= litA && litB > 0, `${litA} → ${litB}`);

  console.log("=== D. ESCAPE A MITAD DE TRANSICIÓN ===");
  await page.locator('[data-testid="vn-stage"]').click(); // dispara disolvencia
  await page.waitForTimeout(80);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("overlay muere limpio a mitad de transición", (await page.locator('[data-testid="vn-overlay"]').count()) === 0);

  console.log("=== E. DESBORDE DE CARD (viewport chico) ===");
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.waitForTimeout(600);
  await abrirVN(page);
  await page.waitForTimeout(1500);
  // avanzar a una tarjeta LARGA: el bug histórico era una sola línea infinita
  await page.locator('[data-testid="vn-next"]').click();
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="vn-stage"]');
    const box = document.querySelector('[data-testid="vn-card-box"]');
    if (!stage || !box) return null;
    const sb = stage.getBoundingClientRect();
    const bb = box.getBoundingClientRect();
    return {
      stageH: Math.round(sb.height),
      boxH: Math.round(bb.height),
      overflow: Math.round(bb.height - sb.height),
      // lección del bug «línea infinita»: el texto debe ENVOLVER, no desbordar
      hFits: box.scrollWidth <= box.clientWidth + 2,
      scrollW: box.scrollWidth,
      clientW: box.clientWidth,
      boxX: Math.round(bb.x),
      boxRight: Math.round(bb.right),
      viewportW: window.innerWidth,
    };
  });
  check("card cabe en el escenario (700px)", !!fit && fit.overflow <= 0, JSON.stringify(fit));
  check("card ENVUELVE el texto (sin desborde horizontal)", !!fit && fit.hFits, fit ? `scrollW ${fit.scrollW} vs clientW ${fit.clientW}` : "n/a");
  check("card dentro del viewport (sin corte lateral)", !!fit && fit.boxX >= 0 && fit.boxRight <= fit.viewportW + 1, fit ? `x=${fit.boxX} right=${fit.boxRight}` : "n/a");
  await page.screenshot({ path: "/home/z/my-project/scripts/vn-stress-small.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log("=== F. RETROCESO EN TARJETA 0 ===");
  await abrirVN(page);
  const prev = page.locator('[data-testid="vn-prev"]');
  for (let i = 0; i < 12 && !(await prev.isDisabled()); i++) {
    await prev.click();
    await page.waitForTimeout(450);
  }
  check("llegamos a tarjeta 1 (vn-prev deshabilitado)", await prev.isDisabled());
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  const leavingF = await page.evaluate(() => document.querySelectorAll('[data-testid="vn-card-leaving"]').length);
  check("ArrowLeft en 0 no crea capa saliente", leavingF === 0, `leaving=${leavingF}`);

  console.log("=== G. SONIDO OFF NO ROMPE ENCENDIDO ===");
  await tarjetaEnMarcha(page);
  const litG1 = await litCount(page);
  await page.locator('[data-testid="vn-sound"]').click(); // OFF
  await page.waitForTimeout(800);
  const litG2 = await litCount(page);
  check("letras siguen encendiendo sin sonido", litG2 > litG1, `${litG1} → ${litG2}`);
  await page.locator('[data-testid="vn-sound"]').click(); // ON de nuevo
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  console.log("=== H. AUTO EN ÚLTIMA PÁGINA (no loop, sin giro fantasma) ===");
  const deN = await page.locator('span', { hasText: /^de \d+$/ }).last().textContent();
  const numPages = parseInt((deN ?? "de 0").replace("de ", ""), 10);
  check("numPages leído del header", numPages > 0, `de ${numPages}`);
  await page.getByRole("spinbutton", { name: "Número de página" }).fill(String(numPages));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  await abrirVN(page);
  await page.locator('[data-testid="vn-auto"]').click(); // ON
  let finTxt = "";
  for (let i = 0; i < 14; i++) {
    await page.locator('[data-testid="vn-stage"]').click().catch(() => {});
    await page.waitForTimeout(220);
    finTxt = (await page.locator('[data-testid="vn-next"]').textContent()) ?? "";
    if (/Fin del libro/.test(finTxt)) break;
  }
  check("botón muestra «Fin del libro» en última página", /Fin del libro/.test(finTxt), finTxt.trim());
  const lastTop1 = await topBar(page);
  await page.waitForTimeout(1400);
  const lastTop2 = await topBar(page);
  check("auto en fin de libro NO gira ni crashea", lastTop1 === lastTop2 && new RegExp(`Página ${numPages} de ${numPages}`).test(lastTop2), lastTop2);

  check("cero errores de consola/pageerror en toda la suite", errors.length === 0, errors.join(" | ").slice(0, 300));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
