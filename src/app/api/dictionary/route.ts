import { NextRequest, NextResponse } from "next/server";
import type { DictEntry, DictionaryResult } from "@/lib/types";

/**
 * Proxy de diccionario gratuito (sin API key):
 *  - Español: rae-api.com (definiciones de la RAE) con fallback a dictionaryapi.dev/es
 *  - Inglés:  dictionaryapi.dev (Wiktionary)
 * Respuesta normalizada + caché en memoria.
 */

const cache = new Map<string, DictionaryResult>();
const CACHE_MAX = 300;

interface RaeSense {
  raw?: string;
  category?: string;
  gender?: string;
  description?: string;
  examples?: string[];
  synonyms?: string[] | null;
}

interface RaeMeaning {
  origin?: { raw?: string } | null;
  senses?: RaeSense[] | null;
}

interface RaeResponse {
  ok?: boolean;
  error?: string;
  suggestions?: string[] | null;
  data?: { word?: string; meanings?: RaeMeaning[] };
}

interface WikEntry {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }>;
}

const POS_ES: Record<string, string> = {
  noun: "sustantivo",
  adjective: "adjetivo",
  verb: "verbo",
  adverb: "adverbio",
  pronoun: "pronombre",
  preposition: "preposición",
  conjunction: "conjunción",
  interjection: "interjección",
};

async function fetchJson(url: string, timeoutMs = 6500): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "RielReader/1.0 (dictionary proxy)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function cleanRaw(raw: string): string {
  return raw.replace(/^\s*\d+\.\s*/, "").replace(/\s*Sin\.:.*$/, "").trim();
}

/** Español: RAE primero, dictionaryapi.dev/es de respaldo */
async function lookupEs(word: string): Promise<DictionaryResult> {
  const data = (await fetchJson(
    `https://rae-api.com/api/words/${encodeURIComponent(word.toLowerCase())}`
  )) as RaeResponse | null;

  if (data?.ok && data.data?.meanings?.length) {
    const entries: DictEntry[] = data.data.meanings
      .map((m) => {
        const senses = m.senses ?? [];
        const first = senses[0];
        const posBits = [first?.category ? POS_ES[first.category] ?? first.category : "", first?.gender ? ` ${first.gender}` : ""]
          .join("")
          .trim();
        return {
          pos: posBits || "definición",
          defs: senses
            .slice(0, 4)
            .map((s) => ({
              d: s.description?.trim() || cleanRaw(s.raw ?? ""),
              ex: s.examples?.[0],
            }))
            .filter((d) => d.d.length > 0),
          synonyms: first?.synonyms?.slice(0, 6) ?? undefined,
        };
      })
      .filter((e) => e.defs.length > 0);

    if (entries.length > 0) {
      return {
        word,
        lang: "es",
        found: true,
        origin: data.data.meanings[0]?.origin?.raw ?? undefined,
        entries,
        source: "RAE (rae-api.com)",
      };
    }
  }

  // Respaldo español: dictionaryapi.dev
  const alt = await lookupDictionaryApi(word, "es");
  if (alt.found) return alt;
  return {
    word,
    lang: "es",
    found: false,
    entries: [],
    source: "RAE (rae-api.com)",
  };
}

/** dictionaryapi.dev (Wiktionary); si falla o no conoce la palabra, Datamuse (WordNet) */
async function lookupDictionaryApi(word: string, lang: "es" | "en"): Promise<DictionaryResult> {
  const primary = await lookupWiktionary(word, lang);
  if (primary.found) return primary;
  if (lang === "en") {
    const fallback = await lookupDatamuse(word);
    if (fallback.found) return fallback;
  }
  return { word, lang, found: false, entries: [], source: "dictionaryapi.dev" };
}

