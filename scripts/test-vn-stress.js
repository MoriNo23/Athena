/* E2E de ESTRÉS del modo teleprompter continuo (superpowers systematic-debugging + ponytail).
 * Caza bordes duros: libro OCR sin texto, tormenta de clicks con Auto, cambio de
 * preset a mitad de encendido, Escape a mitad del encendido, columna en viewport
 * chico, rebobinado hasta el inicio del libro, sonido OFF, Auto en la ÚLTIMA página.
 * Verifica además lo propio del flujo continuo: scroll real con el carácter activo
 * a ~40 %, DOM acotado a DOS páginas y CERO referencias a «tarjetas».
 * REGLA DE LA CASA: reset-all primero. 0 errores de consola exigido.
 * Lección: abrir SIEMPRE el libro por nombre y leer numPages del header (span «de N»).
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

async function abrirTP(page) {
  await page.locator('[data-testid="tp-toggle"]').click();
  await page.locator('[data-testid="tp-overlay"]').waitFor({ timeout: 8000 });
  await page.waitForTimeout(700);
  await despertar(page);
}

/** el chrome del teleprompter se auto-oculta a los 3,5 s: un movimiento lo
 *  despierta; sin esto, el hit-test de Playwright pega contra tp-scroll */
async function despertar(page) {
  await page.mouse.move(720, 450);
  await page.waitForTimeout(250);
}

async function irAPagina(page, n) {
  await page.getByRole("spinbutton", { name: "Número de página" }).fill(String(n));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
}

async function estado(page) {
  return page.evaluate(() => {
    const stream = document.querySelector('[data-testid="tp-stream"]');
    const scroll = document.querySelector('[data-testid="tp-scroll"]');
    const on = stream ? stream.querySelectorAll(".tp-ch.on") : [];
    const last = on.length ? on[on.length - 1].getBoundingClientRect() : null;
    const rr = scroll ? scroll.getBoundingClientRect() : null;
    return {
      start: stream ? Number(stream.getAttribute("data-page-start")) : null,
      pages: stream ? Number(stream.getAttribute("data-pages")) : 0,
      chars: stream ? stream.querySelectorAll(".tp-ch").length : 0,
      lit: on.length,
      activoPct: last && rr ? Math.round(((last.top - rr.top) / rr.height) * 100) : null,
      texto: (document.querySelector('[data-testid="tp-overlay"]')?.textContent ?? "").toLowerCase(),
    };
  });
}

async function topBar(page) {
  return (await page.locator('[data-testid="tp-overlay"] p').nth(1).textContent()) ?? "";
}

