/**
 * Test del motor EPUB (puro, sin DOM): paginación, división de bloques
 * largos y texto de página. Corre con bun: bun scripts/test-epub-engine.ts
 * (espejo de las constantes y funciones de src/lib/epub.ts).
 */
import {
  EPUB_IMAGE_WORDS,
  EPUB_MIN_TAIL_WORDS,
  EPUB_PAGE_HARD_CAP,
  EPUB_WORDS_PER_PAGE,
  epubPageText,
  paginateEpub,
  splitLongTextBlocks,
  type EpubBlock,
  type EpubTextBlock,
} from "../src/lib/epub";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}

const t = (kind: EpubTextBlock["kind"], text: string): EpubTextBlock => ({
  kind,
  html: text,
  text,
  words: text.split(/\s+/).filter(Boolean).length,
});
const img = (): EpubBlock => ({ kind: "img", src: "data:image/png;base64,x", alt: "", words: EPUB_IMAGE_WORDS });

console.log("=== A. CONSTANTES (espejo del motor) ===");
check("320 palabras por página", EPUB_WORDS_PER_PAGE === 320, String(EPUB_WORDS_PER_PAGE));
check("tope duro 520", EPUB_PAGE_HARD_CAP === 520, String(EPUB_PAGE_HARD_CAP));
check("cola mínima 25", EPUB_MIN_TAIL_WORDS === 25, String(EPUB_MIN_TAIL_WORDS));

console.log("=== B. PAGINACIÓN BÁSICA ===");
{
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
  const ch1 = [t("h1", "Capítulo I"), t("p", words(200)), t("p", words(150)), t("p", words(50))];
  const pages = paginateEpub([ch1]);
  check("un capítulo produce páginas", pages.length >= 1, `${pages.length} páginas`);
  check("el título abre la primera página", pages[0].blocks[0].kind === "h1");
  check("ninguna página supera el tope + 1 bloque", pages.every((p) => p.words <= EPUB_PAGE_HARD_CAP), pages.map((p) => p.words).join(","));
  check("no se pierden bloques", pages.reduce((a, p) => a + p.blocks.length, 0) === ch1.length);
  check("las palabras se conservan", pages.reduce((a, p) => a + p.words, 0) === ch1.reduce((a, b) => a + b.words, 0));
}

console.log("=== C. EL TÍTULO ESTRENA PÁGINA ===");
{
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
  const ch = [t("p", words(300)), t("h1", "Capítulo II"), t("p", words(100))];
  const pages = paginateEpub([ch]);
  const headingPage = pages.find((p) => p.blocks.some((b) => b.kind === "h1"));
  check("el h1 arranca su propia página", headingPage != null && headingPage.blocks[0].kind === "h1");
  check("la página anterior se cerró antes", pages.length === 2, `${pages.length} páginas`);
}

console.log("=== D. COLA HUÉRFANA SE FUNDE ===");
{
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
  const ch = [t("p", words(300)), t("p", words(300)), t("p", words(10))]; // cola de 10 < 25
  const pages = paginateEpub([ch]);
  check("la cola corta se funde con la anterior", pages.length === 2 && pages[1].blocks.length === 2, `${pages.length} páginas`);
  check("las palabras de la cola sobreviven", pages.reduce((a, p) => a + p.words, 0) === 610);
}

console.log("=== E. VARIOS CAPÍTULOS: ÍNDICE CONSISTENTE ===");
{
  const words = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`).join(" ");
  const chapters = [
    [t("h1", "C1"), t("p", words(320)), t("p", words(100))],
    [t("h1", "C2"), t("p", words(320))],
    [t("h2", "C3"), t("p", words(600))],
  ];
  const pages = paginateEpub(chapters);
  check("page.chapter apunta al capítulo correcto", pages.every((p) => p.chapter >= 0 && p.chapter < 3));
  const starts = [0, 0, 0];
  for (const p of pages) starts[p.chapter]++;
  check("cada capítulo genera al menos una página", starts.every((s) => s > 0), starts.join(","));
  check("las páginas de cada capítulo son contiguas", (() => {
    let last = -1;
    for (const p of pages) {
      if (p.chapter === last + 1) last = p.chapter;
      else if (p.chapter !== last) return false;
    }
    return true;
  })());
}

console.log("=== F. IMÁGENES: COSTE DE PAGINACIÓN ===");
{
  const words = (n: number) => Array.from({ length: n }, (_, i) => `i${i}`).join(" ");
  const ch = [t("p", words(280)), img(), t("p", words(100))];
  const pages = paginateEpub([ch]);
  check("la imagen no se pierde", pages.reduce((a, p) => a + p.blocks.filter((b) => b.kind === "img").length, 0) === 1);
  check("la imagen empuja el corte de página", pages.length === 2, `${pages.length} páginas`);
}

console.log("=== G. BLOQUES GIGANTES: SPLIT POR FRASES ===");
{
  const giant = Array.from({ length: 30 }, (_, i) => `Frase número ${i} del párrafo monstruo que no termina nunca.`).join(" ");
  const blocks = splitLongTextBlocks([t("p", giant)]);
  const giantWords = giant.split(/\s+/).length; // ~300
  check(
    "párrafo menor al umbral NO se divide",
    splitLongTextBlocks([t("p", "corto")]).length === 1
  );
  const huge = Array.from({ length: 120 }, (_, i) => `Frase ${i} con cinco palabras dentro del bloque.`).join(" ");
  const parts = splitLongTextBlocks([t("p", huge)]);
  check("bloque de ~700 palabras se divide", parts.length >= 2, `${parts.length} partes`);
  check("cada parte respeta el objetivo salvo frases monstruosas", parts.every((p) => p.words <= EPUB_WORDS_PER_PAGE + 6), parts.map((p) => p.words).join(","));
  check("la suma de palabras se conserva", parts.reduce((a, p) => a + p.words, 0) === huge.split(/\s+/).length);
  void giantWords;
}

console.log("=== H. TEXTO DE PÁGINA (contrato del motor VN) ===");
{
  const page = paginateEpub([[t("p", "Primera línea del libro."), t("h2", "título"), t("p", "Segundo párrafo.")]])[0];
  const text = epubPageText(page);
  check("párrafos separados por doble salto", text.includes("\n\n"));
  check("títulos incluidos como texto", text.includes("título"));
  check("epubPageText(undefined) es cadena vacía", epubPageText(undefined) === "");
  check("imágenes no ensucian el texto", !epubPageText({ blocks: [img(), t("p", "solo texto")], words: 10, chapter: 0 }).includes("data:"));
}

console.log("\nRESULTADO:", fail === 0 ? `TODO VERDE (${pass})` : `FALLOS: ${fail} de ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
