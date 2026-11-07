import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leerAjustes, escribirAjustes, saneaAjustes } from "@/core/config-file";
import { preflightSync, cabecerasSync } from "@/lib/cors";
import { vocabSano } from "@/core/sync";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return preflightSync(req);
}

/**
 * POST /api/sync/meta — ajustes y vocabulario de la copia (Enmienda 1: «el
 * dispositivo que manda»). JSON: { settings?, vocab? }.
 *
 * - settings: llegan saneados al `db/config.json` (la `biblioteca` y la `_doc`
 *   del receptor se quedan: son de ESTA máquina).
 * - vocab: reemplazo limpio por «el que manda», con el mismo dedupe
 *   palabra+idioma sin caja que la ruta /api/vocab y el tope de 500 de la casa.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { settings?: unknown; vocab?: unknown };

    if (body.settings !== undefined) {
      const actual = await leerAjustes();
      const settings = saneaAjustes(body.settings);
      await escribirAjustes(settings, actual.biblioteca, actual._doc);
    }

    if (body.vocab !== undefined) {
      const filas = vocabSano(body.vocab);
      const vista = new Set<string>();
      const unicas = filas.filter((v) => {
        const clave = `${v.word.toLowerCase()}|${v.lang}`;
        if (vista.has(clave)) return false;
        vista.add(clave);
        return true;
      });
      await db.$transaction([
        db.vocab.deleteMany({}),
        ...unicas.map((v) =>
          db.vocab.create({
            data: {
              word: v.word,
              lang: v.lang,
              short: v.short,
              bookId: v.bookId ?? null,
              bookTitle: v.bookTitle,
              page: v.page,
              ...(v.createdAt ? { createdAt: new Date(v.createdAt) } : {}),
            },
          })
        ),
      ]);
    }

    return NextResponse.json({ ok: true }, { headers: cabecerasSync(req) });
  } catch (e) {
    console.error("POST /api/sync/meta", e);
    return NextResponse.json({ error: "La copia de ajustes/vocabulario falló" }, { status: 500, headers: cabecerasSync(req) });
  }
}
