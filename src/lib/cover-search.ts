/**
 * Búsqueda de portadas reales desde el NAVEGADOR (el servidor del sandbox no
 * alcanza openlibrary.org ni googleapis.com; el navegador del usuario sí).
 * Estrategia: 1) Open Library (mejores portadas de libros) → 2) Google Books.
 * Devuelve un blob descargable (ideal, se guarda localmente) o, si la imagen
 * no se pudo descargar por CORS, al menos la URL de un dominio permitido.
 */

export interface CoverHit {
  blob?: Blob;
  url: string;
  source: "openlibrary" | "googlebooks";
  /** true si la imagen quedó descargada en el cliente lista para subirse */
  downloaded: boolean;
}

const TIMEOUT_MS = 9000;

async function fetchT(url: string, opts?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

async function tryOpenLibrary(title: string, author: string): Promise<CoverHit | null> {
  const q = new URL("https://openlibrary.org/search.json");
  q.searchParams.set("title", clean(title));
  if (author) q.searchParams.set("author", clean(author));
  q.searchParams.set("limit", "5");
  q.searchParams.set("fields", "key,title,author_name,cover_i,edition_count");
  const res = await fetchT(q.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { docs?: { cover_i?: number; edition_count?: number }[] };
  const withCover = (data.docs ?? []).filter((d) => typeof d.cover_i === "number");
  if (withCover.length === 0) return null;
  // Preferimos el resultado con más ediciones (suele ser la edición canónica)
  withCover.sort((a, b) => (b.edition_count ?? 0) - (a.edition_count ?? 0));
  const coverId = withCover[0].cover_i!;
  const url = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  try {
    const img = await fetchT(url);
    if (img.ok) {
      const blob = await img.blob();
      if (blob.size > 1000) return { blob, url, source: "openlibrary", downloaded: true };
    }
  } catch {
    /* sin CORS para la imagen: devolvemos la URL */
  }
  return { url, source: "openlibrary", downloaded: false };
}

async function tryGoogleBooks(title: string, author: string): Promise<CoverHit | null> {
  const q = new URL("https://www.googleapis.com/books/v1/volumes");
  q.searchParams.set("q", author ? `intitle:${clean(title)} inauthor:${clean(author)}` : `intitle:${clean(title)}`);
  q.searchParams.set("maxResults", "5");
  const res = await fetchT(q.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: { volumeInfo?: { imageLinks?: Record<string, string> } }[];
  };
  const links = (data.items ?? []).map((i) => i.volumeInfo?.imageLinks).find(Boolean);
  if (!links) return null;
  const raw = links.thumbnail ?? links.smallThumbnail ?? links.large ?? Object.values(links)[0];
  if (!raw) return null;
  const url = raw.replace(/^http:\/\//, "https://").replace(/&edge=curl/, "").replace(/&zoom=1/, "&zoom=2");
  try {
    const img = await fetchT(url);
    if (img.ok) {
      const blob = await img.blob();
      if (blob.size > 1000) return { blob, url, source: "googlebooks", downloaded: true };
    }
  } catch {
    /* sin CORS: devolvemos la URL */
  }
  return { url, source: "googlebooks", downloaded: false };
}

/**
 * Busca la portada del libro. Solo debe llamarse con título y autor definidos
 * (es la condición que pide el usuario para sustituir la portada).
 */
export async function searchCover(title: string, author: string): Promise<CoverHit | null> {
  const t = clean(title);
  const a = clean(author);
  if (!t || !a) return null;
  try {
    const hit = await tryOpenLibrary(t, a);
    if (hit) return hit;
  } catch {
    /* sigue con Google Books */
  }
  try {
    return await tryGoogleBooks(t, a);
  } catch {
    return null;
  }
}

/** Sube una portada (blob o URL) al servidor y devuelve el libro actualizado */
export async function uploadCover(
  bookId: string,
  hit: Pick<CoverHit, "blob" | "url">
): Promise<{ ok: boolean; coverPath?: string; error?: string }> {
  try {
    let res: Response;
    if (hit.blob) {
      const fd = new FormData();
      const ext = hit.blob.type.includes("png") ? "png" : hit.blob.type.includes("webp") ? "webp" : "jpg";
      fd.append("file", hit.blob, `portada.${ext}`);
      res = await fetch(`/api/books/${bookId}/cover`, { method: "POST", body: fd });
    } else {
      res = await fetch(`/api/books/${bookId}/cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: hit.url }),
      });
    }
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Error al guardar la portada" };
    return { ok: true, coverPath: data.book?.coverPath };
  } catch {
    return { ok: false, error: "Sin conexión con el servidor" };
  }
}
