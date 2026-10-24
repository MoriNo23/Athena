import { createHash } from "crypto";
import { open, readdir, readFile, stat } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

/**
 * Biblioteca por carpeta (change cfg-y-biblioteca-por-carpeta).
 *
 * Los libros se REGISTRAN EN SU SITIO: `filePath` apunta al fichero real de la
 * dueña y desde aquí solo se LEE (stat, hash, cabecera para contar páginas).
 * Jamás se mueve, renombra ni escribe: la carpeta es territorio ajeno — la app
 * es un catálogo que la mira, no un dueño que la ordena.
 */

const EXTS = new Set([".pdf", ".epub"]);
const MAX_FILE = 200 * 1024 * 1024; // mismo tope que las subidas

export interface ResumenEscaneo {
  carpeta: string;
  ficheros: number;
  anadidos: string[];
  relinkados: { title: string; nuevaRuta: string }[];
  sinFichero: string[];
  reaparecidos: string[];
  actualizados: { title: string; paginasAntes: number; paginasAhora: number; recorte: boolean }[];
  duplicados: string[];
}

/** ————— conteo de páginas de PDF sin dependencias —————
    Cuenta `/Type /Page` (sin /Pages) en la capa bruta del fichero; si el PDF
    trae object streams comprimidos, cae al `/Count` más alto de un /Pages.
    Si nada de eso existe → 0 (desconocido): el lector hace PATCH de
    totalPages al primer abrir y la fila queda fiel desde entonces. */
export async function paginasDePdf(ruta: string): Promise<number> {
  try {
    const fh = await open(/* turbopackIgnore: true */ ruta, "r");
    try {
      const st = await fh.stat();
      // base: cabecera (donde suele vivir el /Pages raíz) + cola por si va al final
      const head = Math.min(st.size, 4 * 1024 * 1024);
      const tail = st.size > 4 * 1024 * 1024 ? Math.min(2 * 1024 * 1024, st.size - head) : 0;
      const buf = Buffer.alloc(head + tail);
      await fh.read(buf, 0, head, 0);
      if (tail > 0) {
        await fh.read(buf, head, tail, st.size - tail);
      }
      const txt = buf.toString("latin1");
      const directos = (txt.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      if (directos > 0) return directos;
      let porCount = 0;
      for (const m of txt.matchAll(/\/Count\s+(\d+)/g)) {
        const n = parseInt(m[1], 10);
        if (n > porCount) porCount = n;
      }
      return porCount;
    } finally {
      await fh.close();
    }
  } catch {
    return 0; // se movió mientras escaneábamos: el primer abrir decidirá
  }
}

/** ————— ficha deducida ————— */

/** `Mi libro favorito.pdf` → «Mi libro favorito». Limpia separadores sin
    toquetear mayúsculas: el título se corrige a mano si molesta. */
export function tituloDeNombre(nombreFichero: string): string {
  const base = nombreFichero.replace(/\.(pdf|epub)$/i, "").trim();
  const limpio = base.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();
  return limpio || nombreFichero;
}

/** sidecar opcional: `<nombre>.ficha.txt` junto al libro.
    Línea 1 = título · línea 2 = autor (acepta prefijos «Autor:»/«Author:»). */
async function fichaSidecar(dir: string, nombreFichero: string): Promise<{ title: string; author: string | null }> {
  const stem = nombreFichero.replace(/\.(pdf|epub)$/i, "");
  const candidatos = [path.join(dir, stem + ".ficha.txt"), path.join(dir, stem + "-ficha.txt")];
  for (const ruta of candidatos) {
    try {
      const txt = (await readFile(/* turbopackIgnore: true */ ruta, "utf8")).trim();
      const lineas = txt
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lineas.length === 0) continue;
      let author: string | null = null;
      if (lineas[1]) {
        const m = lineas[1].match(/^(?:Autor(?:a)?|Author)\s*:\s*(.+)/i);
        author = m ? m[1].trim() : lineas[1];
      }
      return { title: lineas[0], author };
    } catch {
      // sin sidecar: bien — se deduce del nombre
    }
  }
  return { title: tituloDeNombre(nombreFichero), author: null };
}

