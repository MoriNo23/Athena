import { afterEach, expect, test } from "bun:test";
import { normalizeSynopsis, searchSynopsis } from "./book-metadata";

const fetchReal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchReal;
});

test("normalizeSynopsis: acepta HTML, string y objeto { value }", () => {
  expect(normalizeSynopsis("<p>Una  novela\n  breve.</p>")).toBe("Una novela breve.");
  expect(normalizeSynopsis({ type: "text", value: "  Otra sinopsis  " })).toBe("Otra sinopsis");
  expect(normalizeSynopsis(null)).toBe("");
  expect(normalizeSynopsis(42)).toBe("");
});

test("searchSynopsis: Google Books manda y no consulta OpenLibrary", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("googleapis")) {
      return {
        ok: true,
        json: async () => ({ items: [{ volumeInfo: { description: "<b>Una novela.</b>" } }] }),
      } as Response;
    }
    throw new Error("OpenLibrary no debería consultarse");
  }) as typeof fetch;
  expect(await searchSynopsis("El libro", "La autora")).toEqual({
    text: "Una novela.",
    source: "googlebooks",
  });
  expect(urls).toHaveLength(1);
  const q = new URL(urls[0]!);
  expect(q.searchParams.get("q")).toContain("intitle:El libro");
  expect(q.searchParams.get("q")).toContain("inauthor:La autora");
});

test("searchSynopsis: sin descripción en Google, cae a OpenLibrary", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("googleapis")) {
      return { ok: true, json: async () => ({ items: [{ volumeInfo: {} }] }) } as Response;
    }
    if (url.includes("openlibrary.org/search.json")) {
      return { ok: true, json: async () => ({ docs: [{ key: "/works/OL1W" }] }) } as Response;
    }
    if (url.includes("/works/OL1W.json")) {
      return { ok: true, json: async () => ({ description: { value: "  Sinopsis  de obra " } }) } as Response;
    }
    throw new Error(`URL inesperada: ${url}`);
  }) as typeof fetch;
  expect(await searchSynopsis("El libro", "")).toEqual({
    text: "Sinopsis de obra",
    source: "openlibrary",
  });
});

test("searchSynopsis: sin red devuelve null y sin título no consulta", async () => {
  globalThis.fetch = (async () => {
    throw new Error("sin red");
  }) as unknown as typeof fetch;
  expect(await searchSynopsis("El libro", "")).toBeNull();
  expect(await searchSynopsis("", "Autor")).toBeNull();
});
