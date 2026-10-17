// Extraer y probar el stream de contenido de la pág 1 del PDF problemático
import fs from "fs";
import zlib from "zlib";

const raw = fs.readFileSync("/home/z/my-project/public/uploads/b4f502e072dc54fea.pdf");
const str = raw.toString("latin1");

// Buscar el primer objeto con /Contents
const pageRe = /\/Type\s*\/Page[^>]*>>/g;
let m;
let found = 0;
while ((m = pageRe.exec(str)) && found < 2) {
  const end = m.index + m[0].length;
  const chunk = str.slice(Math.max(0, m.index - 800), end);
  const contentsMatch = chunk.match(/\/Contents\s+(\d+)\s+(\d+)\s+R/);
  console.log("\nObjeto Page en", m.index, "→ /Contents:", contentsMatch ? contentsMatch[1] : "?");
  found++;
}

// Tomar el primer stream Flate del archivo y probar inflarlo
const streamRe = /(\d+)\s+0\s+obj[^>]*?\/Filter\s*\/FlateDecode[^>]*?>>\s*stream\r?\n/g;
let sm;
let tested = 0;
while ((sm = streamRe.exec(str)) && tested < 200) {
  const start = sm.index + sm[0].length;
  const endIdx = str.indexOf("endstream", start);
  const streamBytes = raw.subarray(start, endIdx);
  try {
    const out = zlib.inflateSync(streamBytes);
    const head = out.toString("latin1", 0, 120);
    if (/T[jJ]|BT|Do\b|cm\b/.test(head)) {
      console.log(`\nObjeto ${sm[1]} infla OK (${out.length}B):`, head.replace(/\n/g, " ").slice(0, 110));
      tested++;
      if (tested >= 5) break;
    }
  } catch {
    // falla de inflado
    console.log(`Objeto ${sm[1]} FALLA inflate (${streamBytes.length}B)`);
    tested++;
    if (tested >= 5) break;
  }
}
if (tested === 0) console.log("Ningún stream probado — patrón no encontrado");
