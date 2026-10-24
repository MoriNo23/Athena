/**
 * Tests de paginación virtual del EPUB (paginateEpub). Correr con
 * `bun test src/lib/epub.test.ts`.
 *
 * Caso traído por la dueña (24-10): los encabezados contaban como página —
 * la regla «título estrena página» creaba mini-páginas que el conteo del
 * hábito registraba como página leída. Ahora el título FLUYE con el texto
 * y solo los topes de palabras y el anti-huérfano cortan la página.
 */
import { expect, test } from "bun:test";
import { paginateEpub, EPUB_WORDS_PER_PAGE } from "@/lib/epub";
import type { EpubBlock, EpubTextBlock } from "@/lib/epub";

function p(words: number): EpubTextBlock {
  return { kind: "p", html: "<p>p</p>", text: "p", words };
}

function h(words: number): EpubTextBlock {
  return { kind: "h2", html: "<h2>h</h2>", text: "h", words };
}

function bloque(b: EpubTextBlock): EpubBlock {
  return b;
}

test("un título NO estrena página: fluye con el texto que ya está en la página", () => {
  // p150 + h10 + p150 = 310 ≤ 320: una sola página en el orden p,h,p
  const pages = paginateEpub([[bloque(p(150)), bloque(h(10)), bloque(p(150))]]);
  expect(pages).toHaveLength(1);
  expect(pages[0].blocks.map((b) => b.kind)).toEqual(["p", "h2", "p"]);
  expect(pages[0].words).toBe(310);
});

test("anti-huérfano intacto: un título no queda solo al pie, baja con su primer párrafo", () => {
  // p300 + h10 llenan la página; p30 desborda → el h2 viaja a la siguiente
  // con su primer párrafo (nunca un título huérfano al final)
  const pages = paginateEpub([[bloque(p(300)), bloque(h(10)), bloque(p(30))]]);
  expect(pages.length).toBeGreaterThanOrEqual(2);
  expect(pages[0].blocks[pages[0].blocks.length - 1].kind).toBe("p");
  expect(pages[1].blocks[0].kind).toBe("h2");
  expect(pages[1].blocks[1].kind).toBe("p");
});

test("la cola corta del capítulo se funde con la anterior (regla intacta)", () => {
  const pages = paginateEpub([[bloque(p(EPUB_WORDS_PER_PAGE)), bloque(p(10))]]);
  expect(pages).toHaveLength(1);
  expect(pages[0].words).toBe(EPUB_WORDS_PER_PAGE + 10);
});

test("el título que abre el capítulo va con el texto que lo sigue", () => {
  const pages = paginateEpub([[bloque(h(10)), bloque(p(300))]]);
  expect(pages).toHaveLength(1);
  expect(pages[0].blocks.map((b) => b.kind)).toEqual(["h2", "p"]);
});
