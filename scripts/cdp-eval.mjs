#!/usr/bin/env node
/**
 * Evalúa una expresión JS en la página del chromium CDP y vuelca el resultado
 * como JSON. Útil para leer estado que no se ve en el DOM (p. ej. localStorage
 * o atributos calculados) sin abrir DevTools.
 *
 * Uso: node scripts/cdp-eval.mjs <puerto> <expresión | ruta.js>
 */
import fs from "node:fs";

const port = Number(process.argv[2]);
const arg = process.argv[3];
const width = Number(process.argv[4] ?? 0);
const height = Number(process.argv[5] ?? 0);

if (!port || !arg) {
  console.error("uso: cdp-eval.mjs <puerto> <expresión | ruta.js> [ancho alto]");
  process.exit(1);
}

const expression = fs.existsSync(arg) ? fs.readFileSync(arg, "utf8") : arg;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget() {
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page" && !t.url.startsWith("devtools"));
      if (page) return page;
    } catch {}
    await sleep(500);
  }
  throw new Error(`no hay target de página en el puerto ${port}`);
}

const ws = new WebSocket((await pageTarget()).webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (msg) =>
      msg.error ? reject(new Error(method + ": " + JSON.stringify(msg.error))) : resolve(msg.result),
    );
    ws.send(JSON.stringify({ id, method, params }));
  });
}

if (width && height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 500,
  });
  await sleep(400); // deja respirar al layout tras el override
}

const r = await send("Runtime.evaluate", {
  expression: `(async () => { try { return { ok: await (${expression}) } } catch (e) { return { error: String(e) } } })()`,
  returnByValue: true,
  awaitPromise: true,
});
if (r.exceptionDetails) {
  console.error("excepción:", JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails));
  process.exit(1);
}
console.log(JSON.stringify(r.result.value, null, 2));
ws.close();
process.exit(0);
