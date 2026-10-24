"use client";

import JSZip from "jszip";

/**
 * Motor EPUB de Atena.
 *
 * Un EPUB es reflowable: no tiene páginas. Atena es una casa de páginas (riel,
 * hitos, ETA, racha, modo teleprompter…). La traducción entre ambos mundos es la
 * PÁGINA VIRTUAL: el texto del libro se trocea en bloques (párrafos, títulos,
 * citas, imágenes) y se agrupa en páginas de ~320 palabras — el tamaño de una
 * página de tapa blanda. Con eso, TODO el aparato de la casa funciona sobre un
 * EPUB igual que sobre un PDF, sin tocar una sola pieza existente.
 *
 * Las funciones puras (paginación, división de bloques largos, texto de página)
 * viven separadas de las que necesitan DOM (parseo de OPF/XHTML) para poder
 * auditarlas con bun (scripts/test-epub-engine.ts) sin navegador.
 */

// ---------- Modelo ----------

export type EpubTextKind = "h1" | "h2" | "h3" | "h4" | "p" | "quote" | "li";

export interface EpubTextBlock {
  kind: EpubTextKind;
  /** html inline saneado (em/strong/sup/sub/br), sin atributos */
  html: string;
  /** texto plano (para el modo teleprompter y el peek) */
  text: string;
  words: number;
}

export interface EpubImageBlock {
  kind: "img";
  /** dataURL resuelta desde el zip */
  src: string;
  alt: string;
  words: number;
}

export type EpubBlock = EpubTextBlock | EpubImageBlock;

export interface EpubPage {
  blocks: EpubBlock[];
  words: number;
  /** índice del capítulo (posición en book.chapters) del primer bloque */
  chapter: number;
}

export interface EpubChapter {
  title: string;
  /** primera página del capítulo (1-based) */
  page: number;
}

export interface EpubBook {
  title: string | null;
  author: string | null;
  pages: EpubPage[];
  chapters: EpubChapter[];
  /** portada en bruto (dataURL, tal cual del zip); el probe la normaliza */
  cover: string | null;
}

export interface EpubProbe {
  numPages: number;
  coverDataUrl: string | null;
  title: string | null;
  author: string | null;
}

// ---------- Constantes de paginación (espejo en scripts/test-epub-engine.ts) ----------

/** Palabras por página virtual: una página de tapa blanda (~320 palabras). */
export const EPUB_WORDS_PER_PAGE = 320;
/** Tope blando por página antes de cerrar (un bloque entero nunca se parte al paginar). */
export const EPUB_PAGE_HARD_CAP = 520;
/** Coste de paginación de una imagen: ocupa visualmente media página. */
export const EPUB_IMAGE_WORDS = 90;
/** Última página del capítulo más corta que esto se funde con la anterior. */
export const EPUB_MIN_TAIL_WORDS = 25;
/** Bloque de texto con más palabras que esto se parte por frases antes de paginar. */
export const EPUB_SPLIT_BLOCK_WORDS = 450;
/** Imágenes del zip mayores que esto se descartan (portadas gigantes, mapas). */
export const EPUB_MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// ---------- Paginación (puro, sin DOM) ----------

const HEADING_KINDS = new Set<EpubTextKind>(["h1", "h2", "h3", "h4"]);

/**
 * Agrupa los bloques de cada capítulo en páginas virtuales.
 * Reglas de la casa:
 *  - una página se cierra al alcanzar EPUB_WORDS_PER_PAGE (nunca a mitad de bloque);
 *  - un título estrena página si la actual ya tiene contenido;
 *  - la última página huérfana de un capítulo (< EPUB_MIN_TAIL_WORDS) se funde
 *    con la anterior si no la revienta.
 */
