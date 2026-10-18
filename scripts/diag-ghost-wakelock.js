/* Verificación efímera: recordatorio de teclas (fantasma) en teleprompter y
   lector en pantalla completa + presencia del centinela de wake lock. */
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  let pass = 0, fail = 0;
  const check = (name, ok, d = "") => { console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${d ? " — " + d : ""}`); ok ? pass++ : fail++; };
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.locator("article").first().waitFor({ timeout: 15000 });
  await page.locator("article").first().getByRole("button", { name: /Empezar a leer|Continuar/ }).click();
  await page.locator('[data-viewport="pdf"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);

  // --- A. lector en pantalla completa: la entrada dispara el fantasma ---
  await page.keyboard.press("m");
  await page.waitForTimeout(600);
  const fsGhost = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="reader-shortcut-ghost"]');
    return g ? { shown: g.getAttribute("data-shown"), rows: g.children.length } : null;
  });
  check("lector FC: fantasma presente al entrar", !!fsGhost && fsGhost.rows >= 6, JSON.stringify(fsGhost));
  // transición del chrome (tecla H) re-dispara… o no por el throttle de 8 s
  await page.keyboard.press("h");
  await page.waitForTimeout(400);
  const fsGhost2 = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="reader-shortcut-ghost"]');
    return g ? g.getAttribute("data-shown") : "ausente";
  });
  check("lector FC: fantasma sigue montado tras ocultar chrome", fsGhost2 !== "ausente", String(fsGhost2));
  // fuera de pantalla completa el fantasma NO existe
  await page.keyboard.press("m");
  await page.waitForTimeout(500);
  const fsGhost3 = await page.evaluate(() => document.querySelector('[data-testid="reader-shortcut-ghost"]'));
  check("lector sin FC: sin fantasma", fsGhost3 === null);
  // mostrar el chrome otra vez (la tecla H lo escondió: el mouse no despierta)
  await page.keyboard.press("h");
  await page.waitForTimeout(400);

  // --- B. teleprompter: ocultarse por quietud dispara el fantasma ---
  await page.locator('[data-testid="tp-toggle"]').click();
  await page.locator('[data-testid="tp-overlay"]').waitFor({ timeout: 8000 });
  // quietud total > 3.5 s: la UI se oculta y el fantasma aparece
  await page.waitForTimeout(4600);
  const tpGhost = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="tp-shortcut-ghost"]');
    const immersed = document.querySelector('[data-testid="tp-overlay"]')?.className.includes("tp-immersed");
    return { shown: g?.getAttribute("data-shown") ?? "ausente", immersed };
  });
  check("tp: quietud oculta la UI y despliega el fantasma", tpGhost.shown === "true" && tpGhost.immersed, JSON.stringify(tpGhost));
  await page.waitForTimeout(3200);
  const tpGhost2 = await page.evaluate(() => document.querySelector('[data-testid="tp-shortcut-ghost"]')?.getAttribute("data-shown"));
  check("tp: el fantasma se retira solo (~2.5 s)", tpGhost2 === "false", String(tpGhost2));
  // despertar muestra la UI de nuevo (transición → fantasma throttleado: no reaparece antes de 8 s)
  await page.mouse.move(640, 400);
  await page.waitForTimeout(400);
  const tpGhost3 = await page.evaluate(() => document.querySelector('[data-testid="tp-shortcut-ghost"]')?.getAttribute("data-shown"));
  check("tp: despertar no repite el fantasma (throttle 8 s)", tpGhost3 === "false", String(tpGhost3));

  // --- C. wake lock: sin soporte en headless, la lectura sigue sin errores ---
  const wl = await page.evaluate(() => ({ supported: "wakeLock" in navigator }));
  check("wake lock: sin soporte no rompe (cero errores de consola)", errors.length === 0, `soporte=${wl.supported ? "sí" : "no"} errores=${errors.length}`);

  await page.keyboard.press("Escape");
  await browser.close();
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