/** sha256 en stream (los libros son gordos; no se cargan en RAM). */
export async function hashDe(ruta: string): Promise<string | null> {
  try {
    const fh = await open(/* turbopackIgnore: true */ ruta, "r");
    try {
      const h = createHash("sha256");
      const buf = Buffer.alloc(1024 * 1024);
      for (;;) {
        const { bytesRead } = await fh.read(buf, 0, buf.length, null);
        if (bytesRead === 0) break;
        h.update(bytesRead < buf.length ? buf.subarray(0, bytesRead) : buf);
      }
      return h.digest("hex");
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }
}

interface Huella {
  bytes: number;
  mtimeMs: number;
}

/** Recolecta: recursivo, sin ocultos, solo ficheros PDF/EPUB. */
async function recolectar(root: string): Promise<Map<string, Huella>> {
  const out = new Map<string, Huella>();
  const seguir = async (dir: string, depth: number): Promise<void> => {
    if (depth > 12) return; // profundidad razonable; nadie tiene biblioteca más
    let entries: import("fs").Dirent[];
    try {
      entries = await readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true });
    } catch {
      return; // sin permiso en esta rama: se mira la que sí
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await seguir(full, depth + 1);
      } else if (e.isFile() && EXTS.has(path.extname(e.name).toLowerCase()) && e.name.length < 240) {
        try {
          const st = await stat(/* turbopackIgnore: true */ full);
          if (st.isFile() && st.size > 0 && st.size <= MAX_FILE) {
            out.set(full, { bytes: st.size, mtimeMs: Math.round(st.mtimeMs) });
          }
        } catch {
          // fugaz: absent al stat — el escaneo no registra nada por él
        }
      }
    }
  };
  await seguir(root, 0);
  return out;
}

/** ————— el escaneo propiamente dicho —————
 * Lo nuevo entra; lo que cambió de sitio se re-vincula solo si su huella lo
 * delata; lo que ya no está pasa a «sin fichero» con el progreso intacto; lo
 * que cambió de contenido recalcula páginas con clamp honesto. Nada se borra
 * de la BD: fiel a la carpeta es el estado del fichero, no la vida de la dueña.
 */
