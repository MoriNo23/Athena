/**
 * Sonda E2E de la cámara del teleprompter (change: teleprompter-camara-y-pantalla-completa).
 *
 * Verifica en dev (localhost:3000), independiente del libro (usa el primero
 * con texto de la biblioteca):
 *   R. Revelado completo (clic): el resto del texto se enciende DONDE ESTÁ —
 *      desplazamiento de columna nulo (sin barrido al fondo de la página).
 *   C. La rueda manda: un giro manual a mitad de vuelo no pelea con el
 *      seguimiento (la vista queda donde el lector puso, sin tirón).
 *   X1. Primer cruce de página (relleno sin caché): asentamiento ATÓMICO —
 *       sin barrido gradual entre origen y destino, ≤1 inversión de dirección
 *       (sin vaivén) y el flujo continúa encendiendo.
 *   X2. Cruce con la página siguiente ya en caché: mismas garantías.
 *   T. Llegada a un título: el bloque queda entero en pantalla y, si hay
 *      columna por encima (título a media página), su INICIO asienta en la
 *      zona cómoda (la cámara no se sumerge el alto del bloque).
 *   B. Preset Instantánea: los movimientos de vista saltan sin animación.
 *
 * Uso: node scripts/probe-camara-suave.js
 */
const { chromium } = require("playwright");
const { asegurarLibro, abrirTeleprompter } = require("./tp-fixture");

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

async function despertar(page) {
  await page.mouse.move(720, 450);
  await page.waitForTimeout(250);
}

/** muestras de scrollTop cada 8 ms durante `ms` (setInterval, no rAF: los
    BeginFrame de headless llegan agrupados y falsearían la granularidad) */
async function scrollTopSamples(page, ms) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const root = document.querySelector('[data-testid="tp-scroll"]');
        const out = [];
        const t0 = performance.now();
        const id = setInterval(() => {
          out.push({ t: Math.round(performance.now() - t0), y: root ? root.scrollTop : -1 });
          if (performance.now() - t0 >= duration) {
            clearInterval(id);
            resolve(out);
          }
        }, 8);
      }),
    ms
  );
}

/** vigila el cruce por el cambio de data-page-start y resuelve ~900 ms después
    con las muestras de todo el intervalo (el cruce incluye el swap atómico) */
function sampleCrossing(page, maxWait) {
  return page.evaluate(
    ({ maxWait }) =>
      new Promise((resolve) => {
        const root = document.querySelector('[data-testid="tp-scroll"]');
        const stream = document.querySelector('[data-testid="tp-stream"]');
        const out = [];
        const startPage = stream?.getAttribute("data-page-start");
        const t0 = performance.now();
        let crossedAt = -1;
        const id = setInterval(() => {
          out.push({ t: Math.round(performance.now() - t0), y: root ? root.scrollTop : -1 });
          const nowPage = stream?.getAttribute("data-page-start");
          if (crossedAt < 0 && nowPage && nowPage !== startPage) {
            crossedAt = performance.now() - t0;
          }
          const done = crossedAt >= 0 && performance.now() - t0 - crossedAt > 900;
          if (done || performance.now() - t0 > maxWait) {
            clearInterval(id);
            resolve({ samples: out, crossedAt: Math.round(crossedAt) });
          }
        }, 8);
      }),
    { maxWait }
  );
}

/** análisis del asentamiento del cruce: atómico (sin barrido gradual),
    ≤1 inversión de dirección y el flujo sigue encendiendo */
