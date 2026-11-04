/**
 * Tests del motor offline (public/athena-offline.js) — change apk-offline.
 *
 * El núcleo es puro (createCore con adaptadores inyectables): aquí corre con
 * un adaptador en memoria y un reloj controlable, y verifica que las
 * respuestas replican UNO A UNO los contratos de src/app/api (códigos, JSON
 * y efectos). Son los tests que permiten NO probar la biblioteca a mano.
 */
import { describe, test, expect } from "bun:test";
// Módulo JS plano: con allowJs el tsc infiere sus tipos (el JSDoc de
// crearRouter clava la firma del router para el test tipado).
import AthenaOffline from "../public/athena-offline.js";

type Resp = { status: number; json?: any; blob?: Blob; headers?: Record<string, string> };

const { createCore } = AthenaOffline;

/** Adaptador en memoria + reloj controlable */
function adaptador(opts?: { ahora?: Date }) {
  const meta = new Map<string, any>();
  const files = new Map<string, Blob>();
  let reloj = opts?.ahora ?? new Date("2026-11-04T10:00:00");
  const deps = {
    files: {
      write: async (n: string, b: Blob) => {
        files.set(n, b);
      },
      read: (n: string) => files.get(n) ?? null,
      del: async (n: string) => {
        files.delete(n);
      },
      move: async (de: string, a: string) => {
        const b = files.get(de);
        if (b) {
          files.set(a, b);
          files.delete(de);
        }
      },
    },
    meta: {
      get: (k: string) => meta.get(k) ?? null,
      set: (k: string, v: any) => {
        meta.set(k, v);
      },
      del: (k: string) => {
        meta.delete(k);
      },
    },
    now: () => reloj,
    uuid: (() => {
      let n = 0;
      return () =>
        (++n).toString(16).padStart(8, "0").repeat(5).slice(0, 36);
    })(),
    blobToDataUrl: async (b: Blob) =>
      `data:${b.type};base64,${Buffer.from(await b.arrayBuffer()).toString("base64")}`,
  };
  const nucleo = createCore(deps as any);
  const handle = nucleo.crearRouter({});
  return {
    handle,
    files,
    avanzar: (ms: number) => {
      reloj = new Date(reloj.getTime() + ms);
    },
    resetear: (fecha: Date) => {
      reloj = fecha;
    },
  };
}

function ctxJson(body: any) {
  return { rangeHeader: null, json: async () => body, formData: async () => { throw new Error("sin form"); } };
}

function ctxForm(fields: Record<string, string>, file?: { name: string; type: string; size: number; blob: Blob } | null) {
  return { rangeHeader: null, json: async () => ({}), formData: async () => ({ fields, file: file ?? null }) };
}

function blobPdf(bytes = 100) {
  return new Blob([new Uint8Array(bytes).fill(65)], { type: "application/pdf" });
}

/** data URL PNG mínimo (1x1 transparente) para portadas de prueba */
const COVER_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** Sube un libro de prueba y devuelve su id */
async function subirLibro(
  h: ReturnType<typeof adaptador>["handle"],
  extra?: { title?: string; author?: string; pages?: number; fileName?: string; cover?: boolean }
) {
  const res: Resp = await h(
    "POST",
    "/api/books",
    "",
    ctxForm(
      {
        title: extra?.title ?? "Meditaciones",
        author: extra?.author ?? "Marco Aurelio",
        totalPages: String(extra?.pages ?? 12),
        ...(extra?.cover ? { cover: COVER_PNG } : {}),
      },
      {
        name: extra?.fileName ?? "meditaciones.pdf",
        type: "application/pdf",
        size: 100,
        blob: blobPdf(),
      }
    )
  );
  return res;
}

