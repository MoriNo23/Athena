/**
 * Sonda del MAPA DE TECLAS del teleprompter.
 *
 * Comprueba que cada flecha hace UNA cosa:
 *   → / ←          mueven el encendido una letra
 *   Shift+→        pasa a la página siguiente
 *   Shift+←        vuelve a la página anterior (encendida)
 *
 * Uso: node scripts/probe-flechas-tp.js
 */
const { chromium } = require("playwright");
const { BASE, asegurarLibro, abrirTeleprompter, estado } = require("./tp-fixture");

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
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

  // el flujo arranca con un título (se enciende entero): se espera a pasar esa
  // banda para medir el avance letra a letra
  await page.waitForFunction(
    () => document.querySelectorAll(".tp-ch.on").length > 20,
    undefined,
    { timeout: 30000 }
  );
  // pausa el flujo: las teclas manuales se miden sobre un estado quieto
  await page.keyboard.press(" ");
  await page.waitForTimeout(400);

  // --- → avanza UNA letra ---
  const antes = await estado(page);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  const despues = await estado(page);
  check(
    "→ enciende un solo carácter más",
    despues.encendidos === antes.encendidos + 1,
    `${antes.encendidos}→${despues.encendidos} encendidos`
  );
  check(
    "→ no cambia de página",
    despues.pagina === antes.pagina,
    `página ${antes.pagina}→${despues.pagina}`
  );

  // --- ← retrocede UNA letra ---
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(500);
  const rebobinado = await estado(page);
  check(
    "← apaga un solo carácter",
    rebobinado.encendidos === antes.encendidos,
    `${despues.encendidos}→${rebobinado.encendidos} encendidos`
  );

  // --- Shift+→ cambia de página ---
  await page.keyboard.press("Shift+ArrowRight");
  await page.waitForFunction(
    (prev) => {
      const s = document.querySelector('[data-testid="tp-stream"]');
      return !!s && s.getAttribute("data-page-start") !== prev && document.querySelectorAll(".tp-ch.on").length > 0;
    },
    antes.pagina,
    { timeout: 20000 }
  );
  const siguiente = await estado(page);
  check(
    "Shift+→ pasa a la página siguiente",
    siguiente.pagina !== antes.pagina,
    `página ${antes.pagina}→${siguiente.pagina}`
  );
  check(
    "la página nueva arranca en la banda de lectura",
    siguiente.primero >= siguiente.alto * 0.4 * 0.7,
    `primer carácter a ${siguiente.primero}px (banda ${(siguiente.alto * 0.4).toFixed(0)}px)`
  );

  // --- Shift+← vuelve a la página anterior ---
  await page.keyboard.press("Shift+ArrowLeft");
  await page.waitForFunction(
    (prev) => {
      const s = document.querySelector('[data-testid="tp-stream"]');
      return !!s && s.getAttribute("data-page-start") === prev;
    },
    antes.pagina,
    { timeout: 20000 }
  );
  const anterior = await estado(page);
  check(
    "Shift+← deshace el salto de página",
    anterior.pagina === antes.pagina && siguiente.pagina !== antes.pagina,
    `página ${siguiente.pagina}→${anterior.pagina}`
  );
  check(
    "la página anterior queda encendida para releerla",
    anterior.encendidos > 0,
    `${anterior.encendidos} encendidos`
  );

  check("cero errores de consola/pageerror", errors.length === 0, errors.slice(0, 2).join(" | "));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});