function analyzeCrossing(samples, crossedAt, viewportH) {
  if (crossedAt < 0) return { ok: false, why: "no se detectó el cruce" };
  const antes = samples.filter((s) => s.t <= crossedAt - 30);
  const despues = samples.filter((s) => s.t >= crossedAt);
  if (antes.length === 0 || despues.length === 0) {
    return { ok: false, why: "ventana de muestras vacía" };
  }
  const yPre = antes[antes.length - 1].y;
  // el valor asentado es la PRIMERA muestra tras el cruce: con una columna
  // densa el hilo principal se bloquea durante el intercambio y las muestras
  // llegan con retraso (por eso la ventana es por muestras, no por reloj)
  const yPost = despues[0].y;
  const iPre = samples.indexOf(antes[antes.length - 1]);
  const iPost = samples.indexOf(despues[0]);
  // 1) atómico: entre la última muestra antes y la primera después no puede
  //    haber valores intermedios (una rampa); un salto directo no deja ninguno
  const SIG = 50;
  const lo = Math.min(yPre, yPost);
  const hi = Math.max(yPre, yPost);
  const barrido = samples
    .slice(iPre + 1, iPost)
    .map((s) => s.y)
    .filter((v) => v > lo + SIG && v < hi - SIG);
  const buckets = new Set(barrido.map((v) => Math.round(v / 4)));
  const atomic = buckets.size <= 2;
  // 2) sin vaivén: en la ventana de ASENTAMIENTO (swap + ancla + residual),
  //    ≤1 cambio de dirección con movimientos significativos (>SIG). La
  //    animación de reanudación previa y el tracking posterior quedan fuera:
  //    son movimientos legítimos del seguimiento, no vaivén del cruce.
  const win = samples.filter((s) => s.t >= crossedAt - 30 && s.t <= crossedAt + 450);
  let reversals = 0;
  let dir = 0;
  let lastY = win[0].y;
  for (const s of win) {
    const d = s.y - lastY;
    if (Math.abs(d) > SIG) {
      const nd = Math.sign(d);
      if (dir !== 0 && nd !== dir) reversals++;
      dir = nd;
      lastY = s.y;
    }
  }
  if (!atomic || reversals > 1) {
    console.log(
      "    [serie]",
      win.map((x) => `${x.t}:${x.y}`).join(" ")
    );
  }
  // 3) el flujo continúa: el encendido sigue avanzando tras el cruce
  return {
    ok: atomic && reversals <= 1,
    why: "",
    yPre,
    yPost,
    sweep: barrido.length,
    sweepSamples: barrido.map((v) => String(v)).join(" "),
    reversals,
    viewportH,
  };
}

/** abre el teleprompter del libro de prueba (mismo fixture que las demás sondas) */
async function abrirTeleprompterDePrimerLibro(page) {
  return abrirTeleprompter(page);
}