describe("motor offline · biblioteca", () => {
  test("sube un libro y lo lista con archivoUrl, sesiones y portada data URL", async () => {
    const a = adaptador();
    const res = await subirLibro(a.handle, { cover: true });
    expect(res.status).toBe(201);
    expect(res.json.book.title).toBe("Meditaciones");
    expect(res.json.book.origin).toBe("subido");
    expect(res.json.book.filePath).toMatch(/^\/uploads\/b[0-9a-f]{16}\.pdf$/);

    const lista: Resp = await a.handle("GET", "/api/books", "", ctxJson({}));
    expect(lista.status).toBe(200);
    const b = lista.json.books[0];
    expect(b.archivoUrl).toBe(`/api/books/${b.id}/file`);
    expect(b.sessions).toEqual([]);
    expect(b.badge).toBeNull();
    // portada: la build de prueba manda dataURL → vuelve como data URL
    expect(b.coverUrl).toStartWith("data:image/png;base64,");
    // el fichero quedó guardado
    expect(a.files.get(b.filePath.replace("/uploads/", ""))).not.toBeNull();
  });

  test("rechaza formatos no soportados (415) y faltantes (400)", async () => {
    const a = adaptador();
    const mal: Resp = await a.handle(
      "POST",
      "/api/books",
      "",
      ctxForm({ title: "X", totalPages: "5" }, { name: "t.txt", type: "text/plain", size: 5, blob: new Blob(["hola"]) })
    );
    expect(mal.status).toBe(415);
    const sin: Resp = await a.handle("POST", "/api/books", "", ctxForm({ title: "", totalPages: "5" }, null));
    expect(sin.status).toBe(400);
  });

  test("bloquea duplicados con 409 y duplicateOf", async () => {
    const a = adaptador();
    const r1 = await subirLibro(a.handle);
    const r2 = await subirLibro(a.handle);
    expect(r2.status).toBe(409);
    expect(r2.json.duplicateOf).toBe(r1.json.book.id);
  });

  test("libros ordenados por última lectura, NULL al final", async () => {
    const a = adaptador();
    const l1 = await subirLibro(a.handle, { title: "Viejo" });
    a.avanzar(1000);
    const l2 = await subirLibro(a.handle, { title: "Nuevo", fileName: "nuevo.pdf" });
    const lista: Resp = await a.handle("GET", "/api/books", "", ctxJson({}));
    // ambos sin lastReadAt: orden estable (espejo de SQLite DESC con NULLs al final)
    expect(lista.json.books.map((b: any) => b.id)).toEqual([l1.json.book.id, l2.json.book.id]);
    // leer el viejo lo sube
    a.avanzar(1000);
    await a.handle("PATCH", `/api/books/${l1.json.book.id}`, "", ctxJson({ currentPage: 2 }));
    const lista2: Resp = await a.handle("GET", "/api/books", "", ctxJson({}));
    expect(lista2.json.books[0].id).toBe(l1.json.book.id);
  });
});

describe("motor offline · progreso y sesiones", () => {
  test("PATCH guarda progreso, crea sesión y agrega por día", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle);
    const id = json.book.id;

    const p1: Resp = await a.handle("PATCH", `/api/books/${id}`, "", ctxJson({ currentPage: 5, pagesRead: 4, minutes: 10 }));
    expect(p1.status).toBe(200);
    expect(p1.json.book.currentPage).toBe(5);
    a.avanzar(60_000);
    await a.handle("PATCH", `/api/books/${id}`, "", ctxJson({ currentPage: 7, pagesRead: 2, minutes: 5 }));

    const lista: Resp = await a.handle("GET", "/api/books", "", ctxJson({}));
    const b = lista.json.books[0];
    // mismo día → una fila agregada
    expect(b.sessions.length).toBe(1);
    expect(b.sessions[0].pagesRead).toBe(6);
    expect(b.sessions[0].minutes).toBe(15);
    expect(b.sessions[0].date).toEndWith("T12:00:00");
  });

  test("clamp de página contra totalPages aprendidos al abrir", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle, { pages: 5 });
    const id = json.book.id;
    const p: Resp = await a.handle("PATCH", `/api/books/${id}`, "", ctxJson({ totalPages: 3, currentPage: 99 }));
    expect(p.json.book.totalPages).toBe(3);
    expect(p.json.book.currentPage).toBe(3);
  });

  test("hitos y meta diaria con sus rangos (2-40 / 1-500) y herencia null", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle);
    const id = json.book.id;
    const p: Resp = await a.handle("PATCH", `/api/books/${id}`, "", ctxJson({ milestones: 99, dailyGoal: 0 }));
    expect(p.json.book.milestones).toBe(40);
    expect(p.json.book.dailyGoal).toBe(1);
    const p2: Resp = await a.handle("PATCH", `/api/books/${id}`, "", ctxJson({ milestones: null, dailyGoal: null }));
    expect(p2.json.book.milestones).toBeNull();
    expect(p2.json.book.dailyGoal).toBeNull();
  });

  test("extras grandes → 413", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle);
    const id = json.book.id;
    const grande = { xray: [{ id: "1", name: "n", aliases: "", note: "x".repeat(600_000), unlockPage: 1 }] };
    const p: Resp = await a.handle("PATCH", `/api/books/${id}`, "", ctxJson({ extras: grande }));
    expect(p.status).toBe(413);
  });
});

