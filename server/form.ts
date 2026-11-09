import type { Request } from "express";

/**
 * Adaptador de multipart/form-data para las rutas que Next.js servía con
 * `req.formData()`. Con Express usamos multer (memoria) y exponemos el mismo
 * contrato `get(nombre) → string | File | null`, de modo que la lógica de las
 * rutas no cambia: los campos de texto llegan como string y los ficheros como
 * File web (name, type, size, arrayBuffer).
 *
 * Tope de fichero: 256 MB — el mismo margen que tenía el proxy de Next
 * (`proxyClientMaxBodySize`) para que un libro de 200 MB llegue entero; el
 * límite de negocio (200 MB) lo sigue aplicando cada ruta.
 */
export const SUBIDA = {
  storage: "memory" as const,
  limits: {
    fileSize: 256 * 1024 * 1024,
    files: 4,
    fields: 20,
    fieldSize: 16 * 1024 * 1024,
  },
};

interface ReqConForma extends Request {
  files?: Express.Multer.File[];
  body: Record<string, unknown>;
}

export interface FormaLegible {
  get(nombre: string): string | File | null;
}

/** La forma ya parseada por multer como si fuera la FormData web de Next. */
export function leerForm(req: Request): FormaLegible {
  const r = req as ReqConForma;
  const ficheros = Array.isArray(r.files) ? r.files : [];
  return {
    get(nombre: string): string | File | null {
      const f = ficheros.find((x) => x.fieldname === nombre);
      if (f) {
        // Buffer de Node → BlobPart (el tipado de Buffer es ArrayBufferLike)
        return new File([f.buffer as unknown as BlobPart], f.originalname, {
          type: f.mimetype || "application/octet-stream",
        });
      }
      const v = r.body[nombre];
      if (typeof v === "string") return v;
      if (v == null) return null;
      return String(v);
    },
  };
}