export async function escanearCarpeta(carpeta: string): Promise<ResumenEscaneo> {
  const resumen: ResumenEscaneo = {
    carpeta,
    ficheros: 0,
    anadidos: [],
    relinkados: [],
    sinFichero: [],
    reaparecidos: [],
    actualizados: [],
    duplicados: [],
  };

  const encontrados = await recolectar(carpeta);
  resumen.ficheros = encontrados.size;

  const rows = await db.book.findMany({ where: { origin: "carpeta" } });
  const porRuta = new Map(rows.map((r) => [r.filePath, r]));
  // filas cuyo fichero ya no está dentro de la carpeta escaneada
  const huespedesAusentes = rows.filter((r) => !encontrados.has(r.filePath));
  const porHash = new Map<string, string[]>();
  for (const r of huespedesAusentes) {
    if (r.fileHash) {
      porHash.set(r.fileHash, (porHash.get(r.fileHash) ?? []).concat(r.id));
    }
  }

  const autonvinculadas = new Set<string>(); // filas ya re-vinculadas en este pase

  for (const [ruta, huella] of encontrados) {
    const filaViva = porRuta.get(ruta);

    if (filaViva) {
      // misma ruta: ¿sigue siendo el mismo fichero? (barato: bytes+mtime)
      const sinCambios = filaViva.fileBytes === huella.bytes && filaViva.fileMtime === huella.mtimeMs;
      if (sinCambios) {
        if (filaViva.fileMissingAt) {
          await db.book.update({ where: { id: filaViva.id }, data: { fileMissingAt: null } });
          resumen.reaparecidos.push(filaViva.title);
        }
        continue;
      }
      // cambió: hash nuevo + páginas recalculadas (reemplazo de versión)
      const nuevoHash = await hashDe(ruta);
      const nuevasPaginas = ruta.toLowerCase().endsWith(".pdf") ? await paginasDePdf(ruta) : 0;
      const antes = filaViva.totalPages;
      const recorte = antes > 0 && nuevasPaginas > 0 && nuevasPaginas < antes;
      const currentPage =
        recorte && filaViva.currentPage > nuevasPaginas ? Math.max(1, nuevasPaginas) : filaViva.currentPage;
      await db.book.update({
        where: { id: filaViva.id },
        data: {
          fileHash: nuevoHash ?? filaViva.fileHash,
          fileBytes: huella.bytes,
          fileMtime: huella.mtimeMs,
          fileMissingAt: null,
          ...(nuevasPaginas > 0 ? { totalPages: nuevasPaginas, currentPage } : {}),
        },
      });
      if (nuevasPaginas > 0 && nuevasPaginas !== antes) {
        resumen.actualizados.push({
          title: filaViva.title,
          paginasAntes: antes,
          paginasAhora: nuevasPaginas,
          recorte,
        });
      }
      continue;
    }

    // ruta nueva en la carpeta: ¿es un libro que cambió de sitio?
    const nuevoHash = await hashDe(ruta);
    if (nuevoHash) {
      const candidatas = porHash.get(nuevoHash) ?? [];
      const viva = candidatas.find((id) => !autonvinculadas.has(id));
      if (viva) {
        const fila = huespedesAusentes.find((r) => r.id === viva)!;
        await db.book.update({
          where: { id: viva },
          data: { filePath: ruta, fileBytes: huella.bytes, fileMtime: huella.mtimeMs, fileMissingAt: null },
        });
        autonvinculadas.add(viva);
        resumen.relinkados.push({ title: fila.title, nuevaRuta: ruta });
        continue;
      }
      // duplicado de contenido con otra fila registrada (misma huella, otra ruta)
      const duplicada = rows.find((r) => r.id !== viva && r.fileHash === nuevoHash);
      if (duplicada) {
        resumen.duplicados.push(duplicada.title);
        continue;
      }
    }

    // ficha: sidecar → nombre del fichero
    const ficha = await fichaSidecar(path.dirname(ruta), path.basename(ruta));
    const paginas = ruta.toLowerCase().endsWith(".pdf") ? await paginasDePdf(ruta) : 0;
    await db.book.create({
      data: {
        title: ficha.title,
        author: ficha.author,
        fileName: path.basename(ruta),
        filePath: ruta,
        coverPath: null,
        totalPages: paginas, // EPUB y PDF opacos: 0 → lo aprende el lector al abrir
        currentPage: 1,
        origin: "carpeta",
        fileHash: nuevoHash,
        fileBytes: huella.bytes,
        fileMtime: huella.mtimeMs,
      },
    });
    resumen.anadidos.push(ficha.title);
  }

  // los que quedaron sin fichero: marca «sin fichero», progreso intacto
  const restantes = huespedesAusentes.filter((r) => !autonvinculadas.has(r.id));
  for (const r of restantes) {
    if (!r.fileMissingAt) {
      await db.book.update({ where: { id: r.id }, data: { fileMissingAt: new Date() } });
    }
    resumen.sinFichero.push(r.title);
  }

  return resumen;
}

/** Validación de la carpeta pedida desde la UI (ruta ABSOLUTA del host). */
export async function carpetaValida(
  carpeta: string
): Promise<{ ok: boolean; error?: string; resuelta?: string }> {
  const resuelta = path.resolve(carpeta);
  if (!path.isAbsolute(carpeta) || resuelta === "/") {
    return { ok: false, error: "Ruta inválida: escribe la ruta absoluta de la carpeta (y no la raíz del disco)." };
  }
  try {
    const st = await stat(/* turbopackIgnore: true */ resuelta);
    if (!st.isDirectory()) return { ok: false, error: "Esa ruta no es una carpeta." };
    return { ok: true, resuelta };
  } catch {
    return { ok: false, error: "No se pudo abrir la carpeta (¿existe? ¿tiene permisos?)." };
  }
}