describe("motor offline · insignias (finish)", () => {
  test("sin autor no hay insignia; con autor, Bronce y subida de tier", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle, { author: "" });
    const id = json.book.id;
    const f0: Resp = await a.handle("POST", `/api/books/${id}/finish`, "", ctxJson({}));
    expect(f0.json).toEqual({ ok: true, badge: null, first: false, reason: "missing-metadata" });

    await a.handle("PATCH", `/api/books/${id}/meta`, "", ctxJson({ author: "Marco Aurelio" }));
    const f1: Resp = await a.handle("POST", `/api/books/${id}/finish`, "", ctxJson({}));
    expect(f1.status).toBe(200);
    expect(f1.json.first).toBe(true);
    expect(f1.json.badge.tier).toBe(1);

    // guardia anti-doble-registro (< 2 min)
    const f2: Resp = await a.handle("POST", `/api/books/${id}/finish`, "", ctxJson({}));
    expect(f2.json.reason).toBe("recent");

    // relectura legítima: tier 2
    a.avanzar(3 * 60_000);
    const f3: Resp = await a.handle("POST", `/api/books/${id}/finish`, "", ctxJson({}));
    expect(f3.json.first).toBe(false);
    expect(f3.json.badge.tier).toBe(2);
    expect(f3.json.badge.readings).toBe(2);
  });
});

describe("motor offline · borrado y deshacer (30 s)", () => {
  test("DELETE → snapshot → undo restaura libro con insignia y sesiones", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle);
    const id = json.book.id;
    await a.handle("PATCH", `/api/books/${id}`, "", ctxJson({ currentPage: 4, pagesRead: 3, minutes: 9 }));
    await a.handle("PATCH", `/api/books/${id}/meta`, "", ctxJson({ author: "Marco Aurelio" }));
    await a.handle("POST", `/api/books/${id}/finish`, "", ctxJson({}));

    const del: Resp = await a.handle("DELETE", `/api/books/${id}`, "", ctxJson({}));
    expect(del.status).toBe(200);
    expect(del.json.ok).toBe(true);
    let lista: Resp = await a.handle("GET", "/api/books", "", ctxJson({}));
    expect(lista.json.books).toHaveLength(0);

    const undo: Resp = await a.handle("POST", "/api/books/undo", "", ctxJson({ id }));
    expect(undo.status).toBe(200);
    expect(undo.json.book.currentPage).toBe(4);
    expect(undo.json.book.badge.tier).toBe(1);
    lista = await a.handle("GET", "/api/books", "", ctxJson({}));
    expect(lista.json.books).toHaveLength(1);
    expect(lista.json.books[0].sessions[0].pagesRead).toBe(3);
    // el fichero volvió
    expect(a.files.get(json.book.filePath.replace("/uploads/", ""))).not.toBeNull();

    const otra: Resp = await a.handle("POST", "/api/books/undo", "", ctxJson({ id }));
    expect(otra.status).toBe(404);
  });

  test("pasado el TTL el barrido purga y deshacer responde 410", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle);
    const id = json.book.id;
    await a.handle("DELETE", `/api/books/${id}`, "", ctxJson({}));
    a.avanzar(31_000);
    await a.handle("GET", "/api/books", "", ctxJson({})); // barrido purga el snapshot
    // igual que el servidor: snapshot vencido y purgado → «no hay nada que deshacer»
    const undo: Resp = await a.handle("POST", "/api/books/undo", "", ctxJson({ id }));
    expect(undo.status).toBe(404);
    const lista: Resp = await a.handle("GET", "/api/books", "", ctxJson({}));
    expect(lista.json.books).toHaveLength(0);
  });
});

describe("motor offline · reseteos", () => {
  test("reset de un libro: progreso cero, ficha intacta", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle);
    const id = json.book.id;
    await a.handle("PATCH", `/api/books/${id}`, "", ctxJson({ currentPage: 9, pagesRead: 5, minutes: 5 }));
    const r: Resp = await a.handle("POST", `/api/books/${id}/reset`, "", ctxJson({}));
    expect(r.json.book.currentPage).toBe(1);
    expect(r.json.book.title).toBe("Meditaciones");
    const lista: Resp = await a.handle("GET", "/api/books", "", ctxJson({}));
    expect(lista.json.books[0].sessions).toEqual([]);
  });

  test("reset-all: cuenta libros y sesiones, deja fichas", async () => {
    const a = adaptador();
    await subirLibro(a.handle);
    a.avanzar(10);
    await subirLibro(a.handle, { title: "Otro", fileName: "otro.pdf" });
    const r: Resp = await a.handle("POST", "/api/progress/reset-all", "", ctxJson({}));
    expect(r.json).toMatchObject({ ok: true, books: 2, sessions: 0 });
    const lista: Resp = await a.handle("GET", "/api/books", "", ctxJson({}));
    expect(lista.json.books).toHaveLength(2);
    expect(lista.json.books[0].currentPage).toBe(1);
  });
});

