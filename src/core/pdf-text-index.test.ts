/**
 * Tests de la sonda de capa de texto (probePdfTextLayer). El muestreo corto
 * (3 páginas) declaraba «sin capa de texto» a libros two-up muy ilustrados:
 * el «70 años de humor en Venezuela» muestreaba portada, mitad (spread de
 * caricaturas) y contraportada — 63 chars para un libro con páginas de 4000+.
 * Con stub de doc, sin pdf.js. Correr con `bun test src/lib/pdf-text-index.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { probePdfTextLayer } from "@/core/pdf-text-index";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** doc falso: cada página devuelve el texto que le toque (número de chars) */
function fakeDoc(charsPorPagina: Record<number, number>, total: number): PDFDocumentProxy {
  return {
    numPages: total,
    getPage: async (p: number) => ({
      getTextContent: async () => ({
        items: [{ str: "x".repeat(charsPorPagina[p] ?? 0), width: 10, height: 10, transform: [1, 0, 0, 1, 0, 0] }],
      }),
    }),
  } as unknown as PDFDocumentProxy;
}

describe("probePdfTextLayer", () => {
  test("libro two-up ilustrado: el muestreo repartido encuentra el cuerpo con texto", async () => {
    // réplica del «70 años de humor»: portada y contraportada mudas, la mitad
    // es un spread de caricaturas (63 chars), pero el cuerpo sí tiene texto
    const doc = fakeDoc({ 1: 0, 21: 4200, 41: 327, 62: 63, 83: 3900, 103: 3100, 124: 0 }, 124);
    expect(await probePdfTextLayer(doc)).toBe(true);
  });

  test("el viejo muestreo de 3 (1, mitad, final) habría fallado este libro", async () => {
    // las tres páginas que muestreaba el código viejo, casi mudas
    const doc = fakeDoc({ 1: 0, 62: 63, 124: 0 }, 124);
    // con el muestreo de 7: 21 y 41 traen texto suficiente
    const conCuerpo = fakeDoc({ 1: 0, 21: 400, 62: 63, 124: 0 }, 124);
    expect(await probePdfTextLayer(conCuerpo)).toBe(true);
    // con SÓLO esas tres mudas sigue sin haber capa de texto
    expect(await probePdfTextLayer(doc)).toBe(false);
  });

  test("escaneo puro (0 chars en todas) → false", async () => {
    const doc = fakeDoc({}, 200);
    expect(await probePdfTextLayer(doc)).toBe(false);
  });

  test("umbral: acumulado por debajo de 300 chars → false", async () => {
    const doc = fakeDoc({ 1: 50, 2: 50, 3: 50 }, 3);
    expect(await probePdfTextLayer(doc)).toBe(false);
  });

  test("doc corto: las fracciones se plegan a las páginas existentes", async () => {
    const doc = fakeDoc({ 1: 100, 2: 100, 3: 150 }, 3);
    expect(await probePdfTextLayer(doc)).toBe(true); // 350 ≥ 300
    const deUna = fakeDoc({ 1: 350 }, 1);
    expect(await probePdfTextLayer(deUna)).toBe(true);
  });
});