export function paginateEpub(chapters: EpubBlock[][]): EpubPage[] {
  const pages: EpubPage[] = [];

  const flush = (current: EpubBlock[], chapter: number) => {
    if (current.length === 0) return;
    const words = current.reduce((acc, b) => acc + b.words, 0);
    // página huérfana demasiado corta: se funde con la anterior del mismo capítulo
    const prev = pages[pages.length - 1];
    const ultimoBloque = current[current.length - 1];
    const acabaEnTitulo =
      current.length > 0 && ultimoBloque.kind !== "img" && HEADING_KINDS.has(ultimoBloque.kind);
    if (
      prev &&
      prev.chapter === chapter &&
      words < EPUB_MIN_TAIL_WORDS &&
      !acabaEnTitulo &&
      prev.words + words <= EPUB_PAGE_HARD_CAP
    ) {
      prev.blocks.push(...current);
      prev.words += words;
      return;
    }
    pages.push({ blocks: current, words, chapter });
  };

  for (let c = 0; c < chapters.length; c++) {
    let current: EpubBlock[] = [];
    let words = 0;

    for (const block of chapters[c]) {
      const isHeading = block.kind !== "img" && HEADING_KINDS.has(block.kind);
      // título estrena página (si la actual no está vacía)
      if (isHeading && current.length > 0) {
        flush(current, c);
        current = [];
        words = 0;
      }
      // el bloque no cabe: cierra la pagina antes de colocarlo
      if (current.length > 0 && words + block.words > EPUB_WORDS_PER_PAGE) {
        // anti-huérfano: si la página cerraría con un título al final (solo,
        // esperando su texto), el título viaja a la página siguiente en vez de
        // quedarse hundido al pie — nadie lee un título y gira la página.
        const ultimo = current[current.length - 1];
        const tituloAlFinal = ultimo.kind !== "img" && HEADING_KINDS.has(ultimo.kind);
        flush(current, c);
        current = [];
        words = 0;
        if (tituloAlFinal) {
          current.push(ultimo);
          words += ultimo.words;
        }
      }
      current.push(block);
      words += block.words;
    }
    flush(current, c);
  }

  return pages;
}

/**
 * Parte bloques de texto gigantes (párrafos sin corte, defecto de algunos
 * conversores) por frases en trozos de ~EPUB_WORDS_PER_PAGE. Los párrafos que
 * cruzan páginas son un hecho natural de los libros de papel.
 */
export function splitLongTextBlocks(blocks: EpubBlock[]): EpubBlock[] {
  const out: EpubBlock[] = [];
  for (const b of blocks) {
    if (b.kind === "img" || b.words <= EPUB_SPLIT_BLOCK_WORDS) {
      out.push(b);
      continue;
    }
    const sentences = b.text.split(/(?<=[.!?…])\s+/).filter(Boolean);
    let buf = "";
    let bufWords = 0;
    const push = () => {
      if (!buf.trim()) return;
      out.push({
        kind: b.kind,
        html: escapeHtml(buf.trim()),
        text: buf.replace(/\s+/g, " ").trim(),
        words: bufWords,
      });
      buf = "";
      bufWords = 0;
    };
    for (const s of sentences) {
      const sw = s.split(/\s+/).filter(Boolean).length;
      // frase monstruosa sin puntos: entra entera (el paginador la tolera)
      if (bufWords > 0 && bufWords + sw > EPUB_WORDS_PER_PAGE) push();
      buf += (buf ? " " : "") + s;
      bufWords += sw;
    }
    push();
  }
  return out;
}

/** Texto plano de una página virtual: párrafos separados por «\n\n» (formato del motor VN). */
export function epubPageText(page: EpubPage | undefined): string {
  if (!page) return "";
  return page.blocks
    .filter((b): b is EpubTextBlock => b.kind !== "img")
    .map((b) => b.text)
    .filter((t) => t.trim().length > 0)
    .join("\n\n");
}

// ---------- Saneado de HTML inline (DOM, cliente) ----------

const INLINE_ALLOW = new Set(["EM", "I", "STRONG", "B", "SUP", "SUB", "BR"]);
const SKIP_ENTIRELY = new Set(["SCRIPT", "STYLE", "SVG", "LINK", "META", "HEAD", "AUDIO", "VIDEO", "IFRAME"]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Convierte el contenido inline de un nodo en html saneado + texto plano (+ imágenes aparte). */
function sanitizeInline(
  node: Node,
  io: { html: string; text: string; images: string[] },
  resolveImage: (el: HTMLImageElement) => string | null
) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent ?? "";
      if (t.trim().length === 0) return; // whitespace entre etiquetas: fuera
      io.html += escapeHtml(t);
      io.text += t;
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    if (SKIP_ENTIRELY.has(el.tagName)) return;
    if (el.tagName === "IMG") {
      const src = resolveImage(el as HTMLImageElement);
      if (src) io.images.push(src);
      return; // las imágenes saltan del flujo inline: vuelven como bloques propios
    }
    if (INLINE_ALLOW.has(el.tagName)) {
      const tag = el.tagName.toLowerCase();
      io.html += `<${tag}>`;
      sanitizeInline(el, io, resolveImage);
      io.html += `</${tag}>`;
    } else {
      // etiqueta no permitida (a, span, cite…): se conserva el texto, no la etiqueta
      sanitizeInline(el, io, resolveImage);
    }
  });
}

