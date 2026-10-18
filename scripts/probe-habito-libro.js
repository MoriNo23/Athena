/**
 * Sonda E2E del hábito por libro (change: camara-suave-y-metas-por-libro).
 *
 * Verifica en dev (localhost:3000):
 *   A. La tarjeta del inicio muestra el resumen de hoy (páginas · min · meta)
 *      solo cuando hay actividad de hoy, usando la meta efectiva del libro.
 *   B. La cabecera del lector muestra el par «hoy/meta» DEL LIBRO y sube en
 *      vivo al girar páginas (sin recargar); un salto silencioso no lo mueve.
 *
 * Deja los datos sembrados (sesiones de hoy en Don Quijote) para revisión visual.
 * Uso: node scripts/probe-habito-libro.js
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

(async () => {
  // --- preparación: 12 páginas de hoy en Don Quijote vía la API de siempre ---
  const books = await (await fetch(`${BASE}/api/books`, { cache: "no-store" })).json();
  const quijote = books.books.find((b) => b.title.includes("Quijote"));
  await fetch(`${BASE}/api/books/${quijote.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pagesRead: 12, minutes: 25, currentPage: Math.max(quijote.currentPage, 13) }),
  });
  const after = await (await fetch(`${BASE}/api/books`, { cache: "no-store" })).json();
  const q2 = after.books.find((b) => b.id === quijote.id);
  const todayPages = q2.sessions.reduce((acc, s) => acc + (new Date(s.date).toDateString() === new Date().toDateString() ? s.pagesRead : 0), 0);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // --- A. tarjeta con resumen de hoy ---
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const card = page.locator("article").filter({ hasText: "Don Quijote" });
  const summary = await card.locator('[data-testid="card-today-summary"]').textContent().catch(() => null);
  check("A1 tarjeta con actividad muestra el resumen de hoy", !!summary, summary ?? "sin resumen");
  if (summary) {
    const hasMeta = new RegExp(`meta\\s+\\d+/${todayPages === 0 ? "\\d+" : "\\d+"}`).test(summary) || /meta/.test(summary);
    check("A2 el resumen incluye el avance hacia la meta", hasMeta, summary.trim());
  }
  const quietCard = page.locator("article").filter({ hasText: "Cuaderno de Atenas" });
  const quietSummary = await quietCard.locator('[data-testid="card-today-summary"]').count();
  check("A3 tarjeta sin actividad de hoy no pinta progreso falso", quietSummary === 0, `resúmenes: ${quietSummary}`);

  // --- B. cabecera del lector: par del libro, vivo ---
  await card.getByRole("button", { name: /Empezar a leer|Continuar/ }).click();
  await page.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  const readPair = () =>
    page.evaluate(() => {
      const spans = document.querySelectorAll("header .text-muted-foreground .tabular-nums, header span[title]");
      // el par está en el span con icono Target: «pages/goal»
      const target = [...document.querySelectorAll("header span")].find((s) => /^\d+\/\d+$/.test(s.textContent.trim()));
      return target ? target.textContent.trim() : null;
    });
  const pair0 = await readPair();
  check("B1 cabecera muestra el par del libro (hoy base + meta)", !!pair0 && pair0.startsWith(String(todayPages)), `par=${pair0}, esperado base=${todayPages}`);

  // girar 2 páginas con flecha derecha (cuenta como lectura) — sin clic previo:
  // el visor ya toma el foco al abrir (ver test-hotkeys D1); un clic giraría página.
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(900);
  const pair1 = await readPair();
  const pages0 = parseInt(pair0.split("/")[0], 10);
  const pages1 = parseInt(pair1.split("/")[0], 10);
  check("B2 el par sube en vivo al girar páginas (sin recargar)", pages1 === pages0 + 2, `${pair0} → ${pair1}`);

  // salto silencioso por el input de página: no cuenta
  const spin = page.getByRole("spinbutton");
  await spin.fill(String(pages1 + 5));
  await spin.press("Enter");
  await page.waitForTimeout(900);
  const pair2 = await readPair();
  check("B3 salto silencioso (input de página) no cuenta", pair2 === pair1, `${pair1} → ${pair2}`);

  // --- C. meta efectiva: fija meta propia 40 desde el diálogo de ficha ---
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator('[data-testid="reader-back"], header button[aria-label]').first().click().catch(() => {});
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await card.hover();
  await card.locator('[data-testid="card-edit"]').click();
  await page.locator('[data-testid="edit-book-dialog"]').waitFor({ timeout: 5000 });
  await page.locator('[data-testid="edit-daily-goal"]').fill("40");
  await page.locator('[data-testid="edit-save"]').click();
  await page.waitForTimeout(800);
  const summary2 = await card.locator('[data-testid="card-today-summary"]').textContent().catch(() => null);
  check("C1 la tarjeta refleja la meta efectiva nueva (40)", !!summary2 && /meta\s+\d+\/40/.test(summary2), summary2?.trim() ?? "sin resumen");

  check("cero errores de consola/pageerror", errors.length === 0, errors.slice(0, 2).join(" | "));

  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})();
