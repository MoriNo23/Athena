/** Inspección de paginación del EPUB real del usuario (Sofía) — caza bichos determinista */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
const win = new Window();
(globalThis as Record<string, unknown>).DOMParser = win.DOMParser;
(globalThis as Record<string, unknown>).Node = win.Node;
(globalThis as Record<string, unknown>).Element = win.Element;
(globalThis as Record<string, unknown>).XMLSerializer = win.XMLSerializer;
const { parseEpub } = await import("../src/lib/epub");

const FILE = process.argv[2] ?? new URL("../public/uploads/b22e6746c71a942b1.epub", import.meta.url).pathname;

async function main() {
  const t0 = Date.now();
  const bytes = readFileSync(FILE);
  const epub = await parseEpub(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const ms = Date.now() - t0;
  console.log(`parse: ${ms}ms · capítulos: ${epub.chapters.length} · páginas: ${epub.pages.length}`);
  console.log(`título: ${epub.title ?? "?"} · autor: ${epub.author ?? "?"} · portada: ${epub.cover ? "sí" : "NO"}`);

  let imgOnly = 0, empty = 0, wordsTotal = 0, imgsTotal = 0;
  const kinds: Record<string, number> = {};
  for (const p of epub.pages) {
    const kindsHere = new Set(p.blocks.map(b => b.kind));
    for (const b of p.blocks) kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
    const hasText = p.blocks.some(b => b.kind !== "img");
    const words = p.blocks.reduce((n, b) => n + (b.kind === "img" ? 0 : (b.html?.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length ?? 0)), 0);
    wordsTotal += words;
    imgsTotal += p.blocks.filter(b => b.kind === "img").length;
    if (!hasText) imgOnly++;
    if (p.blocks.length === 0) empty++;
  }
  console.log(`bloques por tipo:`, kinds);
  console.log(`páginas solo-imagen: ${imgOnly} · vacías: ${empty} · palabras: ${wordsTotal} · imgs: ${imgsTotal}`);
  console.log(`media palabras/página: ${(wordsTotal / epub.pages.length).toFixed(1)}`);

  // primeras 10 páginas en detalle
  for (let i = 0; i < 10 && i < epub.pages.length; i++) {
    const p = epub.pages[i];
    const desc = p.blocks.map(b => b.kind === "img" ? "img" : `${b.kind}:${(b.html ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 40)}`).join(" | ").slice(0, 150);
    console.log(`p${i + 1}: ${desc}`);
  }

  // distribución: páginas más largas / más cortas (texto)
  const wordsPerPage = epub.pages.map(p => p.blocks.reduce((n, b) => n + (b.kind === "img" ? 0 : (b.html?.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length ?? 0)), 0));
  const sorted = [...wordsPerPage].sort((a, b) => a - b);
  console.log(`percentiles palabras/página: min=${sorted[0]} p25=${sorted[Math.floor(sorted.length * .25)]} mediana=${sorted[Math.floor(sorted.length / 2)]} p75=${sorted[Math.floor(sorted.length * .75)]} max=${sorted[sorted.length - 1]}`);
  const overCap = wordsPerPage.filter(w => w > 520).length;
  console.log(`páginas sobre el tope 520 palabras: ${overCap}`);
}

main().catch(e => { console.error("FALLO:", e); process.exit(1); });
