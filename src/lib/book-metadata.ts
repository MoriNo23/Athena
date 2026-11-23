/**
 * Sinopsis desde el NAVEGADOR (el servidor no alcanza googleapis.com ni
 * openlibrary.org; el navegador del lector sí). Igual patrón que
 * `cover-search.ts`: Google Books primero, OpenLibrary como reserva, timeout,
 * sin reintentos y fallo silencioso. Solo salen el título y el autor.
 */

import type { BookSynopsis } from "@/core/types";

const TIMEOUT_MS = 9000;

async function fetchT(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Google da HTML; OpenLibrary, string o `{ type, value }`. */
export function normalizeSynopsis(value: unknown): string {
  let raw = "";
  if (typeof value === "string") raw = value;
  else if (value && typeof value === "object" && typeof (value as { value?: unknown }).value === "string") {
    raw = (value as { value: string }).value;
  }
  return clean(raw.replace(/<[^>]*>/g, " "));
}

async function tryGoogle(title: string, author: string): Promise<BookSynopsis | null> {
  const q = new URL("https://www.googleapis.com/books/v1/volumes");
  q.searchParams.set("q", author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`);
  q.searchParams.set("maxResults", "5");
  const res = await fetchT(q.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { volumeInfo?: { description?: unknown } }[] };
  for (const item of data.items ?? []) {
    const text = normalizeSynopsis(item.volumeInfo?.description);
    if (text) return { text, source: "googlebooks" };
  }
  return null;
}

async function tryOpenLibrary(title: string, author: string): Promise<BookSynopsis | null> {
  const q = new URL("https://openlibrary.org/search.json");
  q.searchParams.set("title", title);
  if (author) q.searchParams.set("author", author);
  q.searchParams.set("limit", "5");
  q.searchParams.set("fields", "key,title");
  const res = await fetchT(q.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { docs?: { key?: string }[] };
  const key = data.docs?.[0]?.key;
  if (!key) return null;
  const work = await fetchT(`https://openlibrary.org${key}.json`);
  if (!work.ok) return null;
  const body = (await work.json()) as { description?: unknown };
  const text = normalizeSynopsis(body.description);
  return text ? { text, source: "openlibrary" } : null;
}

/** Busca la sinopsis. Con título sin autor se busca solo por título. */
export async function searchSynopsis(title: string, author: string): Promise<BookSynopsis | null> {
  const t = clean(title);
  if (!t) return null;
  const a = clean(author);
  try {
    const hit = await tryGoogle(t, a);
    if (hit) return hit;
  } catch {
    /* sin respuesta: prueba la otra fuente */
  }
  try {
    return await tryOpenLibrary(t, a);
  } catch {
    return null; // sin red: la biblioteca sigue funcionando
  }
}
