/**
 * Sonda del CRUCE DE PÁGINA en modo AUTO (teleprompter).
 *
 * Reproduce el defecto reportado: al encadenar sola la página siguiente, la
 * vista «brinca» y el texto queda peleándose con los márgenes. La causa: la
 * cámara sitúa el carácter activo al 40 % del alto, pero la columna no deja
 * espacio por encima del primer carácter → el objetivo es inalcanzable, el
 * navegador lo clampa y la columna rebota.
 *
 * Mide, durante el cruce: scrollTop (columna) y su dirección (vaivén), y la
 * posición en pantalla del carácter activo (banda de lectura = 40 % del alto).
 *
 * Uso: node scripts/probe-auto-cruce.js
 */
const { chromium } = require("playwright");
const { asegurarLibro, abrirTeleprompter, ponerVelocidad, ponerAuto } = require("./tp-fixture");

const BASE = "http://localhost:3000";
let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

/** muestrea scrollTop + posición del carácter activo hasta que cruce la página */
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
          const rr = root?.getBoundingClientRect();
          const lit = document.querySelectorAll(".tp-ch.on");
          const last = lit[lit.length - 1];
          out.push({
            t: Math.round(performance.now() - t0),
            y: root ? root.scrollTop : -1,
            lastTop: last && rr ? Math.round(last.getBoundingClientRect().top - rr.top) : -1,
            n: lit.length,
          });
          const nowPage = stream?.getAttribute("data-page-start");
          if (crossedAt < 0 && nowPage && nowPage !== startPage) {
            crossedAt = performance.now() - t0;
          }
          const done = crossedAt >= 0 && performance.now() - t0 - crossedAt > 1500;
          if (done || performance.now() - t0 > maxWait) {
            clearInterval(id);
            resolve({ samples: out, crossedAt: Math.round(crossedAt), vh: rr ? rr.height : 0 });
          }
        }, 8);
      }),
    { maxWait }
  );
}

(async () => {
  const browser = await chromium.launch({
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  try {
    await fetch(`${BASE}/api/progress/reset-all`, { method: "POST" });
  } catch {}

  await asegurarLibro();
  const opened = await abrirTeleprompter(page);
  check("teleprompter abierto sobre el libro de prueba", opened);
  if (!opened) {
    await browser.close();
    process.exit(1);
  }

  // letra grande (columna alta) + preset animado + Auto: el cruce ocurre solo
  await page.mouse.move(720, 450);
  await page.waitForTimeout(200);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("+");
    await page.waitForTimeout(60);
  }
  await ponerVelocidad(page, "4"); // Viva
  await ponerAuto(page, true);

  // el muestreo arranca con el flujo ya en marcha (evita leer el arranque de la
  // ventana como si fuera un cruce)
  await page.waitForFunction(
    () => document.querySelectorAll(".tp-ch.on").length > 5,
    undefined,
    { timeout: 30000 }
  );
  const s = await sampleCrossing(page, 120000);
  const vh = s.vh;
  const banda = vh * 0.4;

  check("el Auto encadenó la página siguiente", s.crossedAt >= 0, `cruce@${s.crossedAt}ms`);

  // 1) sin vaivén: en la ventana de asentamiento, la columna no cambia de
  //    dirección más de una vez con movimientos significativos
  const win = s.samples.filter((x) => x.t >= s.crossedAt - 60 && x.t <= s.crossedAt + 700);
  let reversals = 0;
  let dir = 0;
  let lastY = win.length ? win[0].y : 0;
  let maxDrop = 0;
  for (const x of win) {
    const d = x.y - lastY;
    if (d < 0) maxDrop = Math.max(maxDrop, -d);
    if (Math.abs(d) > 40) {
      const nd = Math.sign(d);
      if (dir !== 0 && nd !== dir) reversals++;
      dir = nd;
      lastY = x.y;
    }
  }
  const pre = s.samples.filter((x) => x.t <= s.crossedAt - 30).pop();
  const post = s.samples.find((x) => x.t >= s.crossedAt + 60);
  check(
    "el cruce no produce rebote (sin vaivén de la columna)",
    reversals <= 1,
    `inversiones=${reversals} caída máx=${maxDrop.toFixed(0)}px ${pre?.y}→${post?.y}`
  );

  // 2) el texto activo vuelve a la banda de lectura (no se queda en el margen)
  const tras = s.samples.filter((x) => x.t >= s.crossedAt + 250 && x.lastTop >= 0);
  const activos = tras.map((x) => x.lastTop);
  const minActivo = activos.length ? Math.min(...activos) : -1;
  const maxActivo = activos.length ? Math.max(...activos) : -1;
  check(
    "el texto activo vuelve a la banda de lectura (no se queda en el margen)",
    minActivo >= banda * 0.7,
    `activo entre ${minActivo}px y ${maxActivo}px (banda ${banda.toFixed(0)}px, alto ${vh}px)`
  );

  console.log("    [serie]", win.map((x) => `${x.t}:${x.y}/${x.lastTop}`).join(" "));

  check("cero errores de consola/pageerror", errors.length === 0, errors.slice(0, 2).join(" | "));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});
