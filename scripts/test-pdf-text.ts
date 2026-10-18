/* Test del modo texto del PDF (tarea 4.1 del change «Teleprompter y lector»).
 *
 * Módulo puro `src/lib/pdf-text.ts`: ítems → líneas → párrafos, heurística
 * conservadora de títulos y paginación con las reglas del EPUB + doble índice
 * (pageStart / realToVirtual).
 *
 *   bun scripts/test-pdf-text.ts
 */
import {
  extractPdfPageBlocks,
  isPdfHeading,
  paginatePdfText,
  pdfItemsToParagraphs,
  pdfPageText,
  pdfTextItems,
  type PdfTextBlock,
  type PdfTextItem,
} from "../src/lib/pdf-text";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

/** Ítem sintético estilo pdf.js: x/y en `transform`, alto de letra y fuente */
function item(str: string, x: number, y: number, opts: { h?: number; bold?: boolean } = {}): PdfTextItem {
  const h = opts.h ?? 10;
  return {
    str,
    width: str.length * h * 0.5,
    height: h,
    transform: [1, 0, 0, 1, x, y],
    fontName: opts.bold ? "AAAAAA+Cuerpo-Bold" : "AAAAAA+Cuerpo",
  };
}

/** Párrafo de `n` líneas del cuerpo (gap intra-párrafo 12) */
function bodyLines(prefix: string, n: number, y0: number): PdfTextItem[] {
  const out: PdfTextItem[] = [];
  for (let i = 0; i < n; i++) {
    out.push(item(`${prefix} línea ${i + 1} del cuerpo del texto.`, 100, y0 - i * 12));
  }
  return out;
}

/** Bloque de texto con n palabras (para la paginación) */
function blk(nWords: number, kind: PdfTextBlock["kind"] = "p"): PdfTextBlock {
  const text = Array.from({ length: nWords }, (_, i) => `palabra${i}`).join(" ");
  return { kind, html: text, text, words: nWords };
}

// ---------------------------------------------------------------------------
console.log("=== A. Ítems → líneas → párrafos → bloques ===");

const page1: PdfTextItem[] = [
  // títulos: cortos, sin punto final, en su propio renglón
  item("Aristóteles", 100, 770),
  item("El comienzo de la historia", 100, 744, { h: 18, bold: true }),
  // cuerpo de una línea acabado en punto
  item("Aristóteles nació en Estagira en el año 384 a. C.", 100, 718),
  // cuerpo de 6 líneas (nunca es título aunque empiece en mayúscula)
  ...bodyLines("Primer párrafo:", 6, 692),
  // cuerpo de 2 líneas, la primera partida en dos ítems con hueco
  item("Segundo", 100, 606),
  item("párrafo con hueco", 160, 606),
  item("que la heurística debe unir con un espacio.", 100, 594),
  // cuerpo de 3 líneas
  ...bodyLines("Tercer renglón:", 3, 568),

  // falso título: acaba en punto
  item("El mundo de Sofía.", 100, 518),
];

const blocks = extractPdfPageBlocks(page1);
check(
  "secuencia de tipos = [h3, h2, p, p, p, p, p]",
  JSON.stringify(blocks.map((b) => b.kind)) === JSON.stringify(["h3", "h2", "p", "p", "p", "p", "p"]),
  blocks.map((b) => `${b.kind}:${b.text.slice(0, 18)}`).join(" | "),
);
check("«Aristóteles» es título sin señal de fuente (h3)", blocks[0]?.text === "Aristóteles" && blocks[0]?.kind === "h3");
check(
  "«El comienzo de la historia» es h2 (negrita + alto)",
  blocks[1]?.text === "El comienzo de la historia" && blocks[1]?.kind === "h2",
);
check("frase terminada en punto = cuerpo", blocks[2]?.kind === "p", blocks[2]?.text.slice(0, 40));
check(
  "párrafo multilínea unido con espacios simples",
  blocks[3]?.text.startsWith("Primer párrafo: línea 1") && !blocks[3]?.text.includes("  "),
  blocks[3]?.text.slice(0, 60),
);
check(
  "hueco horizontal ⇒ espacio implícito",
  blocks[4]?.text.startsWith("Segundo párrafo con hueco que la heurística"),
  blocks[4]?.text.slice(0, 60),
);
check("«El mundo de Sofía.» = cuerpo (punto final)", blocks[6]?.kind === "p" && blocks[6]?.text === "El mundo de Sofía.");
check(
  "words por bloque",
  blocks[3]?.words === blocks[3]?.text.split(/\s+/).length,
  String(blocks[3]?.words),
);

const paras = pdfItemsToParagraphs(pdfTextItems(page1));
check(
  "párrafos separados por salto vertical (7)",
  paras.length === 7 && paras.map((p) => p.lines).join(",") === "1,1,1,6,2,3,1",
  `párrafos=${paras.length} líneas=${paras.map((p) => p.lines).join(",")}`,
);
check(
  "metadatos de señal: negrita y altura",
  paras[1].bold === true && paras[1].height === 18 && paras[0].height === 10,
);

