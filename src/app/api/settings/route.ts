import { NextRequest, NextResponse } from "next/server";
import { escribirAjustes, leerAjustes, saneaAjustes, docPorDefecto } from "@/lib/config-file";

/**
 * Fuente única de ajustes: `db/config.json` (change cfg-y-biblioteca-por-carpeta).
 *
 * GET → los ajustes validados + la carpeta de biblioteca + la `_doc` viva +
 *       `created: true` la primera vez (el cliente usa esa señal para subir la
 *       instalación vieja de localStorage y migrar el vocab a la BD).
 * PUT → escribe lo llegado (ya saneado) y devuelve el mismo estado: el panel
 *       nunca manda basura al fichero. El vocabulario NO pasa por aquí.
 */
export async function GET() {
  try {
    const cfg = await leerAjustes();
    return NextResponse.json({
      settings: cfg.settings,
      biblioteca: cfg.biblioteca,
      _doc: Object.keys(cfg._doc).length > 0 ? cfg._doc : docPorDefecto(),
      created: cfg.created,
    });
  } catch (e) {
    console.error("GET /api/settings", e);
    return NextResponse.json({ error: "No se pudo leer la configuración" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      settings?: unknown;
      biblioteca?: { carpeta?: string };
      _doc?: Record<string, string>;
    };
    const actual = await leerAjustes();

    // biblioteca: solo toca si llega (el panel no la edita; la edita el scanner)
    let biblioteca = actual.biblioteca;
    if (body.biblioteca && typeof body.biblioteca === "object") {
      const carpeta = body.biblioteca.carpeta;
      if (typeof carpeta === "string") biblioteca = { carpeta: carpeta.slice(0, 1024) };
    }

    // _doc: la que manda es la del fichero vivo; si la llegada trae edits, se aceptan
    const doc =
      body._doc && Object.keys(body._doc).length > 0
        ? { ...docPorDefecto(), ...limpiaDoc(body._doc) }
        : actual._doc;

    const settings = saneaAjustes(body.settings ?? actual.settings);
    await escribirAjustes(settings, biblioteca, doc);

    // señal primitiva de instalación ya migrada: el fichero existe tras el PUT
    return NextResponse.json({ ok: true, settings, biblioteca });
  } catch (e) {
    console.error("PUT /api/settings", e);
    return NextResponse.json({ error: "No se pudo guardar la configuración" }, { status: 500 });
  }
}

/** La _doc solo acepta strings (es data, no código). */
function limpiaDoc(d: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === "string") out[k] = v.slice(0, 2000);
  }
  return out;
}