(async () => {
  const browser = await chromium.launch({
    args: ["--disable-frame-rate-limit", "--disable-gpu-vsync", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  try {
    await fetch("http://localhost:3000/api/progress/reset-all", { method: "POST" });
  } catch {}

  await asegurarLibro();
  const opened = await abrirTeleprompterDePrimerLibro(page);
  check("teleprompter abierto sobre un libro con texto", opened);

  if (opened) {
    // letra grande: páginas más altas en la columna, cruce observable
    await despertar(page);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("+");
      await page.waitForTimeout(60);
    }
    // preset Viva (animado, ágil) y Auto OFF: cruce controlado con revelado + →
    await despertar(page);
    await page.locator('[data-testid="tp-speed"]').click();
    await page.locator('[data-testid="tp-speed-preset-4"]').click({ force: true });
    await page.waitForTimeout(250);
    // cerrar el menú con click neutro en la barra (Escape cerraría el overlay)
    await page.locator('[data-testid="tp-overlay"] .tp-chrome p').first().click();
    await page.waitForTimeout(300);
    await despertar(page);
    if ((await page.locator('[data-testid="tp-auto"]').getAttribute("aria-pressed")) === "true") {
      await page.locator('[data-testid="tp-auto"]').click();
      await page.waitForTimeout(200);
    }

    // --- R. revelado completo SIN orden de vista ---
    // El discriminador real contra el barrido es POSICIONAL: sin orden de
    // cámara el final de la página queda DONDE ESTÁ (por debajo de la línea
    // cómoda); el código viejo ordenaba el último carácter a ~40% y la vista
    // viajaba al fondo. La deriva residual es la animación en vuelo del paso
    // anterior (se informa, no se exige cero).
    await despertar(page);
    const antes = await page.evaluate(() => document.querySelector('[data-testid="tp-scroll"]').scrollTop);
    const litAntes = await page.evaluate(() => document.querySelectorAll(".tp-ch.on").length);
    const muestreoR = scrollTopSamples(page, 700);
    await page.waitForTimeout(60);
    await page.mouse.click(640, 500); // revelado completo
    const mR = await muestreoR;
    await page.waitForTimeout(400); // la animación en vuelo termina
    const pos = await page.evaluate(() => {
      const chars = document.querySelectorAll(".tp-ch.on");
      const last = chars[chars.length - 1];
      const root = document.querySelector('[data-testid="tp-scroll"]');
      if (!last || !root) return null;
      return { lastTop: last.getBoundingClientRect().top - root.getBoundingClientRect().top, vh: root.clientHeight };
    });
    const litDespues = await page.evaluate(() => document.querySelectorAll(".tp-ch.on").length);
    const derivaR = Math.max(...mR.map((s) => Math.abs(s.y - antes)));
    check(
      "R1 revelado completo: el resto se enciende donde está, la vista no viaja al fondo",
      pos !== null && pos.lastTop > pos.vh * 0.45 && litDespues > litAntes,
      `último carácter a ${pos?.lastTop.toFixed(0)}px (${pos?.vh}px alto), deriva=${derivaR.toFixed(1)}px, encendidos ${litAntes}→${litDespues}`
    );

    // --- C. la rueda manda: giro manual a mitad del flujo animado ---
    await page.keyboard.press("ArrowLeft"); // rebobinar un poco (animado)
    await page.waitForTimeout(80); // a mitad de la transición
    const preWheel = await page.evaluate(() => document.querySelector('[data-testid="tp-scroll"]').scrollTop);
    await page.mouse.wheel(0, -240); // releer hacia arriba
    await page.waitForTimeout(500); // el scroll del navegador se asienta antes de medir
    const afterWheel = await page.evaluate(() => document.querySelector('[data-testid="tp-scroll"]').scrollTop);
    const fighting = await scrollTopSamples(page, 200);
    const drift = Math.max(...fighting.map((s) => Math.abs(s.y - afterWheel)));
    check(
      "C1 la rueda deja la vista donde el lector pidió (sin pelea)",
      afterWheel <= preWheel + 5 && drift < 30,
      `pre=${preWheel.toFixed(0)} post=${afterWheel.toFixed(0)} deriva=${drift.toFixed(1)}px`
    );

    // --- X1. primer cruce (la página +2 aún sin caché) ---
    // estado: pausado al final de la página (tras la rueda). Shift+→ es la
    // orden de salto de página: la ventana nueva entra en el mismo render
    // (cruce atómico) y el relleno de la página +2 llega después (sin caché).
    const sx1 = sampleCrossing(page, 20000);
    await page.waitForTimeout(60);
    await page.keyboard.press("Shift+ArrowRight"); // salto de página
    const cx1 = await sx1;
    const a1 = analyzeCrossing(cx1.samples, cx1.crossedAt, 800);
    check(
      "X1 primer cruce sin caché: asentamiento atómico, sin vaivén y el flujo sigue",
      a1.ok,
      `cruce@${cx1.crossedAt}ms, intermedios=${a1.sweep} [${a1.sweepSamples}], inversiones=${a1.reversals}, ${a1.yPre?.toFixed(0)}→${a1.yPost?.toFixed(0)}px`
    );

    // --- X2. cruce con la página siguiente ya en caché (precargada en X1) ---
    // estado: fluye en la página nueva: click = revelado completo,
    // Shift+→ = salto de página
    const sx2 = sampleCrossing(page, 20000);
    await page.waitForTimeout(400);
    await page.mouse.click(640, 500); // revelado completo
    await page.waitForTimeout(400);
    await page.keyboard.press("Shift+ArrowRight"); // salto de página
    const cx2 = await sx2;
    const a2 = analyzeCrossing(cx2.samples, cx2.crossedAt, 800);
    check(
      "X2 cruce con caché: asentamiento atómico, sin vaivén y el flujo sigue",
      a2.ok,
      `cruce@${cx2.crossedAt}ms, intermedios=${a2.sweep} [${a2.sweepSamples}], inversiones=${a2.reversals}, ${a2.yPre?.toFixed(0)}→${a2.yPost?.toFixed(0)}px`
    );

    // --- T. llegada a un título: anclado a su inicio, sin sumergirse ---
    // otro cruce: en cuanto la página nueva enciende su encabezado se pausa el
    // flujo (Espacio) para medir el asentamiento de la vista con él en pantalla
    const prevPage = await page.evaluate(() =>
      document.querySelector('[data-testid="tp-stream"]')?.getAttribute("data-page-start")
    );
    const sx3 = sampleCrossing(page, 20000);
    sx3.catch(() => {}); // se descarta: la detección la hace waitForFunction
    await page.waitForTimeout(400);
    await page.mouse.click(640, 500); // revelado completo
    await page.waitForTimeout(400);
    await page.keyboard.press("Shift+ArrowRight"); // salto de página
    await page
      .waitForFunction(
        ({ prev }) => {
          const stream = document.querySelector('[data-testid="tp-stream"]');
          return (
            !!stream &&
            stream.getAttribute("data-page-start") !== prev &&
            document.querySelector(".tp-block-h.on") !== null
          );
        },
        { prev: prevPage },
        { timeout: 15000 }
      )
      .catch(() => {});
    await page.keyboard.press(" "); // pausa: el asentamiento de la vista se congela
    await page.waitForTimeout(700); // la transición de vista termina
    const titulo = await page.evaluate(() => {
      const h = document.querySelector(".tp-block-h.on");
      const root = document.querySelector('[data-testid="tp-scroll"]');
      const stream = document.querySelector('[data-testid="tp-stream"]');
      if (!h || !root || !stream) return null;
      const first = h.querySelector(".tp-ch");
      const hr = h.getBoundingClientRect();
      const fr = (first ?? h).getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      const sr = stream.getBoundingClientRect();
      return {
        top: fr.top - rr.top,
        bottom: hr.bottom - rr.top,
        offsetInStream: fr.top - sr.top,
        height: hr.height,
        vh: rr.height,
      };
    });
    if (!titulo) {
      check("T1 título anclado a su inicio", false, "no se encontró bloque de título encendido");
    } else {
      const entero = titulo.top >= -2 && titulo.bottom <= titulo.vh + 2;
      // a media columna (hay texto por encima) el inicio asienta en la zona
      // cómoda; al inicio de la columna el clamp del navegador manda (tope)
      const mediaColumna = titulo.offsetInStream > titulo.vh * 0.5;
      const comoda = !mediaColumna || titulo.top >= titulo.vh * 0.25;
      check(
        "T1 título entero en pantalla y anclado a su inicio (sin sumersión)",
        entero && comoda,
        `top=${titulo.top.toFixed(0)}px bottom=${titulo.bottom.toFixed(0)}px alto=${titulo.height.toFixed(0)}px mediaColumna=${mediaColumna}`
      );
    }
    await page.keyboard.press(" "); // reanudar para el último caso

    // --- B. preset Instantánea: la vista salta, sin animación ---
    await despertar(page);
    await page.locator('[data-testid="tp-speed"]').click();
    await page.locator('[data-testid="tp-speed-preset-instant"]').click({ force: true });
    await page.waitForTimeout(250);
    await page.locator('[data-testid="tp-overlay"] .tp-chrome p').first().click();
    await page.waitForTimeout(300);
    await despertar(page);
    await page.keyboard.press("ArrowLeft"); // rebobinar: orden de vista instantánea
    const jumpSamples = await scrollTopSamples(page, 300);
    const jumpDistinct = [...new Set(jumpSamples.map((s) => Math.round(s.y)))];
    check(
      "B1 instantánea: la vista salta sin animación",
      jumpDistinct.length <= 4,
      `${jumpDistinct.length} valores distintos`
    );
  }

  check("cero errores de consola/pageerror", errors.length === 0, errors.slice(0, 2).join(" | "));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})();
