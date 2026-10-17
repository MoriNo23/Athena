/* Verifica la resolución de outline de pdfjs v6 (misma lógica que OutlinePanel) */
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { createRequire } from "module";

const require2 = createRequire(import.meta.url);
GlobalWorkerOptions.workerSrc = require2.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");

// 1) Crear PDF con outline usando reportlab
execSync(`python3 - <<'PY'
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
c = canvas.Canvas("/tmp/outline-test.pdf", pagesize=A4)
names = ["Introduccion", "Metodos", "Resultados preliminares", "Discusion completa"]
for i, name in enumerate(names, start=1):
    c.setFont("Helvetica", 14)
    c.drawString(100, 700, f"Seccion {i}: contenido de prueba")
    c.bookmarkPage(f"s{i}")
    c.addOutlineEntry(name, f"s{i}", level=0)
    if i == 4:
        c.bookmarkPage("s5")
        c.addOutlineEntry("Limitaciones", "s5", level=1)
    c.showPage()
c.save()
print("pdf ok")
PY`);

const data = new Uint8Array(readFileSync("/tmp/outline-test.pdf"));
const doc = await getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;

const raw = await doc.getOutline();
const resolvePage = async (dest) => {
  let explicit = null;
  if (typeof dest === "string") explicit = await doc.getDestination(dest);
  else if (Array.isArray(dest)) explicit = dest;
  if (!explicit || explicit.length === 0) return null;
  const ref = explicit[0];
  if (ref && typeof ref === "object") return (await doc.getPageIndex(ref)) + 1;
  if (typeof ref === "number") return ref + 1;
  return null;
};

const flat = [];
for (const item of raw) {
  flat.push({ title: item.title, page: await resolvePage(item.dest) });
  for (const child of item.items ?? []) {
    flat.push({ title: "  " + child.title, page: await resolvePage(child.dest) });
  }
}
console.log("outline resuelto:", JSON.stringify(flat));
process.exit(0);