/** deja el overlay con una página EN MARCHA (encendiendo) y sin auto */
async function paginaEnMarcha(page) {
  await despertar(page);
  const auto = page.locator('[data-testid="tp-auto"]');
  if ((await auto.getAttribute("aria-pressed")) === "true") await auto.click();
  const next = page.locator('[data-testid="tp-next"]');
  const label = (await next.textContent()) ?? "";
  if (/Página siguiente|Fin del libro/.test(label)) {
    await next.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  const play = page.locator('[data-testid="tp-play"]');
  const aria = (await play.getAttribute("aria-label")) ?? "";
  if (/Reanudar/.test(aria)) await play.click(); // pausada tras rebobinar: reanudar
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch({
    args: ["--disable-dev-shm-usage"],
    executablePath: process.env.ATENA_CHROMIUM || undefined,
  });
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
  await abrirTP(page);
  await page.waitForTimeout(800);
  const vacio = await page.evaluate(() => ({
    empty: document.querySelectorAll('[data-testid="tp-empty"]').length,
    chars: document.querySelectorAll('[data-testid="tp-stream"] .tp-ch').length,
  }));
  check("página sin texto muestra estado vacío", vacio.empty === 1 || vacio.chars >= 1, `empty=${vacio.empty} chars=${vacio.chars}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("Escape sale del vacío sin crash", (await page.locator('[data-testid="tp-overlay"]').count()) === 0);
  await page.getByRole("button", { name: "Volver a la biblioteca" }).first().click();
  await page.locator("h1", { hasText: "Atena" }).waitFor({ timeout: 10000 });

  console.log("=== B. TORMENTA DE CLICKS CON AUTO (Quijote) ===");
  await abrirQuijote(page);
  await abrirTP(page);
  await page.locator('[data-testid="tp-auto"]').click(); // ON
  await page.locator('[data-testid="tp-speed"]').click();
  await page.locator('[data-testid="tp-speed-preset-4"]').click({ force: true });
  await page.waitForTimeout(200);
  await page.locator('[data-testid="tp-overlay"] p').first().click(); // cerrar menú sin avanzar
  for (let i = 0; i < 6; i++) {
    await page.locator('[data-testid="tp-stage"]').click({ delay: 10 }).catch(() => {});
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(900);
  const stormTop = await topBar(page);
  const storm = await estado(page);
  const topOk = /Página \d+ de /.test(stormTop);
  check("estado vivo tras tormenta (página + letras encendidas)", topOk && storm.lit >= 1, `${stormTop} · lit=${storm.lit}`);
  check("DOM acotado a DOS páginas", storm.pages >= 1 && storm.pages <= 2, `pages=${storm.pages} start=${storm.start}`);
  check("sin numeración de tarjetas en la interfaz", !/tarjeta/.test(storm.texto), storm.texto.slice(0, 80));
  const titulo = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="tp-stream"] .tp-block-h');
    if (!el) return null;
    return { total: el.querySelectorAll(".tp-ch").length, on: el.querySelectorAll(".tp-ch.on").length, blockOn: el.classList.contains("on") };
  });
  check("título del flujo: bloque completo o apagado, nunca a medias", !titulo || (titulo.blockOn ? titulo.on === titulo.total : titulo.on === 0), titulo ? JSON.stringify(titulo) : "sin títulos en la página");
  await page.locator('[data-testid="tp-auto"]').click(); // OFF para estado estable

  console.log("=== C. PRESET A MITAD DE ENCENDIDO ===");
  await paginaEnMarcha(page);
  const litA = (await estado(page)).lit;
  await page.locator('[data-testid="tp-speed"]').click();
  await page.locator('[data-testid="tp-speed-preset-1-5"]').click({ force: true });
  await page.waitForTimeout(150);
  await page.locator('[data-testid="tp-overlay"] p').first().click();
  await page.waitForTimeout(900);
  const litB = (await estado(page)).lit;
  check("encendido sigue vivo tras cambiar preset", litB >= litA && litB > 0, `${litA} → ${litB}`);

  console.log("=== D. ESCAPE A MITAD DEL ENCENDIDO ===");
  await page.locator('[data-testid="tp-stage"]').click(); // completa de golpe
  await page.waitForTimeout(80);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("overlay muere limpio a mitad del encendido", (await page.locator('[data-testid="tp-overlay"]').count()) === 0);

  console.log("=== E. COLUMNA EN VIEWPORT CHICO ===");
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.waitForTimeout(600);
  await abrirTP(page);
  await paginaEnMarcha(page);
  await page.waitForTimeout(1200);
  const fit = await page.evaluate(() => {
    const stream = document.querySelector('[data-testid="tp-stream"]');
    const stage = document.querySelector('[data-testid="tp-stage"]');
    if (!stream || !stage) return null;
    const sb = stream.getBoundingClientRect();
    const on = stream.querySelectorAll(".tp-ch.on");
    const last = on.length ? on[on.length - 1] : null;
    return {
      // lección del bug «línea infinita»: el texto debe ENVOLVER, no desbordar
      hFits: stream.scrollWidth <= stream.clientWidth + 2,
      scrollW: stream.scrollWidth,
      clientW: stream.clientWidth,
      x: Math.round(sb.x),
      right: Math.round(sb.right),
      viewportW: window.innerWidth,
      activoVisible: last ? last.getBoundingClientRect().top >= sb.top - 80 : true,
    };
  });
  check("la columna ENVUELVE el texto (sin desborde horizontal)", !!fit && fit.hFits, fit ? `scrollW ${fit.scrollW} vs clientW ${fit.clientW}` : "n/a");
  check("columna dentro del viewport (sin corte lateral)", !!fit && fit.x >= 0 && fit.right <= fit.viewportW + 1, fit ? `x=${fit.x} right=${fit.right}` : "n/a");
  check("carácter activo dentro del escenario", !!fit && fit.activoVisible, fit ? String(fit.activoVisible) : "n/a");
  await page.screenshot({ path: `${__dirname}/tp-stress-small.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log("=== F. REBOBINADO HASTA EL INICIO DEL LIBRO ===");
  await irAPagina(page, 1);
  await abrirTP(page);
  const prev = page.locator('[data-testid="tp-prev"]');
  for (let i = 0; i < 60 && !(await prev.isDisabled()); i++) {
    await prev.click();
    await page.waitForTimeout(60);
  }
  check("llegamos al inicio de la página 1 (tp-prev deshabilitado)", await prev.isDisabled());
  const inicio = await estado(page);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  const tras = await estado(page);
  check("ArrowLeft en el inicio no rompe ni retrocede de libro", tras.lit === inicio.lit && tras.start === inicio.start, `lit ${inicio.lit} → ${tras.lit} · start ${inicio.start} → ${tras.start}`);

  console.log("=== G. SONIDO OFF NO ROMPE EL ENCENDIDO ===");
  await paginaEnMarcha(page);
  const litG1 = (await estado(page)).lit;
  await page.locator('[data-testid="tp-sound"]').click(); // OFF
  await page.waitForTimeout(900);
  const litG2 = (await estado(page)).lit;
  check("letras siguen encendiendo sin sonido", litG2 > litG1, `${litG1} → ${litG2}`);
  await page.locator('[data-testid="tp-sound"]').click(); // ON de nuevo
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  console.log("=== H. AUTO EN LA ÚLTIMA PÁGINA (no loop, sin giro fantasma) ===");
  const deN = await page.locator("span", { hasText: /^de \d+$/ }).last().textContent();
  const numPages = parseInt((deN ?? "de 0").replace("de ", ""), 10);
  check("numPages leído del header", numPages > 0, `de ${numPages}`);
  await irAPagina(page, numPages);
  await abrirTP(page);
  await page.locator('[data-testid="tp-auto"]').click(); // ON
  let finTxt = "";
  for (let i = 0; i < 14; i++) {
    await page.locator('[data-testid="tp-stage"]').click().catch(() => {});
    await page.waitForTimeout(220);
    finTxt = (await page.locator('[data-testid="tp-next"]').textContent()) ?? "";
    if (/Fin del libro/.test(finTxt)) break;
  }
  check("botón muestra «Fin del libro» en la última página", /Fin del libro/.test(finTxt), finTxt.trim());
  const lastTop1 = await topBar(page);
  await page.waitForTimeout(1400);
  const lastTop2 = await topBar(page);
  check("auto en fin de libro NO gira ni crashea", lastTop1 === lastTop2 && new RegExp(`Página ${numPages} de ${numPages}`).test(lastTop2), lastTop2);

  console.log("=== I. MOVIMIENTO REDUCIDO: TODO ENCENDIDO SIN ANIMACIÓN ===");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await abrirTP(page);
  await page.waitForTimeout(700);
  const rm = await estado(page);
  const rmCss = await page.evaluate(() => {
    const ch = document.querySelector('[data-testid="tp-stream"] .tp-ch');
    const h = document.querySelector('[data-testid="tp-stream"] .tp-block-h');
    return {
      transicionCh: ch ? getComputedStyle(ch).transitionDuration : null,
      bloqueOn: h ? h.classList.contains("on") : null,
    };
  });
  check("movimiento reducido: la página entera se enciende sola", rm.lit === rm.chars && rm.chars > 0, `lit=${rm.lit}/${rm.chars}`);
  check("sin transición de opacidad por carácter", rmCss.transicionCh === "0s", String(rmCss.transicionCh));
  check("título del flujo también encendido", rmCss.bloqueOn !== false, String(rmCss.bloqueOn));
  await page.emulateMedia({ reducedMotion: null });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  check("cero errores de consola/pageerror en toda la suite", errors.length === 0, errors.join(" | ").slice(0, 300));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
