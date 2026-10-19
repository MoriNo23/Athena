/**
 * Libro de prueba para las sondas del teleprompter.
 *
 * Las sondas de cámara necesitan páginas con texto denso: con los libros de
 * la biblioteca del usuario la columna no llega a scrollear y los casos de
 * cruce y de banda de lectura no se pueden observar. Este fixture genera un
 * PDF con capa de texto (scripts/make-big-pdf.py), lo sube por la API y abre
 * su teleprompter. Es idempotente: si el libro ya está, lo reutiliza.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BASE = "http://localhost:3000";
/** título del fixture: sirve para encontrarlo en la biblioteca */
const TITULO = "Atensayo (fixture de sondas)";
/** páginas del PDF de prueba */
const PAGINAS = 4;
/** líneas de cuerpo por página: cortas para que el teleprompter cruce rápido */
const LINEAS = 6;
const PDF = path.join(os.tmpdir(), "atena-libro-sonda.pdf");

/** genera (o reutiliza) el PDF de prueba */
function generarPdf() {
  execFileSync(
    "python3",
    [path.join(__dirname, "make-big-pdf.py"), String(PAGINAS), "--nopad", "--lines", String(LINEAS), "--out", PDF],
    { stdio: "pipe" }
  );
  return PDF;
}

/** asegura que el fixture esté en la biblioteca; devuelve el libro */
async function asegurarLibro() {
  const res = await fetch(`${BASE}/api/books`);
  const { books } = await res.json();
  const existente = books.find((b) => b.title === TITULO);
  if (existente) return existente;
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(generarPdf())], { type: "application/pdf" }), "atena-libro-sonda.pdf");
  fd.append("title", TITULO);
  fd.append("author", "Atena");
  fd.append("totalPages", String(PAGINAS));
  const r = await fetch(`${BASE}/api/books`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`No se pudo subir el fixture: ${r.status}`);
  return (await r.json()).book;
}

/** abre el teleprompter del fixture; true si se abrió con texto */
async function abrirTeleprompter(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  const card = page.locator("article").filter({ hasText: TITULO }).first();
  await card.waitFor({ timeout: 20000 });
  await card.getByRole("button", { name: /Empezar a leer|Continuar|Volver a leer/ }).click();
  await page.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.mouse.move(720, 450);
  await page.waitForTimeout(200);
  await page.locator('[data-testid="tp-toggle"]').click();
  await page.locator('[data-testid="tp-overlay"]').waitFor({ timeout: 8000 });
  await page.waitForTimeout(900);
  return (await page.locator('[data-testid="tp-empty"]').count()) === 0;
}

/** elige el preset de velocidad indicado por su id ("4" = Viva) */
async function ponerVelocidad(page, id) {
  await page.locator('[data-testid="tp-speed"]').click();
  await page.locator(`[data-testid="tp-speed-preset-${id}"]`).click({ force: true });
  await page.waitForTimeout(250);
  // cerrar el menú con un click neutro en la barra (Escape cerraría el overlay)
  await page.locator('[data-testid="tp-overlay"] .tp-chrome p').first().click();
  await page.waitForTimeout(300);
}

/** enciende o apaga el modo Auto */
async function ponerAuto(page, on) {
  const btn = page.locator('[data-testid="tp-auto"]');
  if ((await btn.getAttribute("aria-pressed")) === (on ? "true" : "false")) return;
  await btn.click();
  await page.waitForTimeout(250);
}

/** estado del flujo: página, encendidos, scroll y posición del carácter activo */
async function estado(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="tp-scroll"]');
    const rr = root?.getBoundingClientRect();
    const lit = document.querySelectorAll(".tp-ch.on");
    const last = lit[lit.length - 1];
    const first = lit[0];
    return {
      pagina: document.querySelector('[data-testid="tp-stream"]')?.getAttribute("data-page-start") ?? null,
      encendidos: lit.length,
      scroll: root ? Math.round(root.scrollTop) : -1,
      alto: rr ? Math.round(rr.height) : 0,
      activo: last && rr ? Math.round(last.getBoundingClientRect().top - rr.top) : -1,
      primero: first && rr ? Math.round(first.getBoundingClientRect().top - rr.top) : -1,
    };
  });
}

module.exports = { BASE, TITULO, asegurarLibro, abrirTeleprompter, ponerVelocidad, ponerAuto, estado };
