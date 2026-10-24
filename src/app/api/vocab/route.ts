import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Vocabulario en la BD (es data de la dueña, no configuración).
 * GET → lista (500 máx, como siempre en la casa), más nuevas primero.
 * POST → inserta si no existe ya (palabra+idioma); devuelve la entrada viva.
 */
export async function GET() {
  try {
    const rows = await db.vocab.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json({
      vocabulary: rows.map((v) => ({
        id: v.id,
        word: v.word,
        lang: v.lang === "en" ? "en" : "es",
        short: v.short,
        bookId: v.bookId ?? "",
        bookTitle: v.bookTitle,
        page: v.page,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("GET /api/vocab", e);
    return NextResponse.json({ error: "No se pudo leer el vocabulario" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string;
      word?: string;
      lang?: string;
      short?: string;
      bookId?: string;
      bookTitle?: string;
      page?: number;
    };
    const word = (body.word ?? "").trim();
    if (!word) return NextResponse.json({ error: "Falta la palabra" }, { status: 400 });
    const lang = body.lang === "en" ? "en" : "es";

    // sin duplicados: palabra+idioma, sin importar la caja. SQLite compara
    // el caso exacto, así que la comparación se hace en JS sobre las palabras
    // del idioma (el vocabulario de una lectora cabe en memoria sin sudar).
    const palabras = await db.vocab.findMany({ where: { lang }, select: { word: true } });
    const lower = word.toLowerCase();
    const existente = palabras.find((p) => p.word.toLowerCase() === lower);
    if (existente) {
      const fila = await db.vocab.findFirst({ where: { word: existente.word, lang } });
      if (fila) return NextResponse.json({ entry: aEntry(fila), duplicated: true });
    }

    try {
      const creado = await db.vocab.create({
        data: {
          id: body.id && body.id.length <= 32 ? body.id : undefined,
          word,
          lang,
          short: (body.short ?? "").slice(0, 2000),
          bookId: body.bookId && body.bookId !== "" ? body.bookId.slice(0, 64) : null,
          bookTitle: (body.bookTitle ?? "").slice(0, 200),
          page: Number.isFinite(body.page) ? Math.max(1, Math.round(Number(body.page))) : 1,
        },
      });
      return NextResponse.json({ entry: aEntry(creado) }, { status: 201 });
    } catch (e2) {
      // carrera rara (dos pestañas a la vez): existe ya → se devuelve la viva
      const otraVez = palabras.find((p) => p.word.toLowerCase() === lower);
      if (otraVez) {
        const fila = await db.vocab.findFirst({ where: { word: otraVez.word, lang } });
        if (fila) return NextResponse.json({ entry: aEntry(fila), duplicated: true });
      }
      console.error("POST /api/vocab", e2);
      return NextResponse.json({ error: "No se pudo guardar la palabra" }, { status: 500 });
    }
  } catch (e) {
    console.error("POST /api/vocab", e);
    return NextResponse.json({ error: "No se pudo guardar la palabra" }, { status: 500 });
  }
}

function aEntry(v: {
  id: string;
  word: string;
  lang: string;
  short: string;
  bookId: string | null;
  bookTitle: string;
  page: number;
  createdAt: Date;
}) {
  return {
    id: v.id,
    word: v.word,
    lang: v.lang === "en" ? ("en" as const) : ("es" as const),
    short: v.short,
    bookId: v.bookId ?? "",
    bookTitle: v.bookTitle,
    page: v.page,
    createdAt: v.createdAt.toISOString(),
  };
}
