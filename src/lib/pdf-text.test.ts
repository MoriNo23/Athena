/**
 * Tests del modo texto del PDF: el fold incremental de la paginación debe
 * dar EXACTAMENTE lo mismo que re-paginar todo el prefijo (y el doble
 * índice debe seguir hablando de páginas reales). Puro, sin disco.
 * Correr con `bun test src/lib/pdf-text.test.ts`.
 */
import { expect, test } from "bun:test";
import { foldPdfTextIndex, paginatePdfText, type PdfTextBlock, type PdfTextKind } from "@/lib/pdf-text";

let n = 0;
/** bloque con texto único para que la comparación profunda sea fiel */
function bloque(words: number, kind: PdfTextKind = "p"): PdfTextBlock {
  const text = `${kind}-${++n}`;
  return { kind, html: text, text, words };
}

test("fold incremental == paginación completa (tres trozos, casos de borde)", () => {
  const realPages: PdfTextBlock[][] = [
    [bloque(200), bloque(200)], // 1: puro
    [bloque(100), bloque(250)], // 2: cola-huérfana dentro del capítulo
    [], // 3: real vacía
    [bloque(150), bloque(300), bloque(30, "h2"), bloque(200)], // 4: anti-título cruza página
    [bloque(310)], // 5: un bloque casi página entera
    [bloque(90, "h2"), bloque(60)], // 6: cola corta con título
  ];
  const completa = paginatePdfText(realPages);

  const a = foldPdfTextIndex(null, realPages.slice(0, 2), 0);
  const b = foldPdfTextIndex(a, realPages.slice(2, 4), 2);
  const c = foldPdfTextIndex(b, realPages.slice(4, 6), 4);
  expect(JSON.stringify(c)).toEqual(JSON.stringify(completa));
});

test("fold: sin páginas nuevas no cambia nada y la primera llamada arranca de cero", () => {
  expect(foldPdfTextIndex(null, [], 0).pages).toEqual([]);
  const prev = foldPdfTextIndex(null, [[bloque(50), bloque(300)]], 0);
  expect(foldPdfTextIndex(prev, [], 1)).toEqual(prev);
});

test("fold: el doble índice sigue en.pages reales tras el empalme", () => {
  const primeras = [[bloque(400)], [bloque(400)]]; // 2 reales → páginas virtuales de 320
  const idx = foldPdfTextIndex(null, primeras, 0);
  expect(idx.pages.length).toBeGreaterThan(0);
  for (let v = 0; v < idx.pages.length; v++) {
    expect(idx.pageStart[v]).toBe(idx.pages[v].realPage);
  }

  const late = foldPdfTextIndex(idx, [[bloque(100)], []], 2);
  expect(late.pages[late.pages.length - 1].realPage).toBe(3); // la nueva real arranca en 3
  expect(late.pageStart[late.pageStart.length - 1]).toBe(3);
  expect(late.realToVirtual).toHaveLength(4);
  expect(late.emptyRealPages).toEqual([4]); // la real 4 quedó vacía
});