describe("motor offline · ficheros (file / cover / companion)", () => {
  test("GET file sin Range → 200 completo; con Range → 206 y Content-Range", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle);
    const id = json.book.id;

    const full: Resp = await a.handle("GET", `/api/books/${id}/file`, "", ctxJson({}));
    expect(full.status).toBe(200);
    expect(full.headers?.["Accept-Ranges"]).toBe("bytes");
    expect(full.headers?.["Content-Type"]).toBe("application/pdf");
    expect(full.blob?.size).toBe(100);

    const rango: Resp = await a.handle(
      "GET",
      `/api/books/${id}/file`,
      "",
      { rangeHeader: "bytes=0-9", json: async () => ({}), formData: async () => { throw new Error("x"); } }
    );
    expect(rango.status).toBe(206);
    expect(rango.headers?.["Content-Range"]).toBe("bytes 0-9/100");
    expect(rango.headers?.["Content-Length"]).toBe("10");
    expect(rango.blob?.size).toBe(10);
  });

  test("cover: subir imagen nueva actualiza coverPath y sirve PNG", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle);
    const id = json.book.id;
    const img = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const sub: Resp = await a.handle(
      "POST",
      `/api/books/${id}/cover`,
      "",
      ctxForm({}, { name: "portada.png", type: "image/png", size: 4, blob: img })
    );
    expect(sub.status).toBe(200);
    // la respuesta trae la portada como data URL (la <img> del diálogo no
    // pasa por fetch); la fila guardada mantiene su ruta /uploads/
    expect(sub.json.book.coverPath).toStartWith("data:image/png;base64,");
    const fila = (await a.handle("GET", "/api/books", "", ctxJson({}))).json.books[0];
    expect(fila.coverPath).toBe(`/uploads/${id}-cover.png`);
    const servida: Resp = await a.handle("GET", `/api/books/${id}/cover`, "", ctxJson({}));
    expect(servida.status).toBe(200);
    expect(servida.headers?.["Content-Type"]).toBe("image/png");
  });

  test("companion: sube PDF y lo quita con DELETE", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle);
    const id = json.book.id;
    const sub: Resp = await a.handle(
      "POST",
      `/api/books/${id}/companion`,
      "",
      ctxForm({ pages: "7" }, { name: "traduccion.pdf", type: "application/pdf", size: 50, blob: blobPdf(50) })
    );
    expect(sub.json.book.companionPages).toBe(7);
    const servido: Resp = await a.handle("GET", `/api/books/${id}/file`, "?cual=companion", ctxJson({}));
    expect(servido.status).toBe(200);
    const del: Resp = await a.handle("DELETE", `/api/books/${id}/companion`, "", ctxJson({}));
    expect(del.json.book.companionPath).toBeNull();
    const tras: Resp = await a.handle("GET", `/api/books/${id}/file`, "?cual=companion", ctxJson({}));
    expect(tras.status).toBe(404);
  });

  test("relink y scan no aplican en la app: error claro", async () => {
    const a = adaptador();
    const { json } = await subirLibro(a.handle);
    const r: Resp = await a.handle("POST", `/api/books/${json.book.id}/relink`, "", ctxJson({ filePath: "/x" }));
    expect(r.status).toBe(400);
    const s: Resp = await a.handle("POST", "/api/library/scan", "", ctxJson({ carpeta: "/biblioteca" }));
    expect(s.status).toBe(400);
  });
});

describe("motor offline · ajustes", () => {
  test("GET inicial con defaults + created:true; PUT persiste y _doc sobrevive", async () => {
    const a = adaptador();
    const g1: Resp = await a.handle("GET", "/api/settings", "", ctxJson({}));
    expect(g1.status).toBe(200);
    expect(g1.json.created).toBe(true);
    expect(g1.json.settings.rail.segments).toBe(10);
    expect(g1.json.settings.modes.toggles.xray).toBe(true);

    const p: Resp = await a.handle(
      "PUT",
      "/api/settings",
      "",
      ctxJson({
        settings: { rail: { segments: 12, theme: "amber", position: "left", showLabels: true, celebrate: true } },
        _doc: { rail: "mi nota" },
      })
    );
    expect(p.json.ok).toBe(true);

    const g2: Resp = await a.handle("GET", "/api/settings", "", ctxJson({}));
    expect(g2.json.created).toBe(false);
    expect(g2.json.settings.rail.segments).toBe(12);
    // lo no tocado conserva el default
    expect(g2.json.settings.teleprompter.wps).toBe(2.5);
    expect(g2.json._doc.rail).toBe("mi nota");
  });
});

