/**
 * Athena · motor offline (APK)
 * ---------------------------------------------------------------------------
 * Athena es una web app Next.js con servidor (API + SQLite + ficheros). Para
 * usarla COMO APP sin servidor (APK con Capacitor) este motor intercepta las
 * llamadas del navegador a /api/* y las responde LOCALMENTE:
 *
 *   - Datos   → un documento JSON por colección en IndexedDB (books, sessions,
 *               vocab, badges, undo, settings). Biblioteca personal: cabe de
 *               sobra y la lectura/escritura es atómica por documento.
 *   - Ficheros→ OPFS (Origin Private File System) para libros y compañeros
 *               (hasta 200 MB, con soporte de Range para pdf.js) y Blobs en
 *               IndexedDB para portadas y fondos pequeños.
 *
 * Contratos: este archivo replica UNO A UNO las respuestas de las rutas de
 * src/app/api (mismos JSON, mismos códigos de estado, fechas en ISO). La
 * interfaz no cambia ni una línea: sigue llamando a /api/... como siempre.
 *
 * Copia de la casa (Enmienda 1): además del espejo de contratos, el núcleo
 * lleva un módulo `sync` (exportar/aplicar) y `install()` lo puentea a la red
 * (traerDe/enviarA con X-Athena-Token) para copiar biblioteca/progreso con el
 * servidor de la dueña por LAN, SIEMPRE a mano. No es un contrato del API: es
 * el puente APK ↔ servidor; las mismas reglas del lado servidor viven en
 * src/core/sync.ts y se testean en ambos lados.
 *
 * Se activa SOLO cuando la build es de APK (window.__ATHENA_APK__ === true,
 * inyectado por layout.tsx en la build estática) o cuando corre dentro de
 * Capacitor. En el modo self-host normal este archivo no hace nada.
 *
 * Núcleo puro + adaptador: `createCore(deps)` no toca el navegador (se testea
 * con bun test usando un adaptador en memoria); `install()` es la capa browser.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  if (root) root.AthenaOffline = mod;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ------------------------------------------------------------------ util

  function nowIso(d) {
    return (d instanceof Date ? d : new Date()).toISOString();
  }

  /** Día local (YYYY-MM-DD) de un ISO — espejo del strftime localtime del SQL */
  function diaLocal(iso) {
    var d = new Date(iso);
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function clampInt(v, min, max, fallback) {
    var n = Math.round(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function idLibro(uuid) {
    return "b" + String(uuid()).replace(/-/g, "").slice(0, 16);
  }

  function esIdSeguro(id) {
    return /^[a-z0-9][a-z0-9_-]{7,63}$/i.test(String(id || ""));
  }

  function tierForReadings(readings) {
    return Math.min(4, Math.max(1, Math.round(readings)));
  }

  /** Nombre de fichero saneado (basenames solo: nada de rutas travesías) */
  function baseName(ruta) {
    var p = String(ruta || "").split("/");
    return p[p.length - 1];
  }

  // --------------------------------------------------------------- defaults

  /** Espejo de defaultSettings + defaultModes de src/lib/settings.ts */
  function ajustesPorDefecto() {
    return {
      lang: "es",
      rail: { position: "left", segments: 10, theme: "egeo", showLabels: true, celebrate: true },
      filters: { preset: "auto", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
      reading: { dailyGoal: 20, scrollStepPct: 40, wheelBoost: 1, font: "literata" },
      immersion: { enabled: true, idleSeconds: 4, toggleKey: "h" },
      teleprompter: {
        wps: 2.5, instante: false, sound: true, auto: false, fontScale: 1,
        fondo: "tema", fondoRuta: "", fondoFiltro: 55, tarjetasPorFrase: true,
        pausaImagen: true, imagenHoldMs: 5000, descansoMin: 0,
      },
      modes: {
        toggles: {
          xray: true, naturalPauses: false, argumentSkeleton: false,
          lockedNotes: false, dualRead: false, outline: true, dictionary: true,
        },
        pauseMinutes: 25,
      },
    };
  }

  var UNDO_TTL_MS = 30_000;
  var MAX_LIBRO = 200 * 1024 * 1024;
  var MAX_IMAGEN = 8 * 1024 * 1024;
  var MAX_EXTRAS = 512 * 1024;

  // ----------------------------------------------------------------- núcleo
  //
  // deps = {
  //   files:  { write(nombre, Blob), read(nombre) → Blob|null, del(nombre),
  //             move(de, a), exists(nombre) → boolean }
  //   meta:   { get(clave) → any|null, set(clave, valor), del(clave) }
  //   now(), uuid(), blobToDataUrl(Blob) → Promise<string>|null
  // }
  //
  // Colecciones en meta: "books", "sessions", "vocab", "badges",
  // "undo" (mapa id→snapshot), "settings" ({settings, biblioteca, _doc}).

  function createCore(deps) {
    var files = deps.files;
    var meta = deps.meta;
    var now = deps.now || function () { return new Date(); };
    var uuid = deps.uuid || function () {
      if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
    };
    var blobToDataUrl = deps.blobToDataUrl || function () { return Promise.resolve(null); };

    // Cola de operaciones: la biblioteca es de una persona; serializar evita
    // carreras de lectura-modificación-escritura entre pestañas/gestos.
    var cola = Promise.resolve();
    function enCola(fn) {
      var p = cola.then(fn, fn);
      cola = p.catch(function () {});
      return p;
    }

    function coleccion(clave, porDefecto) {
      var v = meta.get(clave);
      if (v == null) return porDefecto || [];
      return v;
    }
    function guardarColeccion(clave, valor) {
      meta.set(clave, valor);
    }

    // Respuesta estándar del núcleo
    function json(status, body) {
      return { status: status, json: body };
    }
    function error(status, msg) {
      return json(status, { error: msg });
    }

    // ------------------------------------------------------------- helpers

    function libroConUrls(b, coverDataUrl) {
      var out = Object.assign({}, b, {
        archivoUrl: `/api/books/${b.id}/file`,
        // En APK las portadas viajan como data URL: las etiquetas <img> no
        // pasan por fetch/XHR y así se ven sin tocar ni un componente.
        coverUrl: coverDataUrl || (b.coverPath && !b.coverPath.startsWith("/uploads/") ? b.coverPath : null),
      });
      var badge = coleccion("badges", []).find(function (x) { return x.bookId === b.id; });
      out.badge = badge || null;
      return out;
    }

    function coverDataUrlDe(b) {
      if (!b.coverPath || !b.coverPath.startsWith("/uploads/")) return Promise.resolve(null);
      var blob = files.read(baseName(b.coverPath));
      if (!blob) return Promise.resolve(null);
      return Promise.resolve(blobToDataUrl(blob)).then(function (url) { return url || null; });
    }

    /** sesiones agregadas por día (espejo del GROUP BY de GET /api/books) */
    function sesionesPorLibro() {
      var todas = coleccion("sessions", []);
      var por = new Map();
      todas.forEach(function (s) {
        var dia = diaLocal(s.date);
        var k = s.bookId;
        var lista = por.get(k);
        if (!lista) por.set(k, (lista = []));
        lista.push({ pagesRead: Number(s.pagesRead) || 0, minutes: Number(s.minutes) || 0, date: `${dia}T12:00:00` });
      });
      // una fila por día (los agregados del SQL viajan una por día)
      por.forEach(function (lista, k) {
        var porDia = new Map();
        lista.forEach(function (f) {
          var acc = porDia.get(f.date);
          if (!acc) porDia.set(f.date, (acc = { pagesRead: 0, minutes: 0, date: f.date }));
          acc.pagesRead += f.pagesRead;
          acc.minutes += f.minutes;
        });
        por.set(k, [...porDia.values()]);
      });
      return por;
    }

    function sweepExpiredUndo() {
      var undo = coleccion("undo", {});
      var cambio = false;
      var limite = now().getTime();
      Object.keys(undo).forEach(function (id) {
        if (undo[id] && limite - undo[id].deletedAt > UNDO_TTL_MS) {
          var snap = undo[id];
          // vencido: la basura se purga de verdad (ficheros incluidos)
          var f = (snap && snap.files) || {};
          ["pdf", "cover", "companion"].forEach(function (k) {
            if (f[k]) files.del(`__papelera__${id}__${f[k]}`);
          });
          delete undo[id];
          cambio = true;
        }
      });
      if (cambio) guardarColeccion("undo", undo);
      return cambio;
    }

    // ---------------------------------------------------------- handlers

    function listarLibros() {
      sweepExpiredUndo();
      var books = coleccion("books", []).slice();
      books.sort(function (a, b) {
        // lastReadAt desc, NULL al final (espejo del orderBy de Prisma/SQLite)
        var av = a.lastReadAt || "", bv = b.lastReadAt || "";
        if (av === bv) return 0;
        if (!bv) return -1;
        if (!av) return 1;
        return av < bv ? 1 : -1;
      });
      var por = sesionesPorLibro();
      return Promise.all(books.map(function (b) { return coverDataUrlDe(b); })).then(function (covers) {
        return json(200, {
          books: books.map(function (b, i) {
            var out = libroConUrls(b, covers[i]);
            out.sessions = por.get(b.id) || [];
            return out;
          }),
        });
      });
    }

    function formDataDe(ctx) {
      return ctx.formData().then(function (fd) { return fd; });
    }

    function subirLibro(ctx) {
      return formDataDe(ctx).then(function (form) {
        var file = form.file;
        var title = String(form.fields.title || "").trim();
        var author = String(form.fields.author || "").trim() || null;
        var totalPages = Number(form.fields.totalPages);
        var cover = form.fields.cover || null;

        if (!file || !title || !Number.isFinite(totalPages) || totalPages <= 0) {
          return error(400, "Faltan datos del libro (archivo, título o páginas)");
        }
        var lowerName = String(file.name || "").toLowerCase();
        var isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
        var isEpub = file.type === "application/epub+zip" || lowerName.endsWith(".epub");
        if (!isPdf && !isEpub) return error(415, "Aceptamos PDF y EPUB (pronto: más formatos)");
        if (file.size > MAX_LIBRO) return error(413, "El libro supera los 200 MB. Comprímelo y vuelve a intentar.");

        var books = coleccion("books", []);
        var dup = books.find(function (b) { return b.fileName === file.name && b.totalPages === Math.round(totalPages); });
        if (dup) {
          return json(409, {
            error: `Este libro ya está en tu biblioteca como «${dup.title}»`,
            duplicateOf: dup.id,
          });
        }

        var id = idLibro(uuid);
        var fileName = `${id}.${isEpub ? "epub" : "pdf"}`;
        return Promise.resolve(files.write(fileName, file.blob)).then(function () {
          var coverPath = null;
          var pCover = Promise.resolve();
          if (cover && typeof cover === "string" && cover.startsWith("data:image/")) {
            coverPath = `/uploads/${id}-cover.png`;
            pCover = Promise.resolve(dataUrlABlob(cover)).then(function (blob) {
              return blob ? files.write(`${id}-cover.png`, blob) : null;
            });
          }
          return pCover.then(function () {
            var fila = {
              id: id,
              title: title,
              author: author,
              fileName: file.name,
              filePath: `/uploads/${fileName}`,
              coverPath: coverPath,
              totalPages: Math.round(totalPages),
              currentPage: 1,
              milestones: null,
              dailyGoal: null,
              companionPath: null,
              companionPages: null,
              extras: null,
              finishedAt: null,
              readCount: 0,
              createdAt: nowIso(now()),
              lastReadAt: null,
              origin: "subido",
              fileHash: null,
              fileBytes: file.size,
              fileMtime: now().getTime(),
              fileMissingAt: null,
            };
            books.push(fila);
            guardarColeccion("books", books);
            return json(201, { book: fila });
          });
        });
      });
    }

    function dataUrlABlob(dataUrl) {
      if (typeof dataUrl !== "string") return null;
      var coma = dataUrl.indexOf(",");
      if (coma < 0) return null;
      var meta = dataUrl.slice(0, coma);
      var b64 = dataUrl.slice(coma + 1);
      var tipo = (meta.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
      try {
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: tipo });
      } catch (e) {
        return null;
      }
    }

    function buscarLibro(id) {
      return coleccion("books", []).find(function (b) { return b.id === id; }) || null;
    }

    function guardarLibro(fila) {
      var books = coleccion("books", []);
      var i = books.findIndex(function (b) { return b.id === fila.id; });
      if (i >= 0) books[i] = fila;
      guardarColeccion("books", books);
      return fila;
    }

    function parchearProgreso(id, body) {
      var book = buscarLibro(id);
      if (!book) return error(404, "Libro no encontrado");

      var totalPages = book.totalPages;
      if (typeof body.totalPages === "number" && Number.isFinite(body.totalPages) && body.totalPages >= 1) {
        totalPages = Math.round(body.totalPages);
      }
      var techo = totalPages > 0 ? totalPages : Number.MAX_SAFE_INTEGER;

      var currentPage = book.currentPage;
      if (typeof body.currentPage === "number" && Number.isFinite(body.currentPage)) {
        currentPage = Math.min(Math.max(1, Math.round(body.currentPage)), techo);
      } else if (book.totalPages > 0 && book.currentPage > book.totalPages) {
        currentPage = book.totalPages;
      }

      var pagesRead = Math.max(0, Math.round(body.pagesRead ?? 0));
      var minutes = Math.max(0, Math.round(body.minutes ?? 0));

      var milestones = book.milestones;
      if (body.milestones !== undefined) {
        milestones = body.milestones === null ? null : clampInt(body.milestones, 2, 40, book.milestones);
      }
      var dailyGoal = book.dailyGoal;
      if (body.dailyGoal !== undefined) {
        dailyGoal = body.dailyGoal === null ? null : clampInt(body.dailyGoal, 1, 500, book.dailyGoal);
      }

      var extras = book.extras;
      if (body.extras !== undefined) {
        if (body.extras === null) extras = null;
        else if (typeof body.extras === "object") {
          if (JSON.stringify(body.extras).length > MAX_EXTRAS) {
            return error(413, "Los datos del libro son demasiado grandes");
          }
          extras = body.extras;
        }
      }

      var actualizado = guardarLibro(Object.assign({}, book, {
        currentPage: currentPage,
        lastReadAt: nowIso(now()),
        milestones: milestones,
        dailyGoal: dailyGoal,
        totalPages: totalPages,
        extras: extras,
      }));

      if (pagesRead > 0 || minutes > 0) {
        var sessions = coleccion("sessions", []);
        sessions.push({
          id: String(uuid()).replace(/-/g, "").slice(0, 24),
          bookId: id,
          pagesRead: pagesRead,
          minutes: minutes,
          date: nowIso(now()),
        });
        guardarColeccion("sessions", sessions);
      }
      return json(200, { book: actualizado });
    }

    function borrarLibro(id) {
      var book = buscarLibro(id);
      if (!book) return error(404, "Libro no encontrado");
      sweepExpiredUndo();

      var esCarpeta = book.origin === "carpeta";
      var files_ = { pdf: esCarpeta ? "" : baseName(book.filePath) };
      if (book.coverPath && book.coverPath.startsWith("/uploads/")) files_.cover = baseName(book.coverPath);
      if (book.companionPath) files_.companion = baseName(book.companionPath);

      // mover ficheros a papelera (renombra; deshacer los devuelve)
      var movimientos = [];
      ["pdf", "cover", "companion"].forEach(function (k) {
        if (files_[k]) movimientos.push(files.move(files_[k], `__papelera__${id}__${files_[k]}`));
      });

      var badge = coleccion("badges", []).find(function (x) { return x.bookId === id; }) || null;
      var sessions = coleccion("sessions", []).filter(function (s) { return s.bookId === id; });

      var undo = coleccion("undo", {});
      undo[id] = {
        deletedAt: now().getTime(),
        book: book,
        badge: badge,
        sessions: sessions.map(function (s) { return { pagesRead: s.pagesRead, minutes: s.minutes, date: s.date }; }),
        files: files_,
      };
      guardarColeccion("undo", undo);

      guardarColeccion("books", coleccion("books", []).filter(function (b) { return b.id !== id; }));
      guardarColeccion("sessions", coleccion("sessions", []).filter(function (s) { return s.bookId !== id; }));
      guardarColeccion("badges", coleccion("badges", []).filter(function (x) { return x.bookId !== id; }));

      return Promise.all(movimientos).then(function () {
        return json(200, { ok: true, undoExpiresAt: nowIso(new Date(now().getTime() + UNDO_TTL_MS)) });
      });
    }

    function deshacerBorrado(body) {
      var id = body && body.id;
      if (!id) return error(400, "Falta el id del libro");
      sweepExpiredUndo();
      var undo = coleccion("undo", {});
      var snap = undo[id];
      if (!snap) return error(404, "No hay nada que deshacer");
      if (now().getTime() - snap.deletedAt > UNDO_TTL_MS) {
        delete undo[id];
        guardarColeccion("undo", undo);
        return error(410, "Ya es tarde para deshacer");
      }
      if (buscarLibro(id)) {
        delete undo[id];
        guardarColeccion("undo", undo);
        return error(409, "Ese libro ya existe");
      }

      var b = snap.book;
      var restores = [];
      ["pdf", "cover", "companion"].forEach(function (k) {
        if (snap.files && snap.files[k]) {
          restores.push(files.move(`__papelera__${id}__${snap.files[k]}`, snap.files[k]));
        }
      });

      guardarColeccion("books", coleccion("books", []).concat([b]));
      if (snap.badge) {
        guardarColeccion("badges", coleccion("badges", []).concat([snap.badge]));
      }
      if (snap.sessions && snap.sessions.length > 0) {
        var sessions = coleccion("sessions", []);
        snap.sessions.forEach(function (s) {
          sessions.push({
            id: String(uuid()).replace(/-/g, "").slice(0, 24),
            bookId: id,
            pagesRead: s.pagesRead,
            minutes: s.minutes,
            date: s.date,
          });
        });
        guardarColeccion("sessions", sessions);
      }
      delete undo[id];
      guardarColeccion("undo", undo);

      return Promise.all(restores).then(function () {
        var badge = coleccion("badges", []).find(function (x) { return x.bookId === id; }) || null;
        var book = Object.assign({}, b, { badge: badge });
        return json(200, { ok: true, book: book });
      });
    }

    function terminarLibro(id) {
      var book = buscarLibro(id);
      if (!book) return error(404, "Libro no encontrado");
      var hasMeta = !!(String(book.title || "").trim() && book.author && String(book.author).trim());
      if (!hasMeta) return json(200, { ok: true, badge: null, first: false, reason: "missing-metadata" });

      var ahora = now();
      if (book.finishedAt && ahora.getTime() - new Date(book.finishedAt).getTime() < 2 * 60 * 1000) {
        var badge = coleccion("badges", []).find(function (x) { return x.bookId === id; }) || null;
        return json(200, { ok: true, badge: badge, first: false, reason: "recent" });
      }

      var readings = (book.readCount || 0) + 1;
      var tier = tierForReadings(readings);
      var badges = coleccion("badges", []);
      var i = badges.findIndex(function (x) { return x.bookId === id; });
      var existed = i >= 0;
      var fila = {
        id: existed ? badges[i].id : String(uuid()).replace(/-/g, "").slice(0, 24),
        bookId: id,
        tier: tier,
        readings: readings,
        earnedAt: existed ? badges[i].earnedAt : ahora.toISOString(),
        updatedAt: ahora.toISOString(),
      };
      if (existed) badges[i] = fila; else badges.push(fila);
      guardarColeccion("badges", badges);

      guardarLibro(Object.assign({}, book, {
        readCount: readings,
        finishedAt: ahora.toISOString(),
        lastReadAt: ahora.toISOString(),
      }));
      return json(200, { ok: true, badge: fila, first: !existed });
    }

    function parchearMeta(id, body) {
      var book = buscarLibro(id);
      if (!book) return error(404, "Libro no encontrado");
      var title = book.title;
      if (body.title !== undefined) {
        var t = String(body.title).trim();
        if (!t) return error(400, "El título no puede quedar vacío");
        title = t;
      }
      var author = book.author;
      if (body.author !== undefined) {
        var a = typeof body.author === "string" ? body.author.trim() : null;
        author = a ? a : null;
      }
      var dailyGoal = book.dailyGoal;
      if (body.dailyGoal !== undefined) {
        dailyGoal = body.dailyGoal === null ? null : clampInt(body.dailyGoal, 1, 500, book.dailyGoal);
      }
      return json(200, { book: guardarLibro(Object.assign({}, book, { title: title, author: author, dailyGoal: dailyGoal })) });
    }

    function reiniciarLibro(id) {
      var book = buscarLibro(id);
      if (!book) return error(404, "Libro no encontrado");
      guardarColeccion("badges", coleccion("badges", []).filter(function (x) { return x.bookId !== id; }));
      guardarColeccion("sessions", coleccion("sessions", []).filter(function (s) { return s.bookId !== id; }));
      var actualizado = guardarLibro(Object.assign({}, book, { currentPage: 1, finishedAt: null, readCount: 0 }));
      return json(200, { book: actualizado });
    }

    function servirFichero(id, search, rangeHeader) {
      var book = buscarLibro(id);
      if (!book) return Promise.resolve(json(404, { error: "Libro no encontrado" }));
      var esCompanion = new URLSearchParams(search || "").get("cual") === "companion";
      var interna = esCompanion ? book.companionPath : book.filePath;
      if (!interna) return Promise.resolve(json(404, { error: "Este libro no tiene ese fichero" }));
      var nombre = baseName(interna);
      var blob = files.read(nombre);
      if (!blob) {
        return Promise.resolve(json(404, {
          error: esCompanion ? "El compañero no está" : "El fichero no está (¿lo moviste o borraste?)",
        }));
      }
      var tipo = nombre.toLowerCase().endsWith(".epub") ? "application/epub+zip" : "application/pdf";
      var m = rangeHeader && rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (m) {
        var ini = Number(m[1]);
        var fin = m[2] ? Math.min(Number(m[2]), blob.size - 1) : blob.size - 1;
        if (Number.isFinite(ini) && ini <= fin) {
          return Promise.resolve({
            status: 206,
            blob: blob.slice(ini, fin + 1, tipo),
            headers: {
              "Content-Type": tipo,
              "Cache-Control": "no-store",
              "Accept-Ranges": "bytes",
              "Content-Range": `bytes ${ini}-${fin}/${blob.size}`,
              "Content-Length": String(fin - ini + 1),
            },
          });
        }
      }
      return Promise.resolve({
        status: 200,
        blob: blob,
        headers: { "Content-Type": tipo, "Cache-Control": "no-store", "Accept-Ranges": "bytes", "Content-Length": String(blob.size) },
      });
    }

    function servirCover(id) {
      var book = buscarLibro(id);
      if (!book || !book.coverPath || !book.coverPath.startsWith("/uploads/")) {
        return Promise.resolve(json(404, { error: "Este libro no tiene portada" }));
      }
      var blob = files.read(baseName(book.coverPath));
      if (!blob) return Promise.resolve(json(404, { error: "La portada no está" }));
      return Promise.resolve({
        status: 200,
        blob: blob,
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      });
    }

    function subirCover(id, ctx) {
      var book = buscarLibro(id);
      if (!book) return Promise.resolve(error(404, "Libro no encontrado"));
      return formDataDe(ctx).then(function (form) {
        var file = form.file;
        if (!file || !String(file.type || "").startsWith("image/")) {
          return error(415, "Hace falta una imagen");
        }
        var ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
        var nombre = `${id}-cover.${ext}`;
        // portada anterior fuera (puede cambiar de extensión)
        if (book.coverPath && book.coverPath.startsWith("/uploads/")) {
          var vieja = baseName(book.coverPath);
          if (vieja !== nombre) files.del(vieja);
        }
        return Promise.resolve(files.write(nombre, file.blob)).then(function () {
          var actualizado = guardarLibro(Object.assign({}, book, { coverPath: `/uploads/${nombre}` }));
          // la respuesta lleva la portada como data URL: la vista previa del
          // diálogo (etiqueta <img>) no pasa por fetch y así se ve al instante
          return Promise.resolve(blobToDataUrl(file.blob)).then(function (url) {
            return json(200, { book: url ? Object.assign({}, actualizado, { coverPath: url }) : actualizado });
          });
        });
      }, function () {
        return error(400, "No se pudo leer la imagen");
      });
    }

    function companion(id, metodo, ctx) {
      var book = buscarLibro(id);
      if (!book) return Promise.resolve(error(404, "Libro no encontrado"));
      if (metodo === "DELETE") {
        if (book.companionPath) files.del(baseName(book.companionPath));
        return Promise.resolve(json(200, { book: guardarLibro(Object.assign({}, book, { companionPath: null, companionPages: null })) }));
      }
      return formDataDe(ctx).then(function (form) {
        var file = form.file;
        var pages = Number(form.fields.pages);
        if (!file || !Number.isFinite(pages) || pages <= 0) {
          return error(400, "Falta el archivo o el número de páginas");
        }
        if (file.type !== "application/pdf" && !String(file.name || "").toLowerCase().endsWith(".pdf")) {
          return error(415, "El compañero debe ser un PDF");
        }
        if (file.size > MAX_LIBRO) return error(413, "El compañero pasa de 200 MB");
        var nombre = `${id}-companion.pdf`;
        return Promise.resolve(files.write(nombre, file.blob)).then(function () {
          return json(200, {
            book: guardarLibro(Object.assign({}, book, {
              companionPath: `/uploads/${nombre}`,
              companionPages: Math.round(pages),
            })),
          });
        });
      });
    }

    // ------------------------------------------------------------ ajustes

    function leerAjustes() {
      var stored = meta.get("settings");
      var created = !stored;
      if (!stored) {
        stored = { settings: ajustesPorDefecto(), biblioteca: { carpeta: "" }, _doc: {} };
      }
      return {
        settings: Object.assign(ajustesPorDefecto(), stored.settings || {}),
        biblioteca: stored.biblioteca || { carpeta: "" },
        _doc: stored._doc || {},
        created: created,
      };
    }

    function escribirAjustes(body) {
      var actual = leerAjustes();
      var biblioteca = actual.biblioteca;
      if (body.biblioteca && typeof body.biblioteca === "object" && typeof body.biblioteca.carpeta === "string") {
        biblioteca = { carpeta: body.biblioteca.carpeta.slice(0, 1024) };
      }
      var doc = actual._doc;
      if (body._doc && Object.keys(body._doc).length > 0) {
        doc = Object.assign({}, actual._doc, body._doc);
      }
      var settings = body.settings ? Object.assign({}, actual.settings, body.settings) : actual.settings;
      var nuevo = { settings: settings, biblioteca: biblioteca, _doc: doc };
      meta.set("settings", nuevo);
      return json(200, { ok: true, settings: settings, biblioteca: biblioteca });
    }

    // ------------------------------------------------------------ vocab

    function entryVocab(v) {
      return {
        id: v.id,
        word: v.word,
        lang: v.lang === "en" ? "en" : "es",
        short: v.short,
        bookId: v.bookId || "",
        bookTitle: v.bookTitle || "",
        page: v.page || 1,
        createdAt: v.createdAt,
      };
    }

    function listarVocab() {
      var rows = coleccion("vocab", []).slice().sort(function (a, b) {
        return a.createdAt < b.createdAt ? 1 : -1;
      });
      return json(200, { vocabulary: rows.slice(0, 500).map(entryVocab) });
    }

    function crearVocab(body) {
      var word = String(body.word || "").trim();
      if (!word) return error(400, "Falta la palabra");
      var lang = body.lang === "en" ? "en" : "es";
      var vocab = coleccion("vocab", []);
      var lower = word.toLowerCase();
      var existente = vocab.find(function (v) { return v.lang === lang && v.word.toLowerCase() === lower; });
      if (existente) return json(200, { entry: entryVocab(existente), duplicated: true });
      var fila = {
        id: typeof body.id === "string" && body.id.length <= 32 ? body.id : String(uuid()).replace(/-/g, "").slice(0, 24),
        word: word,
        lang: lang,
        short: String(body.short || "").slice(0, 2000),
        bookId: body.bookId && body.bookId !== "" ? String(body.bookId).slice(0, 64) : null,
        bookTitle: String(body.bookTitle || "").slice(0, 200),
        page: Number.isFinite(Number(body.page)) && body.page != null ? Math.max(1, Math.round(Number(body.page))) : 1,
        createdAt: nowIso(now()),
      };
      vocab.push(fila);
      guardarColeccion("vocab", vocab);
      return json(201, { entry: entryVocab(fila) });
    }

    function importarVocab(body) {
      var entries = Array.isArray(body.entries) ? body.entries : [];
      if (entries.length === 0) return json(200, { imported: 0 });
      if (entries.length > 1000) return error(413, "Demasiadas entradas (máx 1000)");
      var vocab = coleccion("vocab", []);
      var clave = function (w, l) { return `${l}\u0000${String(w).toLowerCase()}`; };
      var yaEstan = new Set(vocab.map(function (v) { return clave(v.word, v.lang); }));
      var vistos = new Set();
      var nuevas = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i] || {};
        var word = typeof e.word === "string" ? e.word.trim().slice(0, 200) : "";
        if (!word) continue;
        var lang = e.lang === "en" ? "en" : "es";
        var k = clave(word, lang);
        if (yaEstan.has(k) || vistos.has(k)) continue;
        vistos.add(k);
        nuevas.push({
          id: String(uuid()).replace(/-/g, "").slice(0, 24),
          word: word,
          lang: lang,
          short: typeof e.short === "string" ? e.short.slice(0, 2000) : "",
          bookId: typeof e.bookId === "string" && e.bookId !== "" ? e.bookId.slice(0, 64) : null,
          bookTitle: typeof e.bookTitle === "string" ? e.bookTitle.slice(0, 200) : "",
          page: Number.isFinite(Number(e.page)) && e.page != null ? Math.max(1, Math.round(Number(e.page))) : 1,
          createdAt: nowIso(now()),
        });
      }
      if (nuevas.length > 0) guardarColeccion("vocab", vocab.concat(nuevas));
      return json(200, { imported: nuevas.length });
    }

    function borrarVocab(id) {
      guardarColeccion("vocab", coleccion("vocab", []).filter(function (v) { return v.id !== id; }));
      return json(200, { ok: true });
    }

    // ---------------------------------------------------------- progreso

    function resetearTodo() {
      var sessions = coleccion("sessions", []);
      var books = coleccion("books", []).map(function (b) {
        return Object.assign({}, b, { currentPage: 1, finishedAt: null, readCount: 0 });
      });
      guardarColeccion("badges", []);
      guardarColeccion("sessions", []);
      guardarColeccion("books", books);
      return json(200, { ok: true, books: books.length, sessions: sessions.length });
    }

    // -------------------------------------------------------- teleprompter

    function subirFondo(ctx) {
      return formDataDe(ctx).then(function (form) {
        var file = form.file;
        var ok = ["image/png", "image/jpeg", "image/webp", "image/avif"].indexOf(file && file.type) >= 0;
        if (!file || !ok) return error(415, "Hace falta una imagen (png, jpg, webp o avif)");
        if (file.size > MAX_IMAGEN) return error(413, "La imagen pasa de 8 MB");
        return Promise.resolve(blobToDataUrl(file.blob)).then(function (dataUrl) {
          if (!dataUrl) return error(500, "No se pudo guardar la imagen");
          var stored = meta.get("settings") || { settings: ajustesPorDefecto(), biblioteca: { carpeta: "" }, _doc: {} };
          stored.settings = Object.assign({}, stored.settings, {
            teleprompter: Object.assign({}, ajustesPorDefecto().teleprompter, stored.settings && stored.settings.teleprompter, {
              fondo: "imagen",
              // data URL: los <img> no pasan por fetch y así se ve sin red
              fondoRuta: dataUrl,
            }),
          });
          meta.set("settings", stored);
          return json(201, { ok: true, ruta: dataUrl });
        });
      }, function () {
        return error(400, "No se pudo leer la imagen");
      });
    }

    // -------------------------------------------------------- diccionario
    // En APK no hay proxy de servidor: el diccionario se consulta DIRECTO
    // desde el cliente (dictionaryapi.dev, rae-api.com y Datamuse permiten
    // CORS). Sin internet → found:false, y la UI muestra «sin resultados».

    function crearBuscadorDiccionario(fetchImpl) {
      var cache = new Map();
      var CACHE_MAX = 300;

      function fetchJson(url, timeoutMs) {
        var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 6500);
        return fetchImpl(url, { signal: ctrl ? ctrl.signal : undefined, cache: "no-store" })
          .then(function (res) { return res.ok ? res.json() : null; })
          .catch(function () { return null; })
          .finally(function () { clearTimeout(timer); });
      }

      function wiktionary(word, lang) {
        return fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word.toLowerCase())}`).then(function (arr) {
          if (!Array.isArray(arr) || arr.length === 0) return null;
          var first = arr[0];
          var audio = null;
          (first.phonetics || []).some(function (p) { if (p.audio) { audio = p.audio; return true; } return false; });
          var entries = (first.meanings || []).slice(0, 5).map(function (m) {
            return {
              pos: m.partOfSpeech || "",
              defs: (m.definitions || []).slice(0, 4)
                .map(function (d) { return { d: (d.definition || "").trim(), ex: (d.example || "").trim() || undefined }; })
                .filter(function (d) { return d.d.length > 0; }),
            };
          }).filter(function (e) { return e.defs.length > 0; });
          if (entries.length === 0) return null;
          return {
            word: first.word || word, lang: lang, found: true,
            phonetic: first.phonetic || undefined, audio: audio || undefined,
            entries: entries, source: "Wiktionary (dictionaryapi.dev)",
          };
        });
      }

      function datamuse(word) {
        return fetchJson(`https://api.datamuse.com/words?sp=${encodeURIComponent(word.toLowerCase())}&md=d&max=3`).then(function (arr) {
          if (!Array.isArray(arr) || arr.length === 0) return null;
          var first = arr.find(function (a) { return a.defs && a.defs.length; }) || arr[0];
          if (!first.defs || !first.defs.length) return null;
          var POS = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", u: "" };
          var byPos = new Map();
          first.defs.forEach(function (raw) {
            var partes = raw.split(/\t/);
            var posCode = partes[0], text = partes[1];
            if (!text) return;
            var pos = POS[posCode] !== undefined ? POS[posCode] : "";
            var lista = byPos.get(pos) || [];
            if (lista.length < 4) lista.push(String(text).trim());
            byPos.set(pos, lista);
          });
          var entries = [...byPos.entries()].slice(0, 4).map(function (par) {
            return { pos: par[0], defs: par[1].map(function (d) { return { d: d }; }) };
          });
          if (entries.length === 0) return null;
          return { word: first.word || word, lang: "en", found: true, entries: entries, source: "WordNet (Datamuse)" };
        });
      }

      function rae(word) {
        return fetchJson(`https://rae-api.com/api/words/${encodeURIComponent(word.toLowerCase())}`).then(function (data) {
          if (!data || !data.ok || !data.data || !data.data.meanings || !data.data.meanings.length) return null;
          var POS_ES = {
            noun: "sustantivo", adjective: "adjetivo", verb: "verbo", adverb: "adverbio",
            pronoun: "pronombre", preposition: "preposición", conjunction: "conjunción", interjection: "interjección",
          };
          var entries = data.data.meanings.map(function (m) {
            var senses = m.senses || [];
            var first = senses[0];
            var posBits = [
              first && first.category ? POS_ES[first.category] || first.category : "",
              first && first.gender ? ` ${first.gender}` : "",
            ].join("").trim();
            return {
              pos: posBits || "definición",
              defs: senses.slice(0, 4).map(function (s) {
                var d = (s.description || "").trim() || String(s.raw || "").replace(/^\s*\d+\.\s*/, "").replace(/\s*Sin\.:.*$/, "").trim();
                return { d: d, ex: s.examples && s.examples[0] };
              }).filter(function (d) { return d.d.length > 0; }),
              synonyms: first && first.synonyms ? first.synonyms.slice(0, 6) : undefined,
            };
          }).filter(function (e) { return e.defs.length > 0; });
          if (entries.length === 0) return null;
          return {
            word: word, lang: "es", found: true,
            origin: data.data.meanings[0] && data.data.meanings[0].origin ? data.data.meanings[0].origin.raw || undefined : undefined,
            entries: entries, source: "RAE (rae-api.com)",
          };
        });
      }

      function lookupEs(word) {
        return rae(word).then(function (res) {
          if (res) return res;
          return wiktionary(word, "es");
        }).then(function (res) {
          return res || { word: word, lang: "es", found: false, entries: [], source: "RAE (rae-api.com)" };
        });
      }

      function lookupEn(word) {
        return wiktionary(word, "en").then(function (res) {
          if (res) return res;
          return datamuse(word);
        }).then(function (res) {
          return res || { word: word, lang: "en", found: false, entries: [], source: "dictionaryapi.dev" };
        });
      }

      return function diccionario(search) {
        var params = new URLSearchParams(search || "");
        var word = String(params.get("word") || "").trim().toLowerCase().slice(0, 60);
        var langParam = params.get("lang") || "auto";
        if (!word || !/[a-záéíóúñü]/i.test(word)) return Promise.resolve(error(400, "Palabra inválida"));
        var cacheKey = `${langParam}:${word}`;
        var hit = cache.get(cacheKey);
        if (hit) return Promise.resolve(json(200, hit));

        var p;
        if (langParam === "es") p = lookupEs(word);
        else if (langParam === "en") p = lookupEn(word);
        else {
          var looksSpanish = /[ñáéíóúü¿¡]/.test(word);
          p = Promise.all([lookupEs(word), lookupEn(word)]).then(function (r) {
            var es = r[0], en = r[1];
            var spanishPriority = looksSpanish || es.found || !en.found;
            return spanishPriority ? (es.found ? es : en) : en;
          });
        }
        return p.then(function (final) {
          if (cache.size >= CACHE_MAX) {
            var firstKey = cache.keys().next().value;
            if (firstKey) cache.delete(firstKey);
          }
          cache.set(cacheKey, final);
          return json(200, final);
        });
      };
    }

    // ------------------------------------------------------------- router

    /**
     * Punto de entrada del motor: reparte (método, ruta, search, ctx) a las
     * rutas de la API replicadas. El JSDoc clava el tipo para el tsc (con
     * allowJs el test lo consume tipado: Promise<{status, json?, blob?,
     * headers?}>) — no cambia nada en runtime.
     */
    // ------------------------------------------------ sync (copia de la casa)
    //
    // Enmienda 1: copia directa entre dispositivos de la dueña, a mano y por
    // LAN. Este módulo vive DENTRO del núcleo (toca las colecciones) y NO es
    // un contrato del API: es el puente APK ↔ servidor. Las mismas reglas del
    // lado servidor viven en src/core/sync.ts (testeadas en ambos lados).
    //
    //   exportar()       → estado completo del APK (el teléfono manda)
    //   aplicar(remoto)  → aplica el estado del servidor (el ordenador manda)

    /** nombres de fichero propios de la biblioteca (precarga OPFS) */
    function prepararNombres() {
      var nombres = [];
      coleccion("books", []).forEach(function (b) {
        if (b.filePath) nombres.push(baseName(b.filePath));
        if (b.coverPath && b.coverPath.startsWith("/uploads/")) nombres.push(baseName(b.coverPath));
      });
      return nombres;
    }

    /** estado completo para llevar a otra máquina */
    function exportarEstado() {
      var books = coleccion("books", []).slice();
      var por = sesionesPorLibro();
      var badges = coleccion("badges", []);
      var stored = meta.get("settings");
      return Promise.all(books.map(function (b) { return coverDataUrlDe(b); })).then(function (covers) {
        return {
          exportedAt: nowIso(now()),
          books: books.map(function (b, i) {
            return Object.assign({}, b, {
              cover: covers[i],
              badge: badges.find(function (x) { return x.bookId === b.id; }) || null,
              sessions: por.get(b.id) || [],
            });
          }),
          settings: (stored && stored.settings) || ajustesPorDefecto(),
          vocab: coleccion("vocab", []).slice(),
        };
      });
    }

    /** las sesiones del libro se sustituyen por las que llegan (por día) */
    function sustituirSesiones(sessions, bookId, filas) {
      var limpias = (Array.isArray(filas) ? filas : []).slice(0, 5000).map(function (s) {
        var d = s && typeof s.date === "string" && s.date ? new Date(s.date) : null;
        return {
          id: String(uuid()).replace(/-/g, "").slice(0, 24),
          bookId: bookId,
          pagesRead: Math.max(0, Math.round(Number(s && s.pagesRead) || 0)),
          minutes: Math.max(0, Math.round(Number(s && s.minutes) || 0)),
          date: d && !isNaN(d.getTime()) ? d.toISOString() : nowIso(now()),
        };
      }).filter(function (s) { return s.pagesRead > 0 || s.minutes > 0; });
      return sessions.filter(function (s) { return s.bookId !== bookId; }).concat(limpias);
    }

    /** insignia del libro: la remota manda (upsert con id local o fuera) */
    function sincronizarInsignia(badges, remota, localId) {
      var resto = badges.filter(function (x) { return x.bookId !== localId; });
      if (remota && typeof remota === "object") {
        resto.push({
          id: remota.id && typeof remota.id === "string" ? remota.id : String(uuid()).replace(/-/g, "").slice(0, 24),
          bookId: localId,
          tier: Math.min(4, Math.max(1, Math.round(Number(remota.tier) || 1))),
          readings: Math.max(1, Math.round(Number(remota.readings) || 1)),
          earnedAt: remota.earnedAt || nowIso(now()),
          updatedAt: remota.updatedAt || nowIso(now()),
        });
      }
      return resto;
    }

    /**
     * Aplica el estado del servidor (books con sessions + coverUrl, settings,
     * vocabulary). «El que manda» gana; los libros que solo existen aquí se
     * quedan (una copia nunca borra). Devuelve informe con los ficheros que
     * faltan por descargar (degradación en silencio: se piden fuera).
     */
    function aplicarEntrante(remoto) {
      var informe = { actualizados: 0, nuevos: 0, ficheros: [] };
      var books = coleccion("books", []).slice();
      var sessions = coleccion("sessions", []).slice();
      var badges = coleccion("badges", []).slice();
      var remotos = remoto && Array.isArray(remoto.books) ? remoto.books : [];

      remotos.forEach(function (r) {
        if (!r || typeof r !== "object") return;
        var nombre = typeof r.fileName === "string" ? r.fileName : "";
        var total = Math.round(Number(r.totalPages));
        if (!nombre || !Number.isFinite(total) || total <= 0) return; // libro roto: se ignora

        var local = null;
        for (var i = 0; i < books.length; i++) {
          if (books[i].id === r.id) { local = books[i]; break; }
        }
        if (!local) {
          for (var j = 0; j < books.length; j++) {
            if (books[j].fileName === nombre && books[j].totalPages === total) { local = books[j]; break; }
          }
        }

        if (local) {
          Object.assign(local, {
            title: typeof r.title === "string" && r.title.trim() ? r.title : local.title,
            author:
              r.author === null
                ? null
                : typeof r.author === "string" && r.author.trim()
                  ? r.author
                  : local.author,
            totalPages: total,
            currentPage: Math.min(Math.max(1, Math.round(Number(r.currentPage) || 1)), Math.max(1, total)),
            milestones:
              r.milestones === undefined
                ? local.milestones
                : r.milestones === null
                  ? null
                  : clampInt(r.milestones, 2, 40, local.milestones),
            dailyGoal:
              r.dailyGoal === undefined
                ? local.dailyGoal
                : r.dailyGoal === null
                  ? null
                  : clampInt(r.dailyGoal, 1, 500, local.dailyGoal),
            extras: r.extras === undefined ? local.extras : r.extras && typeof r.extras === "object" ? r.extras : null,
            finishedAt: r.finishedAt || null,
            readCount: Math.max(0, Math.round(Number(r.readCount) || 0)),
            lastReadAt: r.lastReadAt || local.lastReadAt,
          });
          var faltaFichero = !files.read(baseName(local.filePath));
          var faltaCover = !local.coverPath && !!r.coverPath;
          if (faltaFichero || faltaCover) {
            informe.ficheros.push({
              bookId: local.id,
              archivoUrl: r.archivoUrl || `/api/books/${r.id}/file`,
              coverUrl: faltaCover ? r.coverUrl || `/api/books/${r.id}/cover` : null,
            });
          }
          badges = sincronizarInsignia(badges, r.badge, local.id);
          sessions = sustituirSesiones(sessions, local.id, r.sessions);
          informe.actualizados++;
        } else {
          var usado = {};
          books.forEach(function (b) { usado[b.id] = true; });
          var idNuevo = esIdSeguro(r.id) && !usado[r.id] ? r.id : idLibro(uuid);
          var ext = /\.epub$/i.test(String(r.filePath || r.fileName || "")) ? "epub" : "pdf";
          var fila = {
            id: idNuevo,
            title: typeof r.title === "string" && r.title.trim() ? r.title : "Sin título",
            author: typeof r.author === "string" && r.author.trim() ? r.author : null,
            fileName: nombre,
            filePath: `/uploads/${idNuevo}.${ext}`,
            coverPath: r.coverPath ? `/uploads/${idNuevo}-cover.png` : null,
            totalPages: total,
            currentPage: Math.min(Math.max(1, Math.round(Number(r.currentPage) || 1)), Math.max(1, total)),
            milestones: r.milestones === undefined || r.milestones === null ? null : clampInt(r.milestones, 2, 40, null),
            dailyGoal: r.dailyGoal === undefined || r.dailyGoal === null ? null : clampInt(r.dailyGoal, 1, 500, null),
            companionPath: null,
            companionPages: null,
            extras: r.extras && typeof r.extras === "object" ? r.extras : null,
            finishedAt: r.finishedAt || null,
            readCount: Math.max(0, Math.round(Number(r.readCount) || 0)),
            createdAt: r.createdAt || nowIso(now()),
            lastReadAt: r.lastReadAt || null,
            origin: "subido",
            fileHash: null,
            fileBytes: null,
            fileMtime: null,
            fileMissingAt: null,
          };
          books.push(fila);
          badges = sincronizarInsignia(badges, r.badge, idNuevo);
          sessions = sustituirSesiones(sessions, idNuevo, r.sessions);
          informe.ficheros.push({
            bookId: idNuevo,
            archivoUrl: r.archivoUrl || `/api/books/${r.id}/file`,
            coverUrl: r.coverPath ? r.coverUrl || `/api/books/${r.id}/cover` : null,
          });
          informe.nuevos++;
        }
      });

      guardarColeccion("books", books);
      guardarColeccion("sessions", sessions);
      guardarColeccion("badges", badges);

      // ajustes: el que manda gana; la carpeta de biblioteca es de ESTA máquina
      if (remoto && remoto.settings && typeof remoto.settings === "object") {
        var stored = meta.get("settings") || { settings: ajustesPorDefecto(), biblioteca: { carpeta: "" }, _doc: {} };
        meta.set("settings", {
          settings: Object.assign({}, ajustesPorDefecto(), remoto.settings),
          biblioteca: stored.biblioteca || { carpeta: "" },
          _doc: remoto._doc && typeof remoto._doc === "object" ? remoto._doc : stored._doc || {},
        });
      }

      // vocabulario: reemplazo limpio por el que manda (dedupe palabra+idioma)
      if (remoto && Array.isArray(remoto.vocabulary)) {
        var vistas = {};
        var vocab = [];
        remoto.vocabulary.slice(0, 500).forEach(function (v) {
          if (!v || typeof v.word !== "string" || !v.word.trim()) return;
          var lang = v.lang === "en" ? "en" : "es";
          var clave = v.word.trim().toLowerCase() + "|" + lang;
          if (vistas[clave]) return;
          vistas[clave] = true;
          vocab.push({
            id: esIdSeguro(v.id) ? v.id : String(uuid()).replace(/-/g, "").slice(0, 24),
            word: v.word.trim().slice(0, 100),
            lang: lang,
            short: typeof v.short === "string" ? v.short.slice(0, 2000) : "",
            bookId: typeof v.bookId === "string" && v.bookId ? v.bookId : null,
            bookTitle: typeof v.bookTitle === "string" ? v.bookTitle.slice(0, 255) : "",
            page: Math.max(1, Math.round(Number(v.page) || 1)),
            createdAt: typeof v.createdAt === "string" && v.createdAt ? v.createdAt : nowIso(now()),
          });
        });
        guardarColeccion("vocab", vocab);
      }

      return informe;
    }

    /**
     * Punto de entrada: (método, ruta, search, ctx) → Promise<respuesta>
     *
     * @param {{ fetchImpl?: (input: any, init?: any) => Promise<any> }} depsRouter
     * @returns {(metodo: string, pathname: string, search: string, ctx: any) => Promise<{status: number, json?: any, blob?: Blob, headers?: Record<string, string>}>}
     */
    function crearRouter(depsRouter) {
      var diccionario = crearBuscadorDiccionario(depsRouter.fetchImpl || (typeof fetch !== "undefined" ? fetch : function () {
        return Promise.reject(new Error("sin red"));
      }));

      /** Punto de entrada: (método, ruta, search, ctx) → Promise<respuesta> */
      return function handle(metodo, pathname, search, ctx) {
        return enCola(function () {
          return encolar(metodo, pathname, search, ctx, diccionario);
        });
      };
    }

    function encolar(metodo, pathname, search, ctx, diccionario) {
      var partes = pathname.replace(/\/+$/, "").split("/").filter(Boolean); // ["api", ...]
      var rest = partes.slice(1); // sin "api"

      // raíz de salud
      if (rest.length === 0) return Promise.resolve(json(200, { message: "Hello, world!" }));

      if (rest[0] === "books") {
        if (rest.length === 1) {
          if (metodo === "GET") return listarLibros();
          if (metodo === "POST") return subirLibro(ctx);
          return Promise.resolve(error(405, "Método no permitido"));
        }
        if (rest[1] === "undo" && rest.length === 2 && metodo === "POST") {
          return ctx.json().then(deshacerBorrado);
        }
        var id = rest[1];
        if (rest.length === 2) {
          if (metodo === "PATCH") return ctx.json().then(function (body) { return parchearProgreso(id, body); });
          if (metodo === "DELETE") return borrarLibro(id);
          return Promise.resolve(error(405, "Método no permitido"));
        }
        var sub = rest[2];
        if (sub === "file" && metodo === "GET") return servirFichero(id, search, ctx.rangeHeader);
        if (sub === "cover") {
          if (metodo === "GET") return servirCover(id);
          if (metodo === "POST") return subirCover(id, ctx);
        }
        if (sub === "companion") return companion(id, metodo, ctx);
        if (sub === "finish" && metodo === "POST") return Promise.resolve(terminarLibro(id));
        if (sub === "meta" && metodo === "PATCH") return ctx.json().then(function (body) { return parchearMeta(id, body); });
        if (sub === "reset" && metodo === "POST") return Promise.resolve(reiniciarLibro(id));
        if (sub === "relink" && metodo === "POST") {
          return Promise.resolve(error(400, "En la app no hay carpetas del sistema: los libros viven dentro de la propia app"));
        }
        return Promise.resolve(json(404, { error: "Ruta no encontrada" }));
      }

      if (rest[0] === "settings") {
        if (metodo === "GET") return Promise.resolve(json(200, leerAjustes()));
        if (metodo === "PUT") return ctx.json().then(escribirAjustes);
        return Promise.resolve(error(405, "Método no permitido"));
      }

      if (rest[0] === "vocab") {
        if (rest.length === 1) {
          if (metodo === "GET") return Promise.resolve(listarVocab());
          if (metodo === "POST") return ctx.json().then(crearVocab);
        }
        if (rest[1] === "import" && metodo === "POST") return ctx.json().then(importarVocab);
        if (rest.length === 2 && metodo === "DELETE") return Promise.resolve(borrarVocab(rest[1]));
        return Promise.resolve(json(404, { error: "Ruta no encontrada" }));
      }

      if (rest[0] === "progress" && rest[1] === "reset-all" && metodo === "POST") {
        return Promise.resolve(resetearTodo());
      }

      if (rest[0] === "dictionary" && metodo === "GET") return diccionario(search);

      if (rest[0] === "library" && rest[1] === "scan" && metodo === "POST") {
        return Promise.resolve(error(400, "En la app móvil no hay carpetas del sistema: sube tus libros con el botón +"));
      }

      if (rest[0] === "teleprompter" && rest[1] === "fondo") {
        if (metodo === "POST") return subirFondo(ctx);
        return Promise.resolve(json(404, { error: "La imagen no está" }));
      }

      if (rest[0] === "auth" && rest[1] === "login" && metodo === "POST") {
        return Promise.resolve(error(400, "Sin candado: la app local no lo necesita"));
      }

      return Promise.resolve(json(404, { error: "Ruta no encontrada" }));
    }

    return {
      handle: null, // se asigna con crearRouter
      crearRouter: crearRouter,
      ajustesPorDefecto: ajustesPorDefecto,
      // copia de la casa (Enmienda 1): exportar manda el estado del APK,
      // aplicar recibe el del servidor — ambos serializados en la cola.
      /**
       * @type {{
       *   exportar: () => Promise<{
       *     exportedAt: string,
       *     books: Array<Record<string, any> & { cover: string | null, badge: any, sessions: Array<{ pagesRead: number, minutes: number, date: string }> }>,
       *     settings: Record<string, any>,
       *     vocab: Array<Record<string, any>>,
       *   }>,
       *   aplicar: (remoto: {
       *     books?: Array<Record<string, any> | null>,
       *     settings?: Record<string, any>,
       *     _doc?: Record<string, string>,
       *     vocabulary?: Array<Record<string, any>>,
       *   }) => Promise<{
       *     actualizados: number,
       *     nuevos: number,
       *     ficheros: Array<{ bookId: string, archivoUrl: string, coverUrl: string | null }>,
       *   }>,
       * }}
       */
      sync: {
        exportar: function () {
          return enCola(exportarEstado);
        },
        aplicar: function (remoto) {
          return enCola(function () {
            return aplicarEntrante(remoto);
          });
        },
      },
      _internos: {
        diaLocal: diaLocal,
        esIdSeguro: esIdSeguro,
        dataUrlABlob: dataUrlABlob,
        UNDO_TTL_MS: UNDO_TTL_MS,
      },
    };
  }

  // ------------------------------------------------------------ browser

  /**
   * Adaptador OPFS asíncrono correcto: el núcleo pide read() síncrono, así que
   * la capa browser PRE-CARGA los blobs antes de atender la petición. Diseño:
   * `preparar(ids)` consulta OPFS y llena el mapa en memoria antes de cada
   * operación que pueda leer ficheros (GET file, GET books para portadas…).
   */
  function crearFilesAsync(meta) {
    var memoria = new Map();
    var opfsOk = typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.getDirectory === "function";

    function dir() {
      return navigator.storage.getDirectory();
    }
    function leeOpfs(nombre) {
      return dir()
        .then(function (d) { return d.getFileHandle(nombre, { create: false }); })
        .then(function (h) { return h.getFile(); })
        .then(function (f) { return f.size > 0 ? f : null; })
        .catch(function () { return null; });
    }
    function escribeOpfs(nombre, blob) {
      return dir()
        .then(function (d) { return d.getFileHandle(nombre, { create: true }); })
        .then(function (h) { return h.createWritable(); })
        .then(function (w) { return w.write(blob).then(function () { return w.close(); }); });
    }
    function borraOpfs(nombre) {
      return dir().then(function (d) { return d.removeEntry(nombre).catch(function () {}); });
    }
    function leeIdb(nombre) {
      var f = meta.get("__files__") || {};
      return Promise.resolve(f[nombre] || null);
    }
    function escribeIdb(nombre, blob) {
      var f = meta.get("__files__") || {};
      f[nombre] = blob;
      meta.set("__files__", f);
      return Promise.resolve();
    }
    function borraIdb(nombre) {
      var f = meta.get("__files__") || {};
      delete f[nombre];
      meta.set("__files__", f);
      return Promise.resolve();
    }

    return {
      /** precarga: nombres → memoria (OPFS o IDB) */
      preparar: function (nombres) {
        var pendientes = [];
        nombres.forEach(function (n) {
          if (n && !memoria.has(n)) pendientes.push(n);
        });
        if (pendientes.length === 0) return Promise.resolve();
        return Promise.all(
          pendientes.map(function (n) {
            var p = opfsOk ? leeOpfs(n).then(function (b) { return b || leeIdb(n); }) : leeIdb(n);
            return p.then(function (b) { memoria.set(n, b); });
          })
        ).then(function () {});
      },
      write: function (nombre, blob) {
        memoria.set(nombre, blob);
        return opfsOk ? escribeOpfs(nombre, blob).catch(function () { return escribeIdb(nombre, blob); }) : escribeIdb(nombre, blob);
      },
      read: function (nombre) {
        return memoria.get(nombre) || null;
      },
      del: function (nombre) {
        memoria.delete(nombre);
        return opfsOk ? borraOpfs(nombre).catch(function () { return borraIdb(nombre); }) : borraIdb(nombre);
      },
      move: function (de, a) {
        var blob = memoria.get(de);
        if (!blob) return Promise.resolve();
        memoria.set(a, blob);
        memoria.delete(de);
        var p1 = opfsOk ? escribeOpfs(a, blob).catch(function () { return escribeIdb(a, blob); }) : escribeIdb(a, blob);
        var p2 = opfsOk ? borraOpfs(de).catch(function () { return borraIdb(de); }) : borraIdb(de);
        return Promise.all([p1, p2]).then(function () {});
      },
    };
  }

  /** KV sobre IndexedDB con un único store de documentos. */
  function crearMetaIdb() {
    var dbPromise = null;
    var memoria = {}; // caché de escritura: el núcleo lee síncrono
    function db() {
      if (!dbPromise) {
        dbPromise = new Promise(function (resolve, reject) {
          var req = indexedDB.open("athena-offline", 1);
          req.onupgradeneeded = function () {
            var d = req.result;
            if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
          };
          req.onsuccess = function () { resolve(req.result); };
          req.onerror = function () { reject(req.error); };
        });
      }
      return dbPromise;
    }
    function idbGet(clave) {
      return db().then(function (d) {
        return new Promise(function (resolve) {
          var tx = d.transaction("kv", "readonly");
          var req = tx.objectStore("kv").get(clave);
          req.onsuccess = function () { resolve(req.result === undefined ? null : req.result); };
          req.onerror = function () { resolve(null); };
        });
      });
    }
    function idbSet(clave, valor) {
      return db().then(function (d) {
        return new Promise(function (resolve) {
          var tx = d.transaction("kv", "readwrite");
          tx.objectStore("kv").put(valor, clave);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        });
      });
    }
    var cargado = false;
    function cargar() {
      if (cargado) return Promise.resolve();
      return idbGet("__todas__claves__").then(function (claves) {
        var lista = claves || ["books", "sessions", "vocab", "badges", "undo", "settings", "__files__"];
        return Promise.all(lista.map(function (k) { return idbGet(k).then(function (v) { memoria[k] = v; }); }));
      }).then(function () { cargado = true; });
    }
    return {
      preparar: function () { return cargar(); },
      get: function (clave) { return memoria[clave] === undefined ? null : memoria[clave]; },
      set: function (clave, valor) {
        memoria[clave] = valor;
        var claves = idbClaves();
        if (claves.indexOf(clave) < 0) claves.push(clave);
        void idbSet("__todas__claves__", claves);
        void idbSet(clave, valor);
      },
      del: function (clave) {
        delete memoria[clave];
        var claves = idbClaves().filter(function (k) { return k !== clave; });
        void idbSet("__todas__claves__", claves);
      },
    };
    function idbClaves() {
      var c = memoria["__todas__claves__"];
      return Array.isArray(c) ? c : ["books", "sessions", "vocab", "badges", "undo", "settings", "__files__"];
    }
  }

  function blobADataUrl(blob) {
    return new Promise(function (resolve) {
      if (typeof FileReader === "undefined") return resolve(null);
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result)); };
      fr.onerror = function () { resolve(null); };
      fr.readAsDataURL(blob);
    });
  }

  /**
   * Instala el motor: parchea window.fetch y XMLHttpRequest para que TODO
   * lo que la app manda a /api/* se responda localmente. Devuelve un hook
   * `prepararFicheros(nombres)` para precargar OPFS antes de atender.
   */
  function install(opts) {
    opts = opts || {};
    if (typeof window === "undefined" || window.__ATHENA_OFFLINE_INSTALADO__) return null;
    if (!window.__ATHENA_APK__ && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
      return null; // self-host normal: el servidor manda, aquí no hacemos nada
    }
    window.__ATHENA_OFFLINE_INSTALADO__ = true;

    var meta = crearMetaIdb();
    var files = crearFilesAsync(meta);
    var núcleo = createCore({ files: files, meta: meta, blobToDataUrl: blobADataUrl });
    var router = núcleo.crearRouter({});
    var fetchNativo = window.fetch.bind(window);

    // ---- copia de la casa (Enmienda 1): puente red del módulo sync del núcleo
    // Los fetches van SIEMPRE por fetchNativo (URL absoluta a otro origen: el
    // parche de fetch no los toca) y se autentican con X-Athena-Token.
    function conToken(token) {
      return { "X-Athena-Token": String(token || "") };
    }

    function pedirJson(base, ruta, token) {
      return fetchNativo(base + ruta, { headers: conToken(token) }).then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, status: r.status, json: j };
        });
      });
    }

    var sync = {
      /** prueba de conexión: cuántos libros hay en la otra máquina */
      probar: function (base, token) {
        return pedirJson(base, "/api/books", token).then(function (r) {
          if (!r.ok) throw new Error((r.json && r.json.error) || "HTTP " + r.status);
          return { libros: (r.json.books || []).length };
        });
      },

      /** el ordenador manda: estado + ficheros que falten (en silencio si fallan) */
      traerDe: function (base, token, nota) {
        nota = nota || function () {};
        return Promise.all([
          pedirJson(base, "/api/books", token),
          pedirJson(base, "/api/settings", token),
          pedirJson(base, "/api/vocab", token),
        ])
          .then(function (rs) {
            var libros = rs[0], ajustes = rs[1], vocab = rs[2];
            if (!libros.ok) throw new Error((libros.json && libros.json.error) || "HTTP " + libros.status);
            return files.preparar(prepararNombres()).then(function () {
              return núcleo.sync.aplicar({
                books: libros.json.books || [],
                settings: ajustes.ok ? (ajustes.json || {}).settings : undefined,
                _doc: ajustes.ok ? (ajustes.json || {})._doc : undefined,
                vocabulary: vocab.ok ? (vocab.json || {}).vocabulary : undefined,
              });
            });
          })
          .then(function (informe) {
            nota({ fase: "datos", actualizados: informe.actualizados, nuevos: informe.nuevos });
            var pendientes = informe.ficheros || [];
            var p = Promise.resolve();
            pendientes.forEach(function (d) {
              p = p.then(function () {
                nota({ fase: "fichero", total: pendientes.length });
                return fetchNativo(base + d.archivoUrl, { headers: conToken(token) })
                  .then(function (r) {
                    return r.ok ? r.blob() : null;
                  })
                  .then(function (blob) {
                    if (!blob) return null; // degradación en silencio (Enmienda 1)
                    var fila = (meta.get("books") || []).find(function (b) { return b.id === d.bookId; });
                    if (!fila || !fila.filePath) return null;
                    return files.write(baseName(fila.filePath), blob).then(function () {
                      if (!d.coverUrl || !fila.coverPath) return null;
                      return fetchNativo(base + d.coverUrl, { headers: conToken(token) })
                        .then(function (rc) {
                          return rc.ok ? rc.blob() : null;
                        })
                        .then(function (cb) {
                          return cb ? files.write(baseName(fila.coverPath), cb) : null;
                        });
                    });
                  })
                  .catch(function () {
                    return null;
                  });
              });
            });
            return p.then(function () {
              return informe;
            });
          });
      },

      /** el teléfono manda: libro a libro (fichero incluido) y luego meta */
      enviarA: function (base, token, nota) {
        nota = nota || function () {};
        return files
          .preparar(prepararNombres())
          .then(function () {
            return núcleo.sync.exportar();
          })
          .then(function (estado) {
            var p = Promise.resolve();
            estado.books.forEach(function (b) {
              p = p.then(function () {
                nota({ fase: "libro", titulo: b.title, total: estado.books.length });
                var fd = new FormData();
                var copia = Object.assign({}, b);
                delete copia.cover; // la portada viaja en su campo
                fd.append("book", JSON.stringify(copia));
                var blob = files.read(baseName(b.filePath));
                if (blob) fd.append("file", blob, b.fileName || "libro.pdf");
                if (b.cover) fd.append("cover", b.cover);
                return fetchNativo(base + "/api/sync/book", {
                  method: "POST",
                  headers: conToken(token),
                  body: fd,
                }).then(function (r) {
                  if (!r.ok) {
                    return r.json().then(function (j) {
                      throw new Error((j && j.error) || "HTTP " + r.status);
                    });
                  }
                  return r.json();
                });
              });
            });
            return p
              .then(function () {
                nota({ fase: "meta" });
                return fetchNativo(base + "/api/sync/meta", {
                  method: "POST",
                  headers: Object.assign({ "Content-Type": "application/json" }, conToken(token)),
                  body: JSON.stringify({ settings: estado.settings, vocab: estado.vocab }),
                });
              })
              .then(function (r) {
                if (!r.ok) {
                  return r.json().then(function (j) {
                    throw new Error((j && j.error) || "HTTP " + r.status);
                  });
                }
                return { libros: estado.books.length };
              });
          });
      },
    };

    /** nombres de fichero que una petición puede leer (precarga OPFS) */
    function nombresPara(metodo, pathname, body) {
      var nombres = [];
      var m = pathname.match(/^\/api\/books\/([^/]+)(?:\/(file|cover|companion))?/);
      if (m) {
        var fila = (meta.get("books") || []).find(function (b) { return b.id === decodeURIComponent(m[1]); });
        if (fila) {
          if (m[2] === "companion" && fila.companionPath) nombres.push(baseName(fila.companionPath));
          else if (m[2] === "cover" && fila.coverPath) nombres.push(baseName(fila.coverPath));
          else if (!m[2] || m[2] === "file") {
            if (fila.filePath) nombres.push(baseName(fila.filePath));
            if (fila.companionPath) nombres.push(baseName(fila.companionPath));
            if (fila.coverPath) nombres.push(baseName(fila.coverPath));
          }
        }
      }
      if (metodo === "GET" && pathname === "/api/books") {
        (meta.get("books") || []).forEach(function (b) {
          if (b.coverPath && b.coverPath.startsWith("/uploads/")) nombres.push(baseName(b.coverPath));
        });
      }
      return nombres;
    }

    function responder(núcleoResp) {
      if (núcleoResp.blob) {
        return Promise.resolve(new Response(núcleoResp.blob, { status: núcleoResp.status, headers: núcleoResp.headers || {} }));
      }
      var cuerpo = núcleoResp.json === undefined ? "" : JSON.stringify(núcleoResp.json);
      return Promise.resolve(new Response(cuerpo, {
        status: núcleoResp.status,
        headers: Object.assign({ "Content-Type": "application/json" }, núcleoResp.headers || {}),
      }));
    }

    function ctxDe(init, bodyParseado) {
      var headers = (init && init.headers) || null;
      function header(nombre) {
        if (!headers) return null;
        if (typeof headers.get === "function") return headers.get(nombre);
        for (var k in headers) {
          if (k.toLowerCase() === nombre.toLowerCase()) return headers[k];
        }
        return null;
      }
      return {
        rangeHeader: header("range"),
        json: function () {
          if (bodyParseado && bodyParseado.json !== undefined) return Promise.resolve(bodyParseado.json);
          if (init && typeof init.body === "string") {
            try { return Promise.resolve(JSON.parse(init.body)); } catch (e) { return Promise.resolve({}); }
          }
          return Promise.resolve({});
        },
        formData: function () {
          var fd = bodyParseado && bodyParseado.formData;
          if (fd) return Promise.resolve(fd);
          if (init && init.body && typeof FormData !== "undefined" && init.body instanceof FormData) {
            return extraerFormData(init.body);
          }
          return Promise.reject(new Error("sin cuerpo"));
        },
      };
    }

    function extraerFormData(fd) {
      var campos = { fields: {}, file: null };
      var promesas = [];
      fd.forEach(function (valor, clave) {
        if (typeof valor === "string") {
          campos.fields[clave] = valor;
        } else if (valor && typeof valor === "object" && typeof valor.size === "number") {
          campos.file = {
            name: valor.name || clave,
            type: valor.type || "",
            size: valor.size,
            blob: valor,
          };
        }
      });
      return Promise.all(promesas).then(function () { return campos; });
    }

    function manejable(url) {
      try {
        var u = new URL(url, window.location.origin);
        return u.origin === window.location.origin && u.pathname.startsWith("/api/");
      } catch (e) {
        return false;
      }
    }

    function atender(metodo, url, init, bodyParseado) {
      var u = new URL(url, window.location.origin);
      return meta.preparar().then(function () {
        return files.preparar(nombresPara(metodo, u.pathname, bodyParseado));
      }).then(function () {
        var ctx = ctxDe(init, bodyParseado);
        return router(metodo, u.pathname, u.search, ctx);
      });
    }

    // ---- parche fetch
    window.fetch = function (input, init) {
      // pdf.js v6 pasa un objeto URL (no un string ni un Request): .url no
      // existe ahí, hay que usar .href — si no, la petición se escaparía al
      // servidor estático y pdf.js recibiría un 404.
      var url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input && input.url) || "";
      var metodo = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (!manejable(url)) return fetchNativo(input, init);
      // pdfjs (y otros) pasan un Request con sus cabeceras (Range): normalizar
      if (!init && input && typeof input === "object" && input.headers) {
        init = { method: input.method, headers: input.headers };
      }
      var bodyParseado = null;
      var body = init && init.body;
      if (body && typeof FormData !== "undefined" && body instanceof FormData) {
        return extraerFormData(body).then(function (fd) {
          return atender(metodo, url, init, { formData: fd });
        }).then(responder, function (e) {
          console.error("[athena-offline]", metodo, url, e);
          return new Response(JSON.stringify({ error: "Error interno offline" }), { status: 500, headers: { "Content-Type": "application/json" } });
        });
      }
      if (body && typeof body === "string") {
        try { bodyParseado = { json: JSON.parse(body) }; } catch (e) { bodyParseado = null; }
      }
      return atender(metodo, url, init, bodyParseado).then(responder, function (e) {
        console.error("[athena-offline]", metodo, url, e);
        return new Response(JSON.stringify({ error: "Error interno offline" }), { status: 500, headers: { "Content-Type": "application/json" } });
      });
    };

    // ---- parche XMLHttpRequest (subida de libros con progreso)
    var XHRNativo = window.XMLHttpRequest;
    function XHRAthena() {
      this._metodo = "GET";
      this._url = "";
      this._headers = {};
      this._status = 0;
      this._responseText = "";
      this._listo = 0;
      var self = this;
      this.upload = {
        onprogress: null,
        onload: null,
        onerror: null,
      };
      this.onload = null;
      this.onerror = null;
      this.onreadystatechange = null;
      this.readyState = 0;
      this.status = 0;
      this.responseText = "";
      this.response = "";
      this._xhr = new XHRNativo(); // por si hay que passthrough
    }
    XHRAthena.prototype.open = function (metodo, url) {
      this._metodo = String(metodo || "GET").toUpperCase();
      this._url = String(url || "");
    };
    XHRAthena.prototype.setRequestHeader = function (k, v) {
      this._headers[String(k).toLowerCase()] = String(v);
    };
    XHRAthena.prototype.getAllResponseHeaders = function () {
      return this._status ? "content-type: application/json\r\n" : "";
    };
    XHRAthena.prototype.getResponseHeader = function (k) {
      return String(k).toLowerCase() === "content-type" && this._status ? "application/json" : null;
    };
    XHRAthena.prototype.abort = function () {};
    XHRAthena.prototype.send = function (body) {
      var self = this;
      if (!manejable(this._url)) {
        // passthrough real (no debería ocurrir: la app solo habla /api)
        this._xhr.open(this._metodo, this._url, true);
        this._xhr.onload = function () {
          self._status = self._xhr.status;
          self._responseText = String(self._xhr.responseText || "");
          self._terminar();
        };
        this._xhr.onerror = function () { if (self.onerror) self.onerror(new Event("error")); };
        Object.keys(this._headers).forEach(function (k) { self._xhr.setRequestHeader(k, self._headers[k]); });
        this._xhr.send(body);
        return;
      }
      var init = { method: this._metodo, headers: this._headers };
      var bodyParseado = null;
      var promesa;
      if (body && typeof FormData !== "undefined" && body instanceof FormData) {
        promesa = extraerFormData(body).then(function (fd) {
          // progreso sintético de subida: local = instantáneo
          if (self.upload.onload) setTimeout(function () { self.upload.onload({ lengthComputable: true, loaded: 1, total: 1 }); }, 0);
          return atender(self._metodo, self._url, init, { formData: fd });
        });
      } else if (typeof body === "string") {
        try { bodyParseado = { json: JSON.parse(body) }; } catch (e) { bodyParseado = null; }
        promesa = atender(self._metodo, self._url, init, bodyParseado);
      } else {
        promesa = atender(self._metodo, self._url, init, null);
      }
      promesa.then(function (resp) {
        self._status = resp.status;
        self._responseText = resp.blob ? "" : JSON.stringify(resp.json === undefined ? {} : resp.json);
        self._terminar();
      }, function (e) {
        console.error("[athena-offline] XHR", self._metodo, self._url, e);
        self._status = 500;
        self._responseText = JSON.stringify({ error: "Error interno offline" });
        self._terminar();
      });
    };
    XHRAthena.prototype._terminar = function () {
      this.readyState = 4;
      this.status = this._status;
      this.responseText = this._responseText;
      this.response = this._responseText;
      if (this.onreadystatechange) this.onreadystatechange(new Event("readystatechange"));
      if (this.status >= 200 && this.status < 300) {
        if (this.onload) this.onload(new Event("load"));
      } else if (this.onerror) {
        this.onerror(new Event("error"));
      }
    };
    window.XMLHttpRequest = XHRAthena;

    return { _nucleo: núcleo, _meta: meta, _files: files, sync: sync };
  }

  // Auto-arranque: en la build del APK el layout inyecta el flag ANTES de este
  // script, así que el motor se instala aquí mismo, antes del primer bundle de
  // React (estamos DENTRO de la factory: install está en scope). En self-host
  // (sin flag, sin Capacitor) install() no hace nada: coste cero.
  if (typeof window !== "undefined" && window.__ATHENA_APK__) {
    try {
      // la UI de la copia (SyncDialog) llega al puente por window.__athenaOffline
      window.__athenaOffline = install() || window.__athenaOffline;
    } catch (e) {
      console.error("[athena-offline] arranque falló", e);
    }
  }

  return {
    createCore: createCore,
    install: install,
    ajustesPorDefecto: ajustesPorDefecto,
  };
});
