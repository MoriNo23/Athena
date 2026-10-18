/* E2E de la CASA ATENA renovada: psicología azul (tema claro/oscuro con
 * next-themes), tipografía del modo teleprompter (A−/A+ y teclas −/=), presets
 * de modos ELIMINADOS (dock = ajustes de literatura) y neobrutalismo.
 * REGLA DE LA CASA: reset-all ANTES de tocar nada. 0 page errors exigido.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

async function startBookButton(page) {
  const cont = page.getByRole("button", { name: "Continuar" }).first();
  if (await cont.count()) return cont;
  return page.getByRole("button", { name: "Empezar a leer" }).first();
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

  // ---------------- TEMA: PSICOLOGÍA AZUL ----------------
  console.log("=== A. TEMA: OSCURO POR DEFECTO ===");
  const htmlDark1 = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  check("html nace oscuro (noche egea)", htmlDark1);
  const bgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // el navegador computa oklch→lab: comparamos luminosidad (L de lab) < 20 = noche
  const darkL = parseFloat(/^\s*(?:lab|oklab)\(\s*([\d.]+)/.exec(bgDark)?.[1] ?? "100");
  check("fondo oscuro pintado (L<20)", darkL < 20, `${bgDark} → L=${darkL}`);

  console.log("=== B. TOGGLE A CLARO (mañana de mármol) ===");
  await page.locator('[data-testid="theme-toggle"]').click();
  await page.waitForTimeout(400);
  const htmlLight = await page.evaluate(() => !document.documentElement.classList.contains("dark"));
  check("html pierde la clase dark", htmlLight);
  const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("fondo claro pintado", !/oklch\(0\.1\d/.test(bgLight), bgLight);
  const capa2 = await page.evaluate(() => {
    const f = document.querySelector(".atena-capa2__fachada");
    return f ? getComputedStyle(f).opacity : null;
  });
  check("capa 2 se apaga en claro (piedra pálida)", capa2 !== null && parseFloat(capa2) <= 0.08, String(capa2));

  console.log("=== C. PERSISTENCIA DEL TEMA ===");
  await page.reload({ waitUntil: "networkidle" });
  const htmlLight2 = await page.evaluate(() => !document.documentElement.classList.contains("dark"));
  check("claro sobrevive al reload", htmlLight2);
  await page.locator('[data-testid="theme-toggle"]').click();
  await page.waitForTimeout(400);
  check("vuelta a oscuro", await page.evaluate(() => document.documentElement.classList.contains("dark")));

  // ---------------- PRESETS FUERA, CASA LITERATURA ----------------
  console.log("=== D. DOCK = AJUSTES DE LITERATURA (SIN PRESETS) ===");
  await startBookButton(page).then((b) => b.click());
  await page.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1000);
  const noPresets = await page.locator('[data-testid="mode-presets"]').count();
  check("selector de presets ELIMINADO", noPresets === 0);
  const dockTitle = await page.locator('[data-testid="mode-dock"] h3').textContent().catch(() => "");
  check("dock se llama «Ajustes de lectura»", /Ajustes de lectura/.test(dockTitle ?? ""), dockTitle ?? "");
  const headerBtn = await page.locator('[data-testid="toggle-dock"]').textContent().catch(() => "");
  check("botón del header dice «Ajustes»", /Ajustes/.test(headerBtn ?? ""), headerBtn ?? "");
  // toggles de literatura presentes, técnicos ausentes
  await page.locator('[data-dock="modes"] button[aria-label*="Opciones"]').click();
  await page.waitForTimeout(400);
  const litKeys = ["xray", "naturalPauses", "argumentSkeleton", "lockedNotes", "dualRead", "outline", "dictionary"];
  let allLit = true;
  for (const k of litKeys) {
    if ((await page.locator(`[data-testid="mode-toggle-${k}"]`).count()) !== 1) allLit = false;
  }
  check("7 toggles de literatura/comunes en opciones", allLit);
  const tecKeys = ["threePass", "notation", "codeRunner", "resultsTable", "reproAudit"];
  let noTec = true;
  for (const k of tecKeys) {
    if ((await page.locator(`[data-testid="mode-toggle-${k}"]`).count()) !== 0) noTec = false;
  }
  check("toggles técnicos ELIMINADOS", noTec);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // ---------------- APARIENCIA EN AJUSTES ----------------
  console.log("=== E. APARIENCIA EN EL PANEL DE AJUSTES ===");
  await page.getByRole("button", { name: "Abrir ajustes del riel" }).click();
  await page.waitForTimeout(600);
  const sheetApariencia = await page.getByRole("heading", { name: "Apariencia" }).count();
  check("sección Apariencia en el sheet", sheetApariencia === 1);
  const sheetThemeToggle = await page.locator('[role="dialog"] [data-testid="theme-toggle"]').count();
  check("toggle de tema dentro del sheet", sheetThemeToggle === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // ---------------- TIPOGRAFÍA DEL MODO TELEPROMPTER ----------------
  console.log("=== F. MODO TELEPROMPTER: TAMAÑO DE LETRA ===");
  await page.locator('[data-testid="tp-toggle"]').click();
  await page.locator('[data-testid="tp-overlay"]').waitFor({ timeout: 8000 });
  const scale0 = await page.evaluate(() => document.querySelector('[data-testid="tp-overlay"]').style.getPropertyValue("--tp-font-scale"));
  check("fontScale default 1", scale0 === "1", scale0);

  const fs0 = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-testid="tp-card-box"]')).fontSize));
  await page.locator('[data-testid="tp-font-plus"]').click();
  await page.waitForTimeout(200);
  const fs1 = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="tp-card-box"]');
    return { scale: document.querySelector('[data-testid="tp-overlay"]').style.getPropertyValue("--tp-font-scale"), fs: parseFloat(getComputedStyle(box).fontSize) };
  });
  check("A+ sube a 1.1 y la letra crece", fs1.scale === "1.1" && fs1.fs > fs0, `${fs0}px → ${fs1.fs}px`);

  await page.keyboard.press("+");
  await page.waitForTimeout(200);
  const fs2 = await page.evaluate(() => document.querySelector('[data-testid="tp-overlay"]').style.getPropertyValue("--tp-font-scale"));
  check("tecla + sube a 1.2", fs2 === "1.2", fs2);

  await page.locator('[data-testid="tp-font-minus"]').click();
  await page.waitForTimeout(200);
  const fs3 = await page.evaluate(() => document.querySelector('[data-testid="tp-overlay"]').style.getPropertyValue("--tp-font-scale"));
  check("A− baja a 1.1", fs3 === "1.1", fs3);
  await page.keyboard.press("-");
  await page.waitForTimeout(200);
  const fs4 = await page.evaluate(() => document.querySelector('[data-testid="tp-overlay"]').style.getPropertyValue("--tp-font-scale"));
  check("tecla − baja a 1.0", parseFloat(fs4) === 1, fs4);

  console.log("=== G. TOPES Y ENVOLVENTE ===");
  const plusBtn = page.locator('[data-testid="tp-font-plus"]');
  for (let i = 0; i < 8 && !(await plusBtn.isDisabled()); i++) { await plusBtn.click(); await page.waitForTimeout(120); }
  const scaleTop = await page.evaluate(() => document.querySelector('[data-testid="tp-overlay"]').style.getPropertyValue("--tp-font-scale"));
  check("tope 1.6 con A+ deshabilitado", parseFloat(scaleTop) === 1.6 && (await plusBtn.isDisabled()), `${scaleTop} disabled=${await plusBtn.isDisabled()}`);
  // tarjeta larga: el texto debe ENVOLVER (lección de la línea infinita)
  await page.locator('[data-testid="tp-next"]').click();
  await page.waitForTimeout(400);
  const wrap = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="tp-card-box"]');
    const spans = box.querySelectorAll(".tp-ch");
    let lastY = null, lines = 0;
    for (const s of spans) { const r = s.getBoundingClientRect(); if (lastY === null || Math.abs(r.y - lastY) > 4) { lines++; lastY = r.y; } }
    return { nSpans: spans.length, lines, scrollW: box.scrollWidth, clientW: box.clientWidth, fits: box.scrollWidth <= box.clientWidth + 2 };
  });
  check("tarjeta larga envuelve en varias líneas (1.6×)", wrap.lines > 1 && wrap.fits, `lines=${wrap.lines} ${wrap.scrollW}/${wrap.clientW}`);
  const minusBtn = page.locator('[data-testid="tp-font-minus"]');
  for (let i = 0; i < 10 && !(await minusBtn.isDisabled()); i++) { await minusBtn.click(); await page.waitForTimeout(120); }
  const scaleBottom = await page.evaluate(() => document.querySelector('[data-testid="tp-overlay"]').style.getPropertyValue("--tp-font-scale"));
  check("suelo 0.8 con A− deshabilitado", parseFloat(scaleBottom) === 0.8 && (await minusBtn.isDisabled()), `${scaleBottom} disabled=${await minusBtn.isDisabled()}`);

  console.log("=== H. PERSISTE TRAS SALIR Y VOLVER ===");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.locator('[data-testid="tp-toggle"]').click();
  await page.locator('[data-testid="tp-overlay"]').waitFor({ timeout: 8000 });
  const scaleBack = await page.evaluate(() => document.querySelector('[data-testid="tp-overlay"]').style.getPropertyValue("--tp-font-scale"));
  check("fontScale 0.8 persiste al reabrir", parseFloat(scaleBack) === 0.8, scaleBack);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // ---------------- NEOBRUTALISMO ----------------
  console.log("=== I. NEOBRUTALISMO (esquinas rectas, tinta, sombra dura) ===");
  // el hero vive en la biblioteca: salimos del lector primero
  await page.getByRole("button", { name: "Volver a la biblioteca" }).click();
  await page.waitForTimeout(900);
  const brutal = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="theme-toggle"]'); // outline
    const hero = document.querySelector(".atena-hero");
    const s = btn ? getComputedStyle(btn) : null;
    const sh = hero ? getComputedStyle(hero) : null;
    return {
      btnRadius: s ? s.borderRadius : null,
      btnBorder: s ? s.borderTopWidth : null,
      heroRadius: sh ? sh.borderRadius : null,
      heroBorder: sh ? sh.borderTopWidth : null,
      heroShadow: sh ? sh.boxShadow : null,
    };
  });
  check("botones sin redondeo", brutal.btnRadius === "0px", String(brutal.btnRadius));
  check("botones con borde de tinta 2px", brutal.btnBorder === "2px", String(brutal.btnBorder));
  check("hero sin redondeo", brutal.heroRadius === "0px", String(brutal.heroRadius));
  check("hero con borde 2px", brutal.heroBorder === "2px", String(brutal.heroBorder));
  check("hero con sombra dura desplazada", /7px 7px/.test(brutal.heroShadow ?? ""), (brutal.heroShadow ?? "").slice(0, 40));

  check("cero page errors en toda la suite", errors.length === 0, errors.join(" | ").slice(0, 300));
  await page.screenshot({ path: `${__dirname}/atena-casa-final.png` });

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