console.log("\n--- heurística directa ---");
const h = (text: string, lines = 1, height = 10, bold = false) => ({ text, lines, height, top: 0, bottom: 0, bold });
check("3 líneas nunca es título", isPdfHeading(h("La historia", 3), 10) === null);
check("puntuación final bloquea", isPdfHeading(h("El comienzo:"), 10) === null);
check("inicio en minúscula bloquea", isPdfHeading(h("el comienzo de la historia"), 10) === null);
check("2 líneas cortas = h3", isPdfHeading(h("El comienzo de la historia", 2), 10) === "h3");
check("negrita ⇒ h2", isPdfHeading(h("El comienzo de la historia", 1, 10, true), 10) === "h2");
check("altura > mediana ⇒ h2", isPdfHeading(h("El comienzo de la historia", 1, 18), 10) === "h2");
check("larga y con muchas palabras bloquea", isPdfHeading(h("Una frase muy larga de cuerpo que no es título de nada"), 10) === null);

console.log("\n--- escapado y extremos ---");
const esc = extractPdfPageBlocks([item("cuerpo con <etiqueta> & comillas", 100, 700, { h: 10 })]);
check("html escapado", esc[0]?.html === "cuerpo con &lt;etiqueta&gt; &amp; comillas", esc[0]?.html);
check("página vacía ⇒ sin bloques", extractPdfPageBlocks([]).length === 0);
check("texto plano de bloques con «\\n\\n»", pdfPageText([blk(3), blk(4)]).split("\n\n").length === 2);

console.log("\n--- mobiliario: encabezado corrido y folio ---");
// Alto de página 800: banda superior > 752, banda inferior < 48
const conMobiliario: PdfTextItem[] = [
  item("Don Quijote — Selección", 60, 770, { h: 10 }), // top 780 → banda superior, corto
  item("Capítulo 11. El yelmo de Mambrino", 60, 700, { h: 17, bold: true }),
  ...bodyLines("En esto, comenzó a llover:", 2, 660),
  item("— 12 —", 300, 20, { h: 9 }), // bottom 20 → banda inferior, corto
];
const enBanda = extractPdfPageBlocks(conMobiliario, { pageHeight: 800 });
check(
  "encabezado y folio fuera del reflujo",
  enBanda.length === 2 && enBanda[0].kind === "h2" && enBanda[1].text.startsWith("En esto"),
  enBanda.map((b) => `${b.kind}:${b.text.slice(0, 16)}`).join(" ~ "),
);
check("sin alto de página no se descarta nada", extractPdfPageBlocks(conMobiliario).length === 4);
check(
  "párrafo largo pegado al borde no se pierde",
  extractPdfPageBlocks([item("A".repeat(120), 60, 770)], { pageHeight: 800 }).length === 1,
);
check(
  "párrafo corto en el cuerpo se conserva",
  extractPdfPageBlocks([item("Fin del capítulo", 60, 400)], { pageHeight: 800 }).length === 1,
);

// ---------------------------------------------------------------------------
console.log("\n=== B. Paginación e índices ===");

const idx = paginatePdfText([
  [blk(200)],
  [],
  [blk(3, "h3"), blk(150)],
]);
check("2 páginas virtuales", idx.pages.length === 2, JSON.stringify(idx.pages.map((p) => p.words)));
check("pageStart = [1, 3]", JSON.stringify(idx.pageStart) === "[1,3]", JSON.stringify(idx.pageStart));
check("página vacía no rompe el flujo", idx.pages[1].realPage === 3);
check("realToVirtual clava la página vacía en la siguiente", JSON.stringify(idx.realToVirtual) === "[0,1,1]", JSON.stringify(idx.realToVirtual));
check("emptyRealPages = [2]", JSON.stringify(idx.emptyRealPages) === "[2]", JSON.stringify(idx.emptyRealPages));

const idx2 = paginatePdfText([[blk(200), blk(200)]]);
check("bloque entero nunca se parte (2×200)", idx2.pages.length === 2 && idx2.pages.every((p) => p.words === 200));
check("ambas ceden la misma página real", JSON.stringify(idx2.pageStart) === "[1,1]", JSON.stringify(idx2.pageStart));
check("realToVirtual se fija al final del libro", JSON.stringify(idx2.realToVirtual) === "[0]", JSON.stringify(idx2.realToVirtual));

const idx3 = paginatePdfText([[blk(300), blk(20)]]);
check("cola corta se funde con la anterior", idx3.pages.length === 1 && idx3.pages[0].words === 320, JSON.stringify(idx3.pages.map((p) => p.words)));

const idx4 = paginatePdfText([[blk(300), blk(30)]]);
check("cola > 25 palabras aguanta sola", idx4.pages.length === 2, JSON.stringify(idx4.pages.map((p) => p.words)));

const idx5 = paginatePdfText([[blk(200), blk(3, "h3"), blk(50)]]);
check(
  "un título estrena página virtual",
  idx5.pages.length === 2 && idx5.pages[0].words === 200 && idx5.pages[1].blocks[0].kind === "h3",
  JSON.stringify(idx5.pages.map((p) => p.words)),
);

const vacio = paginatePdfText([[],[],[]]);
check("sin texto ⇒ -1 (no hay páginas virtuales)", vacio.pages.length === 0 && vacio.realToVirtual.every((v) => v === -1), JSON.stringify(vacio.realToVirtual));

console.log(`\n${fail ? "FALLOS" : "MODO TEXTO SANO"} — ${pass} pasan, ${fail} fallan`);
process.exit(fail ? 1 : 0);
