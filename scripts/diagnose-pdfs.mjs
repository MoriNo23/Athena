// Diagnóstico de PDFs: fuentes no incrustadas, imágenes JPX, cmaps necesarios
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const uploadDir = fileURLToPath(new URL("../public/uploads", import.meta.url));
const files = fs.readdirSync(uploadDir).filter((f) => f.endsWith(".pdf"));

for (const f of files) {
  const data = new Uint8Array(fs.readFileSync(path.join(uploadDir, f)));
  try {
    const doc = await getDocument({
      data,
      useSystemFonts: false,
      // sin cMaps/standardFonts a propósito, como está ahora la app
    }).promise;

    console.log(`\n=== ${f} — ${doc.numPages} páginas ===`);

    // Analizar hasta 3 páginas
    for (let p = 1; p <= Math.min(3, doc.numPages); p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const ops = await page.getOperatorList();
      const fnNames = new Map();
      const FN = (await import("pdfjs-dist/legacy/build/pdf.mjs")).OPS;
      for (const op of ops.fnArray) {
        const name = FN[op];
        if (name) fnNames.set(name, (fnNames.get(name) ?? 0) + 1);
      }
      const ext = page.getOperatorList ? await page.commonObjsPromise?.then?.(() => {}) : null;
      // fuentes de la página
      const fontInfo = [];
      try {
        const objs = page.objs;
        // commonObjs contiene las fuentes globales
      } catch {}
      console.log(
        `  pág ${p}: ${Math.round(vp.width)}x${Math.round(vp.height)}pt, ops:`,
        [...fnNames.entries()].slice(0, 12).map(([k, v]) => `${k}:${v}`).join(", ")
      );

      const tc = await page.getTextContent();
      const textLen = tc.items.reduce((a, i) => a + (i.str?.trim().length ?? 0), 0);
      console.log(`          texto visible: ${textLen} chars | imágenes: ${fnNames.get("paintImageXObject") ?? 0 + (fnNames.get("paintJpxXObject") ?? 0)}`);
    }
  } catch (e) {
    console.log(`\n=== ${f} — ERROR: ${e.message} ===`);
  }
}
console.log("\nHecho.");
