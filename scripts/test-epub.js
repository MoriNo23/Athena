/* E2E de SOPORTE EPUB: subida con probe (título/autor/portada de la metadata),
 * lectura en páginas virtuales (navegación, tipografía A−/A+), modo novela,
 * diccionario por selección, índice de capítulos, peek textual y persistencia
 * de progreso. REGLA DE LA CASA: reset-all ANTES de tocar nada. 0 page errors.
 */
const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://localhost:3000";
const EPUB = path.join(__dirname, "test-epub-libro.epub");
let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  try { await fetch(`${BASE}/api/progress/reset-all`, { method: "POST" }); } catch {}
  // corridas previas dejan el EPUB de prueba en la biblioteca: se borra para
  // que el anti-duplicado (409) no ensucie la consola de esta corrida
  try {
    const list = await (await fetch(`${BASE}/api/books`)).json();
    for (const b of list.books.filter((x) => x.title === "La Sombra del Riel")) {
      await fetch(`${BASE}/api/books/${b.id}`, { method: "DELETE" });
    }
  } catch {}
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: "networkidle" });

  // ---------------- A. SUBIDA: probe de EPUB ----------------
  console.log("=== A. SUBIDA: probe del EPUB (metadata + portada) ===");
  await page.setInputFiles('input[type="file"]', EPUB);
  await page.waitForTimeout(1200); // probe: JSZip + OPF + paginación + cover canvas
  await page.locator("#book-title").waitFor({ timeout: 15000 });
  const titleInput = page.locator("#book-title");
  const authorInput = page.locator("#book-author");
  check("título prellenado desde dc:title", (await titleInput.inputValue()) === "La Sombra del Riel", await titleInput.inputValue());
  check("autor prellenado desde dc:creator", (await authorInput.inputValue()) === "Athena Veridis", await authorInput.inputValue());
  await page.screenshot({ path: "scripts/epub-01-dialogo.png" });
  await page.getByRole("button", { name: "Añadir al riel" }).click();
  await page.waitForTimeout(1500); // subida + refetch de biblioteca

  const card = page.locator('[data-testid^="card-"], .brutal').filter({ hasText: "La Sombra del Riel" }).first();
  check("tarjeta del libro EPUB en la biblioteca", await card.count() > 0);
  const coverImg = card.locator("img");
  const coverSrc = (await coverImg.count()) > 0 ? await coverImg.first().getAttribute("src") : null;
  check("portada extraída del EPUB guardada", !!coverSrc && /cover/.test(coverSrc), String(coverSrc));
  await page.screenshot({ path: "scripts/epub-02-biblioteca.png" });

  // ---------------- B. LECTOR: página virtual ----------------
  console.log("=== B. LECTOR: páginas virtuales ===");
  // abre EL libro EPUB (la biblioteca puede tener más libros seed)
  await page.locator('[aria-label="Abrir La Sombra del Riel"]').click();
  await page.locator('[data-testid="epub-viewport"]').waitFor({ timeout: 20000 });
  await page.locator('[data-testid="epub-page"] .epub-p').first().waitFor({ timeout: 15000 });
  const numPages = await page.evaluate(() => parseInt(document.querySelector('[aria-label="Número de página"]').parentElement.textContent.match(/de\s+(\d+)/)?.[1] ?? "0", 10));
  check("total de páginas virtuales razonable (6-10)", numPages >= 6 && numPages <= 10, `de ${numPages}`);
  const pCount = await page.locator('[data-testid="epub-page"] .epub-p, [data-testid="epub-page"] .epub-h').count();
  check("la página 1 trae bloques de texto", pCount >= 3, `${pCount} bloques`);
  const h1Text = await page.locator('[data-testid="epub-page"] .epub-h1').first().textContent().catch(() => "");
  check("el h1 del capítulo abre el libro", h1Text.includes("Capítulo I"), h1Text.slice(0, 40));
  const dataPage1 = await page.locator('[data-testid="epub-page"]').getAttribute("data-page");
  check("data-page arranca en 1", dataPage1 === "1");

  // estilo tipográfico: serif Fraunces + escala de fuente
  const font = await page.evaluate(() => getComputedStyle(document.querySelector(".epub-page")).fontFamily);
  check("tipografía serif del lector", /fraunces|serif/i.test(font), font.slice(0, 40));

  // ---------------- C. NAVEGACIÓN ----------------
  console.log("=== C. NAVEGACIÓN (teclado y botones) ===");
  await page.locator('[data-testid="epub-viewport"]').click();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  const dataPage2 = await page.locator('[data-testid="epub-page"]').getAttribute("data-page");
  check("ArrowRight gira a página 2", dataPage2 === "2", dataPage2);
  const scrollTop = await page.evaluate(() => document.querySelector('[data-viewport="pdf"]').scrollTop);
  check("la página nueva arranca arriba", scrollTop < 8, String(scrollTop));
  await page.getByRole("button", { name: "Página anterior" }).click();
  await page.waitForTimeout(400);
  check("botón vuelve a página 1", (await page.locator('[data-testid="epub-page"]').getAttribute("data-page")) === "1");

  // ---------------- D. TIPOGRAFÍA A−/A+ ----------------
  console.log("=== D. TIPOGRAFÍA (A−/A+) ===");
  await page.locator('[data-testid="epub-font-plus"]').click();
  await page.waitForTimeout(200);
  let scaleLabel = await page.locator('[data-testid="epub-font-scale"]').textContent();
  check("A+ sube a 110%", scaleLabel.trim() === "110%", scaleLabel);
  const fs110 = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".epub-p")).fontSize));
  await page.locator('[data-testid="epub-font-minus"]').click();
  await page.waitForTimeout(200);
  const fs100 = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".epub-p")).fontSize));
  check("A− devuelve a 100% y la letra encoge", (await page.locator('[data-testid="epub-font-scale"]').textContent()).trim() === "100%" && fs110 > fs100, `${fs110}→${fs100}`);
  await page.keyboard.press("+");
  await page.waitForTimeout(200);
  check("tecla + también sube la letra", (await page.locator('[data-testid="epub-font-scale"]').textContent()).trim() === "110%");
  await page.keyboard.press("-");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "scripts/epub-03-lector.png" });

  // ---------------- E. MODO NOVELA ----------------
  console.log("=== E. MODO NOVELA VISUAL (texto del EPUB) ===");
  await page.locator('[data-testid="vn-toggle"]').click();
  await page.locator('[data-testid="vn-overlay"]').waitFor({ timeout: 10000 });
  await page.locator('[data-testid="vn-card-box"]').waitFor({ timeout: 10000 });
  await page.waitForTimeout(800); // encendido letra a letra
  const cardText = await page.locator('[data-testid="vn-card-box"]').textContent();
  check("la tarjeta VN trae texto del capítulo", cardText.length > 20, `${cardText.length} chars`);
  check("VN muestra el libro correcto", (await page.locator('[data-testid="vn-overlay"] p').first().textContent()).includes("La Sombra del Riel"));
  await page.screenshot({ path: "scripts/epub-04-novela.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("Escape cierra el modo novela", (await page.locator('[data-testid="vn-overlay"]').count()) === 0);

  // ---------------- F. DICCIONARIO POR SELECCIÓN ----------------
  console.log("=== F. DICCIONARIO (selección en .epubLayer) ===");
  const firstP = page.locator('[data-testid="epub-page"] .epub-p').first();
  const pBox = await firstP.boundingBox();
  if (pBox) {
    await page.mouse.move(pBox.x + 12, pBox.y + 3);
    await page.mouse.down();
    await page.mouse.move(pBox.x + 46, pBox.y + 3, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(700);
  }
  const dictVisible = await page.locator(".dict-pop").count();
  check("la selección abre la tarjeta de diccionario", dictVisible > 0);
  if (dictVisible > 0) {
    const word = await page.locator(".dict-pop h4").textContent().catch(() => "");
    check("la tarjeta muestra la palabra seleccionada", word.trim().length > 0, word);
    await page.screenshot({ path: "scripts/epub-05-diccionario.png" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // ---------------- G. ÍNDICE DE CAPÍTULOS ----------------
  console.log("=== G. ÍNDICE (outline de capítulos) ===");
  // el dock abre por defecto en contextos nuevos; si ya está abierto, no togglear
  if ((await page.locator('[data-testid="mode-dock"]').count()) === 0) {
    await page.locator('[data-testid="toggle-dock"]').click();
  }
  await page.locator('[data-testid="mode-dock"]').waitFor({ timeout: 5000 });
  await page.getByRole("tab", { name: "Esquema" }).click().catch(() => {});
  await page.locator('[data-testid="outline-list"]').waitFor({ timeout: 5000 });
  const outlineBtns = page.locator('[data-testid^="epub-outline-"]');
  check("el índice lista los 3 capítulos", (await outlineBtns.count()) === 3, `${await outlineBtns.count()} items`);
  const ch3 = outlineBtns.last();
  const ch3Text = await ch3.textContent();
  check("el capítulo 3 se titula por su primer h2 (El pacto)", ch3Text.includes("El pacto"), ch3Text.trim().slice(0, 40));
  await ch3.click();
  await page.waitForTimeout(600);
  const afterJump = await page.locator('[data-testid="epub-page"]').getAttribute("data-page");
  const expectedPage = await ch3.getAttribute("data-testid");
  check("el salto al capítulo III aterriza en su página", afterJump === expectedPage?.replace("epub-outline-", ""), `página ${afterJump}`);
  check("el capítulo III contiene el pacto (split de bloque gigante)", (await page.locator('[data-testid="epub-page"]').textContent()).includes("pacto"));
  await page.screenshot({ path: "scripts/epub-06-indice.png" });

  // ---------------- H. PEEK TEXTUAL ----------------
  console.log("=== H. PEEK (carrusel con extractos de texto) ===");
  const hot = await page.locator('[data-testid="peek-hotzone"]').boundingBox();
  if (hot) {
    await page.mouse.move(hot.x + hot.width / 2, hot.y + hot.height / 2);
    await page.mouse.down();
    await page.mouse.move(hot.x + hot.width / 2, hot.y - 130, { steps: 8 });
    await page.waitForTimeout(500);
  }
  const peekOpen = await page.locator('[data-testid="peek-overlay"]').count();
  check("el carrusel peek se abre con el gesto", peekOpen > 0);
  if (peekOpen > 0) {
    const textCards = await page.locator(".epub-peek-card").count();
    check("las miniaturas son extractos de texto (no shimmer)", textCards >= 3, `${textCards} tarjetas`);
    await page.screenshot({ path: "scripts/epub-07-peek.png" });
    await page.keyboard.press("Escape");
    await page.mouse.up(); // gesto real: tras cerrar, el botón se suelta (la captura muere con el fix del hook)
    await page.waitForTimeout(300);
  }

  // ---------------- I. PERSISTENCIA DE PROGRESO ----------------
  console.log("=== I. PERSISTENCIA (riel y progreso) ===");
  await page.evaluate(() => document.querySelector('[data-viewport="pdf"]')?.focus());
  for (let i = 0; i < 2; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(350); }
  const finalPage = await page.locator('[data-testid="epub-page"]').getAttribute("data-page");
  await page.waitForTimeout(3000); // guardado debounced
  await page.getByRole("button", { name: "Volver a la biblioteca" }).click();
  await page.waitForTimeout(900);
  await page.locator('[aria-label="Abrir La Sombra del Riel"]').click();
  await page.locator('[data-testid="epub-page"]').waitFor({ timeout: 15000 });
  const restoredPage = await page.locator('[data-testid="epub-page"]').getAttribute("data-page");
  check("el progreso de página sobrevive al ida y vuelta", restoredPage === finalPage, `${restoredPage} vs ${finalPage}`);
  await page.screenshot({ path: "scripts/epub-08-restaurado.png" });

  // ---------------- L. SALUD ----------------
  console.log("=== L. SALUD DE PÁGINA ===");
  const realErrors = errors.filter((e) => !/favicon|Download the React DevTools/i.test(e));
  check("0 errores de página", realErrors.length === 0, realErrors.slice(0, 3).join(" | ") || "limpio");

  await browser.close();

  // buena ciudadanía: el libro de prueba no debe quedarse como «más reciente»
  // en la biblioteca y desordenar las suites de la casa que siguen
  try {
    const list = await (await fetch(`${BASE}/api/books`)).json();
    for (const b of list.books.filter((x) => x.title === "La Sombra del Riel")) {
      await fetch(`${BASE}/api/books/${b.id}`, { method: "DELETE" });
    }
  } catch {}

  console.log(`\nRESULTADO: ${fail === 0 ? `TODO VERDE (${pass})` : `FALLOS: ${fail} de ${pass + fail}`}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error("E2E reventó:", e);
  process.exit(1);
});
