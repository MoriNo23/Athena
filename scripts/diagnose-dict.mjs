// Ver diccionario Page completo + warnings de pdf.js
import { getDocument, VerbosityLevel } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";

const raw = fs.readFileSync("/home/z/my-project/public/uploads/b4f502e072dc54fea.pdf");
const str = raw.toString("latin1");

// Diccionario de la primera página (ampliar ventana)
const idx = str.indexOf("/Type /Page");
// retroceder hasta el "N 0 obj" más cercano
const objStart = str.lastIndexOf(" obj", idx);
const objNumStart = str.lastIndexOf("\n", objStart - 6) + 1;
console.log("DICT PAGE 1:", str.slice(objNumStart, idx + 400).replace(/\n+/g, " ").slice(0, 700));

// ¿El objeto /Contents existe en el xref? Buscar "88 0 obj"
for (const n of [88, 99, 102]) {
  const re = new RegExp(`${n} 0 obj`);
  const i = str.search(re);
  console.log(`objeto ${n}: existe en offset`, i);
}

// pdf.js con máxima verbosidad
const data = new Uint8Array(raw);
const doc = await getDocument({
  data,
  verbosity: 5,
  // interceptar warnings
}).promise;

const page = await doc.getPage(1);
console.log("\npageInfo:", JSON.stringify(page._pageInfo?.rotate ?? "?"), page._pageInfo?.view);
const ops = await page.getOperatorList();
console.log("fnArray.length:", ops.fnArray.length);

// Intentar el render real con @napi-rs/canvas si existe
try {
  const { createCanvas } = await import("@napi-rs/canvas");
  const vp = page.getViewport({ scale: 0.5 });
  const canvas = createCanvas(Math.floor(vp.width), Math.floor(vp.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let nonWhite = 0;
  for (let i = 0; i < img.data.length; i += 40) {
    if (img.data[i] < 245 || img.data[i + 1] < 245 || img.data[i + 2] < 245) nonWhite++;
  }
  console.log("RENDER @0.5x:", canvas.width + "x" + canvas.height, "pixeles no-blancos (muestreo):", nonWhite);
  fs.writeFileSync("/home/z/my-project/scripts/p1-test.png", canvas.toBuffer("image/png"));
  console.log("PNG guardado en scripts/p1-test.png");
} catch (e) {
  console.log("render node no disponible:", e.message);
}