// ---------- Extracción de bloques desde un documento XHTML (DOM, cliente) ----------

const TEXT_KINDS: Record<string, EpubTextKind> = {
  H1: "h1", H2: "h2", H3: "h3", H4: "h4", H5: "h4", H6: "h4",
  P: "p", BLOCKQUOTE: "quote", LI: "li", PRE: "p", FIGCAPTION: "p", DT: "p", DD: "p",
};
/** etiquetas estructurales: se recorren en profundidad, no generan bloque propio */
const CONTAINER_TAGS = new Set([
  "DIV", "SECTION", "ARTICLE", "MAIN", "BODY", "HEADER", "FOOTER", "ASIDE",
  "FIGURE", "UL", "OL", "DL", "TABLE", "TR", "TD", "TH", "TBODY", "THEAD", "DETAILS",
]);

// ---------- Parseo del libro (DOM + JSZip, cliente) ----------

interface ManifestItem {
  id: string;
  href: string; // ruta resuelta dentro del zip
  mediaType: string;
  properties: string[];
}

function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Valor de un elemento de metadata Dublin Core: dc:title / dc:creator / title / creator. */
function dcValue(opf: Document, localName: string): string | null {
  const byQName = opf.getElementsByTagName(`dc:${localName}`);
  if (byQName.length > 0) return textOf(byQName[0]) || null;
  const metadata = opf.getElementsByTagName("metadata")[0] ?? opf.documentElement;
  for (const el of Array.from(metadata?.getElementsByTagName("*") ?? [])) {
    if (el.localName === localName) return textOf(el) || null;
  }
  return null;
}

/** Ruta absoluta dentro del zip a partir de un href relativo al documento base. */
function resolveInZip(basePath: string, href: string): string {
  try {
    return decodeURIComponent(new URL(href, `file:///${basePath}`).pathname).replace(/^\//, "");
  } catch {
    return href;
  }
}

function mimeOf(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "image/jpeg";
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

function isDocItem(item: ManifestItem): boolean {
  return (
    item.mediaType.includes("xhtml") ||
    item.mediaType.includes("html") ||
    item.href.endsWith(".xhtml") ||
    item.href.endsWith(".html") ||
    item.href.endsWith(".htm")
  );
}

/** OPF abierto y digerido: manifest, spine de lectura y rutas. */
interface OpfBundle {
  opf: Document;
  opfPath: string;
  manifest: Map<string, ManifestItem>;
  spineItems: ManifestItem[];
}

/** container.xml → OPF → manifest + spine. Falla con mensajes humanos. */
async function loadOpf(zip: JSZip): Promise<OpfBundle> {
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) throw new Error("El EPUB no trae container.xml: está mal empaquetado.");
  const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");
  const opfPath = containerDoc.getElementsByTagName("rootfile")[0]?.getAttribute("full-path");
  if (!opfPath) throw new Error("El EPUB no declara su fichero OPF.");

  const opfText = await zip.file(opfPath)?.async("string");
  if (!opfText) throw new Error("No se encontró el OPF declarado dentro del EPUB.");
  const opf = new DOMParser().parseFromString(opfText, "application/xml");
  if (opf.getElementsByTagName("parsererror").length > 0) {
    throw new Error("El OPF del EPUB está corrupto.");
  }
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const manifest = new Map<string, ManifestItem>();
  for (const item of Array.from(opf.getElementsByTagName("item"))) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (!id || !href) continue;
    manifest.set(id, {
      id,
      href: resolveInZip(opfDir, href),
      mediaType: item.getAttribute("media-type") ?? "",
      properties: (item.getAttribute("properties") ?? "").split(/\s+/).filter(Boolean),
    });
  }

  // spine (orden de lectura), saltando el nav mecánico de EPUB3
  const spineItems = Array.from(opf.getElementsByTagName("itemref"))
    .map((ref) => ref.getAttribute("idref"))
    .filter((id): id is string => !!id)
    .map((id) => manifest.get(id))
    .filter((item): item is ManifestItem => !!item && isDocItem(item) && !item.properties.includes("nav"));

  return { opf, opfPath, manifest, spineItems };
}