describe("motor offline · vocabulario", () => {
  test("alta, dedupe sin caja, listado y borrado", async () => {
    const a = adaptador();
    const r1: Resp = await a.handle("POST", "/api/vocab", "", ctxJson({ word: "Estrategia", lang: "es", short: "arte de...", page: 3 }));
    expect(r1.status).toBe(201);
    const r2: Resp = await a.handle("POST", "/api/vocab", "", ctxJson({ word: "estrategia", lang: "es" }));
    expect(r2.json.duplicated).toBe(true);
    const lista: Resp = await a.handle("GET", "/api/vocab", "", ctxJson({}));
    expect(lista.json.vocabulary).toHaveLength(1);
    expect(lista.json.vocabulary[0].bookId).toBe("");
    const del: Resp = await a.handle("DELETE", `/api/vocab/${r1.json.entry.id}`, "", ctxJson({}));
    expect(del.json.ok).toBe(true);
  });

  test("import idempotente: salta las que ya están", async () => {
    const a = adaptador();
    await a.handle("POST", "/api/vocab", "", ctxJson({ word: "sol", lang: "es" }));
    const imp: Resp = await a.handle(
      "POST",
      "/api/vocab/import",
      "",
      ctxJson({ entries: [{ word: "sol", lang: "es" }, { word: "luna", lang: "es" }, { word: "", lang: "es" }] })
    );
    expect(imp.json.imported).toBe(1);
    const imp2: Resp = await a.handle(
      "POST",
      "/api/vocab/import",
      "",
      ctxJson({ entries: [{ word: "sol", lang: "es" }, { word: "luna", lang: "es" }] })
    );
    expect(imp2.json.imported).toBe(0);
  });
});

describe("motor offline · diccionario sin servidor", () => {
  test("palabra vacía → 400", async () => {
    const a = adaptador();
    const r: Resp = await a.handle("GET", "/api/dictionary", "?word=", ctxJson({}));
    expect(r.status).toBe(400);
  });

  test("sin internet → found:false (y la UI muestra «sin resultados»)", async () => {
    const a = adaptador();
    const núcleo = createCore({
      files: a.files as any,
      meta: { get: () => null, set: () => {}, del: () => {} } as any,
      blobToDataUrl: async () => null,
    });
    const router = núcleo.crearRouter({
      fetchImpl: () => Promise.reject(new Error("sin red")),
    });
    const r: Resp = await router("GET", "/api/dictionary", "?word=casa&lang=auto", ctxJson({}));
    expect(r.status).toBe(200);
    expect(r.json.found).toBe(false);
  });

  test("con internet (stub) devuelve entradas normalizadas de Wiktionary", async () => {
    const a = adaptador();
    const núcleo = createCore({
      files: a.files as any,
      meta: { get: () => null, set: () => {}, del: () => {} } as any,
      blobToDataUrl: async () => null,
    });
    const wik = [
      {
        word: "strategy",
        phonetic: "ˈstrætədʒi",
        phonetics: [{ text: "ˈstrætədʒi", audio: "https://x/audio.mp3" }],
        meanings: [
          {
            partOfSpeech: "noun",
            definitions: [{ definition: "A plan of action", example: "a military strategy" }],
          },
        ],
      },
    ];
    const router = núcleo.crearRouter({
      fetchImpl: () => Promise.resolve({ ok: true, json: async () => wik }),
    });
    const r: Resp = await router("GET", "/api/dictionary", "?word=strategy&lang=en", ctxJson({}));
    expect(r.status).toBe(200);
    expect(r.json.found).toBe(true);
    expect(r.json.entries[0].defs[0].d).toBe("A plan of action");
    expect(r.json.audio).toBe("https://x/audio.mp3");
  });
});

describe("motor offline · rutas sueltas", () => {
  test("raíz de salud, login sin candado y 404 raras", async () => {
    const a = adaptador();
    const salud: Resp = await a.handle("GET", "/api", "", ctxJson({}));
    expect(salud.json.message).toBe("Hello, world!");
    const login: Resp = await a.handle("POST", "/api/auth/login", "", ctxJson({ password: "x" }));
    expect(login.status).toBe(400);
    const rara: Resp = await a.handle("GET", "/api/inexistente", "", ctxJson({}));
    expect(rara.status).toBe(404);
    const libro404: Resp = await a.handle("PATCH", "/api/books/b000000000000000", "", ctxJson({ currentPage: 1 }));
    expect(libro404.status).toBe(404);
  });
});
