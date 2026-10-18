#!/usr/bin/env node
/**
 * Captura CDP de una vista ya navegada: fija el viewport exacto (Emulation),
 * saca screenshot PNG y vuelca el outerHTML renderizado a disco.
 *
 * Uso: node scripts/cdp-capture.mjs <puerto> <ancho> <alto> <out.png> [out.html]
 * Requiere un chromium con --remote-debugging-port=<puerto> ya abierto y
 * navegado a la vista deseada (p. ej. con los escenarios REA).
 */
const port = Number(process.argv[2]);
const width = Number(process.argv[3]);
const height = Number(process.argv[4]);
const outPng = process.argv[5];
const outHtml = process.argv[6];

if (!port || !width || !height || !outPng) {
  console.error("uso: cdp-capture.mjs <puerto> <ancho> <alto> <out.png> [out.html]");
  process.exit(1);
}

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
    pending.set(id, (msg) => (msg.error ? reject(new Error(method + ": " + JSON.stringify(msg.error))) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: width < 500,
});
await sleep(400); // deja respirar al layout tras el override

// Despierta el chrome del lector (inmersión auto-oculta tras idle): un
// pointermove reset evita capturar la cabecera invisible.
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(width / 2), y: 40 });
await sleep(600);

if (outHtml) {
  const r = await send("Runtime.evaluate", { expression: "document.documentElement.outerHTML", returnByValue: true });
  const html = "<!DOCTYPE html>" + r.result.value;
  const fs = await import("node:fs");
  fs.writeFileSync(outHtml, html);
  console.log("html:", outHtml, html.length, "chars");
}

const shot = await send("Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync(outPng, Buffer.from(shot.data, "base64"));
console.log("png:", outPng, fs.statSync(outPng).size, "bytes");

ws.close();
process.exit(0);