/** Portada del EPUB como dataURL en bruto (null si no hay o no es viable). */
async function readCoverDataUrl(zip: JSZip, bundle: OpfBundle): Promise<string | null> {
  const coverItem = findCoverItem(bundle.opf, bundle.manifest);
  if (!coverItem || coverItem.href.toLowerCase().endsWith(".svg")) return null;
  const entry = zip.file(coverItem.href);
  if (!entry || entry.name === bundle.opfPath) return null;
  try {
    const bytes = await entry.async("uint8array");
    if (bytes.length === 0 || bytes.length > EPUB_MAX_IMAGE_BYTES) return null;
    return bytesToDataUrl(bytes, mimeOf(entry.name));
  } catch {
    return null; // sin portada: la tarjeta usará su degradado de casa
  }
}

/** Bloques de un item del spine (null si no aporta contenido). */
async function extractChapter(zip: JSZip, item: ManifestItem): Promise<{ blocks: EpubBlock[]; docTitle: string | null } | null> {
  const raw = await zip.file(item.href)?.async("string");
  if (!raw) return null;
  const doc = new DOMParser().parseFromString(raw, "text/html");
  const root = doc.body ?? doc.documentElement;
  if (!root) return null;

  const io = { blocks: [] as EpubBlock[] };
  const resolveImage = (img: HTMLImageElement): string | null => {
    const src = img.getAttribute("src");
    if (!src) return null;
    if (src.startsWith("data:")) return src;
    const entry = zip.file(resolveInZip(item.href, src));
    return entry ? `@zip:${entry.name}` : null;
  };

  walkBlocks(root, 0, io, resolveImage);

  // resolver imágenes del zip (marcador @zip: → dataURL) y descartar las inviables
  for (let i = 0; i < io.blocks.length; i++) {
    const b = io.blocks[i];
    if (b.kind !== "img" || !b.src.startsWith("@zip:")) continue;
    const entry = zip.file(b.src.slice(5));
    let viable = !!entry;
    if (entry) {
      const bytes = await entry.async("uint8array");
      viable = bytes.length > 0 && bytes.length <= EPUB_MAX_IMAGE_BYTES;
      if (viable) b.src = bytesToDataUrl(bytes, mimeOf(entry.name));
    }
    if (!viable) {
      io.blocks.splice(i, 1);
      i--;
    }
  }

  if (io.blocks.length === 0) return null; // capítulo vacío (portada suelta, blancos)
  return { blocks: splitLongTextBlocks(io.blocks), docTitle: textOf(doc.querySelector("title")) || null };
}

/** Título de un capítulo: primer encabezado → <title> del documento → primer párrafo corto. */
function chapterTitle(blocks: EpubBlock[], docTitle: string | null, index: number): string {
  for (const b of blocks) {
    if (b.kind === "img") continue;
    if (b.kind === "h1" || b.kind === "h2" || b.kind === "h3") {
      const fromHeading = b.text.slice(0, 90);
      if (fromHeading) return fromHeading;
    }
  }
  if (docTitle) return docTitle;
  const first = blocks.find((b) => b.kind !== "img") as EpubTextBlock | undefined;
  if (first && first.words <= 10 && first.text) return first.text.slice(0, 90);
  return `Capítulo ${index + 1}`;
}

/** Índice: título y primera página de cada capítulo con contenido. */
function buildChapters(chaptersBlocks: EpubBlock[][], chaptersDocTitles: (string | null)[], pages: EpubPage[]): EpubChapter[] {
  const chapters: EpubChapter[] = [];
  let cursor = 0;
  for (let c = 0; c < chaptersBlocks.length; c++) {
    chapters.push({
      title: chapterTitle(chaptersBlocks[c], chaptersDocTitles[c] ?? null, c),
      page: cursor + 1,
    });
    cursor += pages.filter((p) => p.chapter === c).length;
  }
  return chapters;
}

