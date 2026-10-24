import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { escribirAjustes, leerAjustes } from "@/lib/config-file";
import { carpetaValida, escanearCarpeta, ResumenEscaneo } from "@/lib/library-folder";

/**
 * Escaneo de la biblioteca por carpeta (change cfg-y-biblioteca-por-carpeta).
 *
 * POST { carpeta? }:
 *  - con `carpeta` → valida (ruta absoluta, existe, es carpeta) y la guarda en
 *    `biblioteca.carpeta` del fichero de config.
 *  - sin → re-escanea la carpeta guardada.
 * En ambos casos devuelve el resumen del pase (añadidos, re-vínculos,
 * «sin fichero», actualizaciones, duplicados). Solo se LEE de la carpeta.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { carpeta?: string };
    const cfg = await leerAjustes();

    let resuelta: string;
    if (body.carpeta && body.carpeta.trim() !== "") {
      const veredicto = await carpetaValida(body.carpeta.trim());
      if (!veredicto.ok || !veredicto.resuelta) {
        return NextResponse.json({ error: veredicto.error }, { status: 400 });
      }
      resuelta = veredicto.resuelta;
      if (resuelta !== cfg.biblioteca.carpeta) {
        await escribirAjustes(cfg.settings, { carpeta: resuelta }, cfg._doc);
      }
    } else {
      if (!cfg.biblioteca.carpeta) {
        return NextResponse.json({ error: "Aún no hay carpeta elegida" }, { status: 400 });
      }
      // la carpeta guardada puede haber dejado de existir: se revalida igual
      const veredicto = await carpetaValida(cfg.biblioteca.carpeta);
      if (!veredicto.ok || !veredicto.resuelta) {
        return NextResponse.json({ error: veredicto.error }, { status: 400 });
      }
      resuelta = veredicto.resuelta;
    }

    const resumen: ResumenEscaneo = await escanearCarpeta(resuelta);
    // el badge y el conteo de la biblioteca viven en GET /api/books
    const total = await db.book.count({ where: { origin: "carpeta" } });
    return NextResponse.json({ resumen, total });
  } catch (e) {
    console.error("POST /api/library/scan", e);
    return NextResponse.json({ error: "El escaneo falló" }, { status: 500 });
  }
}
