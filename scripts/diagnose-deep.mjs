// Diagnóstico profundo del PDF problemático
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";

const raw = fs.readFileSync("/home/z/my-project/public/uploads/b4f502e072dc54fea.pdf");
const str = raw.toString("latin1");

// Filtros y recursos en el PDF crudo
const counts = {
  "/DCTDecode": (str.match(/\/DCTDecode/g) || []).length,
  "/JPXDecode": (str.match(/\/JPXDecode/g) || []).length,
  "/CCITTFaxDecode": (str.match(/\/CCITTFaxDecode/g) || []).length,
  "/FlateDecode": (str.match(/\/FlateDecode/g) || []).length,
  "/Type3": (str.match(/\/Type3/g) || []).length,
  "/Type0": (str.match(/\/Type0/g) || []).length,
  "/TrueType": (str.match(/\/TrueType/g) || []).length,
  "/Type1": (str.match(/\/Type1[^C]/g) || []).length,
  "/FontFile": (str.match(/\/FontFile/g) || []).length,
  "/ToUnicode": (str.match(/\/ToUnicode/g) || []).length,
  "/Subtype/Image": (str.match(/\/Subtype\s*\/Image/g) || []).length,
  "/FormXObject": (str.match(/\/Subtype\s*\/Form/g) || []).length,
  "/Group": (str.match(/\/Group/g) || []).length,
  "/Transparency": (str.match(/\/Transparency/g) || []).length,
};
console.log("Recursos crudos del PDF:", counts);

// PDF real o HTML/error disfrazado?
console.log("Cabecera:", str.slice(0, 20).replace(/\n/g, "\\n"));
console.log("¿PDF linealizado/dañado? %%EOF presente:", str.includes("%%EOF"));

const data = new Uint8Array(raw);
const doc = await getDocument({ data }).promise;
console.log("numPages:", doc.numPages);

for (let p = 1; p <= 3; p++) {
  const page = await doc.getPage(p);
  const ops = await page.getOperatorList();
  const names = {};
  for (let i = 0; i < ops.fnArray.length; i++) {
    const n = OPS[ops.fnArray[i]];
    if (n) names[n] = (names[n] ?? 0) + 1;
  }
  console.log(`\npág ${p} ops:`, JSON.stringify(names));
  // fuentes
  try {
    const fonts = [];
    const check = (objs) => {
      for (const key in objs._objs ?? {}) {
        const o = objs.get?.(key);
        if (o?.loadedName) fonts.push({ name: o.name, loaded: o.loadedName, missingFile: o.missingFile });
      }
    };
    check(page.objs);
    check(page.commonObjs);
    console.log("  fuentes cargadas:", fonts);
  } catch (e) {
    console.log("  (no pude listar fuentes)", e.message);
  }
}