async function lookupWiktionary(word: string, lang: "es" | "en"): Promise<DictionaryResult> {
  const arr = (await fetchJson(
    `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word.toLowerCase())}`
  )) as WikEntry[] | null;

  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr[0];
    const audio = first.phonetics?.find((p) => p.audio && p.audio.length > 0)?.audio;
    const entries: DictEntry[] = (first.meanings ?? [])
      .slice(0, 5)
      .map((m) => ({
        pos: m.partOfSpeech ?? "",
        defs: (m.definitions ?? [])
          .slice(0, 4)
          .map((d) => ({ d: d.definition?.trim() ?? "", ex: d.example?.trim() || undefined }))
          .filter((d) => d.d.length > 0),
      }))
      .filter((e) => e.defs.length > 0);

    if (entries.length > 0) {
      return {
        word: first.word ?? word,
        lang,
        found: true,
        phonetic: first.phonetic ?? undefined,
        audio,
        entries,
        source: "Wiktionary (dictionaryapi.dev)",
      };
    }
  }
  return { word, lang, found: false, entries: [], source: "dictionaryapi.dev" };
}

const DATAMUSE_POS: Record<string, string> = {
  n: "noun",
  v: "verb",
  adj: "adjective",
  adv: "adverb",
  u: "",
};

/** Datamuse (WordNet): respaldo gratuito y estable sin API key */
async function lookupDatamuse(word: string): Promise<DictionaryResult> {
  const arr = (await fetchJson(
    `https://api.datamuse.com/words?sp=${encodeURIComponent(word.toLowerCase())}&md=d&max=3`
  )) as Array<{ word?: string; defs?: string[] }> | null;

  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr.find((a) => a.defs && a.defs.length > 0) ?? arr[0];
    if (first.defs?.length) {
      const byPos = new Map<string, string[]>();
      for (const raw of first.defs) {
        const [posCode, text] = raw.split(/\t/, 2);
        if (!text) continue;
        const pos = DATAMUSE_POS[posCode] ?? "";
        const list = byPos.get(pos) ?? [];
        if (list.length < 4) list.push(text.trim());
        byPos.set(pos, list);
      }
      const entries: DictEntry[] = [...byPos.entries()]
        .slice(0, 4)
        .map(([pos, defs]) => ({ pos, defs: defs.map((d) => ({ d })) }));
      if (entries.length > 0) {
        return {
          word: first.word ?? word,
          lang: "en",
          found: true,
          entries,
          source: "WordNet (Datamuse)",
        };
      }
    }
  }
  return { word, lang: "en", found: false, entries: [], source: "Datamuse" };
}

export async function GET(req: NextRequest) {
  const wordRaw = req.nextUrl.searchParams.get("word") ?? "";
  const langParam = req.nextUrl.searchParams.get("lang") ?? "auto";
  const word = wordRaw.trim().toLowerCase().slice(0, 60);

  if (!word || !/[a-záéíóúñü]/i.test(word)) {
    return NextResponse.json({ error: "Palabra inválida" }, { status: 400 });
  }

  const cacheKey = `${langParam}:${word}`;
  const hit = cache.get(cacheKey);
  if (hit) return NextResponse.json(hit);

  // Detección de idioma: marcas españolas → es; si no, inglés primero
  const looksSpanish = /[ñáéíóúü¿¡]/.test(word);

  let final: DictionaryResult;
  if (langParam === "es") {
    final = await lookupEs(word);
  } else if (langParam === "en") {
    final = await lookupDictionaryApi(word, "en");
  } else {
    // Auto: consulta ambos idiomas en paralelo y prioriza el español (con
    // acentos o no): es lo que se lee aquí; el inglés entra como respaldo.
    // Si la palabra claramente parece inglesa (y no existe en es), igual
    // termina en en. Una sola ida y vuelta, sin penalización notable.
    const [es, en] = await Promise.all([lookupEs(word), lookupDictionaryApi(word, "en")]);
    const spanishPriority = looksSpanish || es.found || !en.found;
    final = spanishPriority ? (es.found ? es : en) : en;
  }

  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(cacheKey, final);
  return NextResponse.json(final);
}
