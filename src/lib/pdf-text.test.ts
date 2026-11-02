/**
 * Tests del modo texto del PDF: el fold incremental de la paginación debe
 * dar EXACTAMENTE lo mismo que re-paginar todo el prefijo (y el doble
 * índice debe seguir hablando de páginas reales). Puro, sin disco.
 * Correr con `bun test src/lib/pdf-text.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import {
  detectPdfColumns,
  extractPdfPageBlocks,
  foldPdfTextIndex,
  paginatePdfText,
  type PdfTextBlock,
  type PdfTextItem,
  type PdfTextKind,
} from "@/lib/pdf-text";

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

// ---------- two-up: detección de columnas y lectura por columnas ----------
// Caso real: «70 años de humor en Venezuela» (122 de 124 hojas son spreads
// de 1049×652 pt con las portadas simples de 524×652 mezcladas).

const W_SPREAD = 1048.8;
const H_SPREAD = 652;

/** ítem de pdf.js sintético (transform [1,0,0,1,x,y]) */
function item(str: string, x: number, y: number, width = str.length * 5, height = 10): PdfTextItem {
  return { str, width, height, transform: [1, 0, 0, 1, x, y] };
}

/** spread: renglones de AMBAS páginas a la misma Y (así fundía la lectura) */
function itemsTwoUp(opts: { conEncabezado?: boolean } = {}): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  if (opts.conEncabezado) {
    // el encabezado derecho baja ~13 pt respecto del izquierdo (real, pág. 40)
    items.push(item("78 70 AÑOS DE HUMOR", 30, 613, 200));
    items.push(item("capítulo_ capítulo_ capítulo 79", 630, 600, 220));
  }
  for (let i = 0; i < 12; i++) {
    const y = 580 - i * 13;
    items.push(item(`izq renglón ${i} aa bb cc dd ee ff gg hh`, 30, y, 380));
    items.push(item(`der renglón ${i} ii jj kk ll mm nn oo pp`, 630, y, 390));
  }
  return items;
}

describe("detectPdfColumns", () => {
  test("spread con canal central vacío → 2 columnas cortando al medio", () => {
    const layout = detectPdfColumns(itemsTwoUp(), W_SPREAD);
    expect(layout.columns).toBe(2);
    // el centro del canal cae en el medio de la hoja (±4 %)
    expect(Math.abs((layout.splitX ?? 0) - W_SPREAD / 2)).toBeLessThan(W_SPREAD * 0.04);
  });

  test("hoja de una columna a lo ancho → 1 columna", () => {
    const items: PdfTextItem[] = [];
    for (let i = 0; i < 12; i++) {
      items.push(item(`renglón ${i} de texto a todo lo ancho de la hoja aa bb`, 30, 580 - i * 13, 988));
    }
    expect(detectPdfColumns(items, W_SPREAD).columns).toBe(1);
  });

  test("bloque estrecho pegado a la izquierda (margen ancho) → 1 columna", () => {
    const items: PdfTextItem[] = [];
    for (let i = 0; i < 12; i++) {
      items.push(item(`renglón ${i} estrecho aa bb cc dd ee`, 30, 580 - i * 13, 500));
    }
    expect(detectPdfColumns(items, W_SPREAD).columns).toBe(1);
  });

  test("bloque centrado → 1 columna (la tinta cruza el centro)", () => {
    const items: PdfTextItem[] = [];
    for (let i = 0; i < 12; i++) {
      items.push(item(`renglón ${i} centrado aa bb cc dd ee`, 274, 580 - i * 13, 500));
    }
    expect(detectPdfColumns(items, W_SPREAD).columns).toBe(1);
  });

  test("pocos ítems (portada ilustrada con pie) → 1 columna sin arriesgar", () => {
    const items = [item("pie de figura", 30, 100, 300), item("otro pie", 630, 100, 300)];
    expect(detectPdfColumns(items, W_SPREAD).columns).toBe(1);
    expect(detectPdfColumns([], W_SPREAD).columns).toBe(1);
    expect(detectPdfColumns(itemsTwoUp(), 0).columns).toBe(1); // sin ancho no se decide
  });
});

describe("extractPdfPageBlocks con two-up", () => {
  test("la lectura va por columnas: página izquierda completa y luego la derecha", () => {
    const blocks = extractPdfPageBlocks(itemsTwoUp(), {
      pageHeight: H_SPREAD,
      pageWidth: W_SPREAD,
    });
    // 12 renglones a ritmo uniforme = 1 párrafo por columna
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text.startsWith("izq renglón 0")).toBe(true);
    expect(blocks[0].text.includes("izq renglón 11")).toBe(true);
    expect(blocks[1].text.startsWith("der renglón 0")).toBe(true);
    // NINGÚN bloque mezcla columnas (el bug: renglones fundidos por la misma Y)
    for (const b of blocks) {
      expect(b.text.includes("izq") && b.text.includes("der")).toBe(false);
    }
  });

  test("el encabezado corrido de AMBAS páginas se descarta (el derecho baja 13 pt)", () => {
    const blocks = extractPdfPageBlocks(itemsTwoUp({ conEncabezado: true }), {
      pageHeight: H_SPREAD,
      pageWidth: W_SPREAD,
    });
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.text).join(" ")).not.toContain("70 AÑOS");
    expect(blocks.map((b) => b.text).join(" ")).not.toContain("capítulo_");
  });

  test("regresión: hoja de una columna con pageWidth se extrae igual que siempre", () => {
    const items: PdfTextItem[] = [];
    for (let i = 0; i < 8; i++) {
      items.push(item(`renglón ${i} completo aa bb cc dd ee ff gg`, 30, 580 - i * 13, 988));
    }
    const conAncho = extractPdfPageBlocks(items, { pageHeight: H_SPREAD, pageWidth: W_SPREAD });
    const sinAncho = extractPdfPageBlocks(items, { pageHeight: H_SPREAD });
    expect(conAncho).toEqual(sinAncho);
    expect(conAncho).toHaveLength(1);
    expect(conAncho[0].text).toContain("renglón 0");
    expect(conAncho[0].text).toContain("renglón 7");
  });

  test("página espesa (lámina: encabezado arriba, pie abajo): el salto enorme no funde nada", () => {
    // pág. 41 real: con UN solo hueco en la columna, el cuartil se disparaba a
    // ~300 pt y encabezado+pie salían como UN párrafo, que al vivir en la zona
    // de mobiliario se descartaba ENTERO (la página quedaba muda)
    const items: PdfTextItem[] = [
      item("80 70 AÑOS DE HUMOR", 30, 613, 200),
      item("capítulo_ capítulo_ 81", 630, 600, 180),
      // pies de figura a media página: tres fragmentos por columna (misma Y)
      item("Pie izquierdo de la lámina", 30, 300, 240),
      item("continúa aquí", 280, 300, 120),
      item("y acaba", 410, 300, 70),
      item("Pie derecho de la lámina", 630, 300, 220),
      item("sigue aquí", 860, 300, 100),
      item("y cierra", 970, 300, 60),
    ];
    const blocks = extractPdfPageBlocks(items, { pageHeight: H_SPREAD, pageWidth: W_SPREAD });
    expect(blocks).toHaveLength(2); // encabezados fuera; los pies quedan
    expect(blocks[0].text).toContain("Pie izquierdo");
    expect(blocks[1].text).toContain("Pie derecho");
    const todo = blocks.map((b) => b.text).join(" ");
    expect(todo).not.toContain("70 AÑOS");
    expect(todo).not.toContain("capítulo_");
  });
});
