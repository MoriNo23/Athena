import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Importación one-shot del vocabulario viejo (eco en localStorage) a la BD
 * (change cfg-y-biblioteca-por-carpeta, migración de instalación). Idempotente:
 * se salta lo que ya existe (palabra+idioma).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { entries?: unknown };
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) return NextResponse.json({ imported: 0 });
    // la importación es one-shot desde el eco local; más que esto ya no es eco
    if (entries.length > 1000) {
      return NextResponse.json({ error: "Demasiadas entradas (máx 1000)" }, { status: 413 });
    }

    const existentes = await db.vocab.findMany({
      select: { word: true, lang: true },
    });
    const clave = (w: string, l: string) => `${l}\u0000${w.toLowerCase()}`;
    const yaEstan = new Set(existentes.map((v) => clave(v.word, v.lang)));

    // saneo y desduplicado local (por si el eco ya traía repetidas)
    const vistos = new Set<string>();
    const data: {
      word: string;
      lang: string;
      short: string;
      bookId: string | null;
      bookTitle: string;
      page: number;
    }[] = [];
    for (const e of entries as Record<string, unknown>[]) {
      const word = typeof e.word === "string" ? e.word.trim().slice(0, 200) : "";
      const lang = e.lang === "en" ? "en" : "es";
      if (!word) continue;
      const k = clave(word, lang);
      if (yaEstan.has(k) || vistos.has(k)) continue;
      vistos.add(k);
      data.push({
        word,
        lang,
        short: typeof e.short === "string" ? e.short.slice(0, 2000) : "",
        bookId: typeof e.bookId === "string" && e.bookId !== "" ? e.bookId.slice(0, 64) : null,
        bookTitle: typeof e.bookTitle === "string" ? e.bookTitle.slice(0, 200) : "",
        page: Number.isFinite(e.page) ? Math.max(1, Math.round(Number(e.page))) : 1,
      });
    }

    let imported = 0;
    if (data.length > 0) {
      const res = await db.vocab.createMany({ data });
      imported = res.count;
    }
    return NextResponse.json({ imported });
  } catch (e) {
    console.error("POST /api/vocab/import", e);
    return NextResponse.json({ error: "No se pudo importar el vocabulario" }, { status: 500 });
  }
}