/**
 * Abre un EPUB completo: metadata, capítulos (spine) y páginas virtuales.
 * Lanza Error con mensaje humano si el archivo no es un EPUB válido.
 */
export async function parseEpub(data: ArrayBuffer): Promise<EpubBook> {
  const zip = await JSZip.loadAsync(data).catch(() => {
    throw new Error("El archivo no es un ZIP legible (¿es un EPUB de verdad?).");
  });

  const bundle = await loadOpf(zip);
  const metaTitle = dcValue(bundle.opf, "title");
  const metaAuthor = dcValue(bundle.opf, "creator");
  const cover = await readCoverDataUrl(zip, bundle);

  // ---- bloques por capítulo ----
  const chaptersBlocks: EpubBlock[][] = [];
  const chaptersDocTitles: (string | null)[] = [];
  for (const item of bundle.spineItems) {
    const chapter = await extractChapter(zip, item);
    if (!chapter) continue;
    chaptersBlocks.push(chapter.blocks);
    chaptersDocTitles.push(chapter.docTitle);
  }

  if (chaptersBlocks.length === 0) {
    throw new Error("Este EPUB no trae texto legible (¿solo imágenes?).");
  }

  const pages = paginateEpub(chaptersBlocks);
  const chapters = buildChapters(chaptersBlocks, chaptersDocTitles, pages);

  return { title: metaTitle, author: metaAuthor, pages, chapters, cover };
}

function findCoverItem(opf: Document, manifest: Map<string, ManifestItem>): ManifestItem | null {
  for (const item of manifest.values()) {
    if (item.properties.includes("cover-image")) return item;
  }
  for (const meta of Array.from(opf.getElementsByTagName("meta"))) {
    if (meta.getAttribute("name") === "cover") {
      const id = meta.getAttribute("content");
      if (id && manifest.has(id)) return manifest.get(id)!;
    }
  }
  return manifest.get("cover") ?? null;
}

function walkBlocks(
  node: Node,
  depth: number,
  io: { blocks: EpubBlock[] },
  resolveImage: (el: HTMLImageElement) => string | null
) {
  if (depth > 24) return; // muro anti-matryoshka
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      // texto suelto fuera de <p> (EPUBs artesanales): párrafo implícito
      const t = (child.textContent ?? "").trim();
      if (t.length >= 3) {
        io.blocks.push({ kind: "p", html: escapeHtml(t), text: t, words: t.split(/\s+/).length });
      }
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    if (SKIP_ENTIRELY.has(el.tagName)) return;

    if (el.tagName === "IMG") {
      const src = resolveImage(el as HTMLImageElement);
      if (src) {
        io.blocks.push({ kind: "img", src, alt: el.getAttribute("alt") ?? "", words: EPUB_IMAGE_WORDS });
      }
      return;
    }

    const kind = TEXT_KINDS[el.tagName];
    if (kind && !CONTAINER_TAGS.has(el.tagName)) {
      const inline = { html: "", text: "", images: [] as string[] };
      sanitizeInline(el, inline, resolveImage);
      const clean = inline.text.replace(/\s+/g, " ").trim();
      const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
      if (words > 0 || /<br/i.test(inline.html)) {
        io.blocks.push({ kind, html: inline.html.trim(), text: clean, words });
      }
      // imágenes embebidas en el párrafo: vuelven como bloques tras el texto
      for (const src of inline.images) {
        io.blocks.push({ kind: "img", src, alt: "", words: EPUB_IMAGE_WORDS });
      }
      return;
    }

    // contenedor estructural: recursión
    walkBlocks(el, depth + 1, io, resolveImage);
  });
}

// ---------- Probe de subida (cliente) ----------

/**
 * Analiza un EPUB para el diálogo de subida: páginas virtuales, portada
 * normalizada a PNG (máx 640px de alto) y título/autor de la metadata.
 */
export async function probeEpub(file: File): Promise<EpubProbe> {
  const book = await parseEpub(await file.arrayBuffer());
  const coverDataUrl = book.cover ? await normalizeCover(book.cover) : null;
  return {
    numPages: book.pages.length,
    coverDataUrl,
    title: book.title,
    author: book.author,
  };
}

/** Portada a PNG de tamaño contenido (canvas), igual que la genera el probe del PDF. */
async function normalizeCover(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxH = 640;
      const scale = Math.min(1, maxH / img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
