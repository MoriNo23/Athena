/* Smoke e2e del teleprompter refactorizado (hooks use-teleprompter-window/player):
 * abre el EPUB de prueba, entra al modo continuo y ejercita el control de
 * reproducción extraído: pausa/reanudar (Espacio), avance (→), rebobinado (←),
 * pantalla completa (M), cruce de página (Siguiente) y salida (Escape).
 * 0 page errors exigido. Uso: node scripts/test-tp-refactor-smoke.mjs (dev en :3000)
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem("theme", "dark"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.locator('[aria-label="Abrir La Sombra del Riel"]').click();
await page.locator('[data-testid="epub-viewport"]').waitFor({ timeout: 20000 });
await page.mouse.move(90, 16);
await sleep(400);

await page.locator('[data-testid="tp-toggle"]').click();
await page.locator('[data-testid="tp-overlay"]').waitFor({ timeout: 8000 });
await sleep(800);
await page.mouse.move(640, 400);
await sleep(250);

// el flujo enciende letras (motor vivo en el hook)
await sleep(2500);
const lit = await page.evaluate(() => document.querySelectorAll('[data-testid="tp-stream"] .tp-ch.on').length);
check("el flujo enciende letras (motor del player)", lit > 20, `${lit} encendidas`);

// pausa con Espacio
await page.keyboard.press(" ");
await sleep(300);
const litPaused = await page.evaluate(() => document.querySelectorAll('[data-testid="tp-stream"] .tp-ch.on').length);
await sleep(1200);
const litStill = await page.evaluate(() => document.querySelectorAll('[data-testid="tp-stream"] .tp-ch.on').length);
check("Espacio pausa el encendido", litPaused === litStill, `${litPaused} → ${litStill}`);

// reanudar
await page.keyboard.press(" ");
await sleep(1200);
const litResumed = await page.evaluate(() => document.querySelectorAll('[data-testid="tp-stream"] .tp-ch.on').length);
check("Espacio reanuda el encendido", litResumed > litStill, `${litStill} → ${litResumed}`);

// avance: completa la página (→) y el botón pasa a «Página siguiente»
await page.mouse.move(640, 400); await sleep(200);
await page.keyboard.press("ArrowRight");
await sleep(500);
const nextLabel = (await page.locator('[data-testid="tp-next"]').textContent()) ?? "";
check("→ completa la página (ofrece cruzar)", /Página siguiente|Fin del libro/i.test(nextLabel), nextLabel.trim());

// cruce de página (slide del hook)
await page.locator('[data-testid="tp-next"]').click();
await sleep(1200);
const pageStart = await page.evaluate(() => Number(document.querySelector('[data-testid="tp-stream"]')?.getAttribute("data-page-start")));
check("Siguiente cruza a la página 2 (slide)", pageStart === 2, `ventana en ${pageStart}`);

// rebobinado (←): vuelve una letra atrás y pausa
await page.keyboard.press("ArrowLeft");
await sleep(600);
const playingAria = (await page.locator('[data-testid="tp-play"]').getAttribute("aria-label")) ?? "";
check("← rebobina y deja en pausa", /Reanudar/i.test(playingAria), playingAria);

// pantalla completa desde el chrome (botón con la pareja azul-sobre-tinte)
await page.mouse.move(640, 400); await sleep(250);
await page.locator('[data-testid="tp-fullscreen"]').click();
await sleep(600);
const isFs = await page.evaluate(() => !!document.fullscreenElement);
check("botón pantalla completa del chrome", isFs, "fullscreenElement");
await page.keyboard.press("Escape"); // en headless puede no salir: el M del overlay también
await sleep(300);

// salida limpia (Escape)
await page.keyboard.press("Escape");
await sleep(500);
const overlayGone = await page.locator('[data-testid="tp-overlay"]').count();
check("Escape sale del modo", overlayGone === 0, "overlay cerrado");
const backInReader = await page.locator('[data-testid="epub-viewport"]').count();
check("regresa al lector en la página del flujo", backInReader === 1, "");

check("0 errores de página/consola", errors.length === 0, errors.slice(0, 2).join(" | "));

console.log(`\nTP SMOKE: ${pass} pass · ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
