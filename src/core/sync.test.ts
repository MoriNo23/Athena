import { describe, test, expect } from "bun:test";
import {
  libroApto,
  emparejar,
  idAceptable,
  paginaSegura,
  hitosSeguros,
  metaSegura,
  extrasSeguros,
  sesionesSanas,
  insigniaSana,
  vocabSano,
  camposGanadores,
} from "./sync";

const libroBase = {
  title: "El mundo de Sofía",
  author: "Jostein Gaarder",
  fileName: "sofia.pdf",
  totalPages: 670,
  currentPage: 120,
};

describe("sync · libroApto", () => {
  test("acepta el mínimo de la casa y rechaza basura", () => {
    expect(libroApto(libroBase)).toBe(true);
    expect(libroApto({ ...libroBase, title: "  " })).toBe(false);
    expect(libroApto({ ...libroBase, fileName: "" })).toBe(false);
    expect(libroApto({ ...libroBase, totalPages: 0 })).toBe(false);
    expect(libroApto({ ...libroBase, totalPages: "670" })).toBe(true); // número en string: Number() manda
    expect(libroApto(null)).toBe(false);
    expect(libroApto("sofia")).toBe(false);
  });
});

describe("sync · emparejar", () => {
  const existentes = [
    { id: "buno", fileName: "sofia.pdf", totalPages: 670 },
    { id: "bdos", fileName: "quijote.pdf", totalPages: 863 },
  ];
  test("por id primero (copia anterior), luego fileName+totalPages", () => {
    expect(emparejar({ ...libroBase, id: "bdos" }, existentes)?.id).toBe("bdos");
    expect(emparejar(libroBase, existentes)?.id).toBe("buno");
  });
  test("mismo nombre con páginas distintas NO empareja (edición distinta)", () => {
    expect(emparejar({ ...libroBase, totalPages: 671 }, existentes)).toBeNull();
  });
  test("sin coincidencia → null", () => {
    expect(emparejar({ ...libroBase, fileName: "otro.pdf" }, existentes)).toBeNull();
  });
});

describe("sync · idAceptable", () => {
  test("patrón seguro de la casa y libre", () => {
    expect(idAceptable("babcd1234abcd1234", new Set())).toBe("babcd1234abcd1234");
    expect(idAceptable("babcd1234abcd1234", new Set(["babcd1234abcd1234"]))).toBeNull();
    expect(idAceptable("../etc/passwd", new Set())).toBeNull();
    expect(idAceptable("corto", new Set())).toBeNull(); // <8 chars
    expect(idAceptable(123, new Set())).toBeNull();
  });
});

describe("sync · clamps", () => {
  test("página, hitos y meta con los mismos techos que el API", () => {
    expect(paginaSegura(999, 670)).toBe(670);
    expect(paginaSegura(0, 670)).toBe(1);
    expect(paginaSegura("no-soy-número", 670)).toBe(1);
    expect(hitosSeguros(99)).toBe(40);
    expect(hitosSeguros(1)).toBe(2);
    expect(hitosSeguros(null)).toBeNull();
    expect(metaSegura(900)).toBe(500);
    expect(metaSegura(undefined)).toBeNull();
  });
  test("extras: objeto ≤512 KB pasa, lo demás se descarta", () => {
    expect(extrasSeguros({ xray: [] })).toEqual({ xray: [] });
    expect(extrasSeguros(null)).toBeNull();
    expect(extrasSeguros("no-object")).toBeNull();
    const gordo = { text: "x".repeat(513 * 1024) };
    expect(extrasSeguros(gordo)).toBeNull();
  });
});

describe("sync · sesionesSanas", () => {
  test("sanea números y fechas, descarta filas vacías y respeta el tope", () => {
    const filas = [
      { pagesRead: 12, minutes: 30, date: "2026-11-04T12:00:00" },
      { pagesRead: 0, minutes: 0, date: "2026-11-05T12:00:00" }, // sin lectura: fuera
      { pagesRead: -5, minutes: 10, date: "fecha-mala" }, // fecha inválida → ahora
      "basura",
      null,
    ];
    const out = sesionesSanas(filas);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ pagesRead: 12, minutes: 30, date: "2026-11-04T12:00:00.000Z" });
    expect(out[1].pagesRead).toBe(0); // clamp a 0
    expect(out[1].minutes).toBe(10);
    expect(new Date(out[1].date).getTime()).not.toBeNaN();
    expect(sesionesSanas("no-array")).toEqual([]);
  });
});

describe("sync · insigniaSana", () => {
  test("undefined = no tocar, null = quitar, objeto = saneado", () => {
    expect(insigniaSana(undefined)).toBeUndefined();
    expect(insigniaSana(null)).toBeNull();
    expect(insigniaSana({ tier: 9, readings: 2, earnedAt: "2026-11-01T22:00:00Z" })).toEqual({
      tier: 4,
      readings: 2,
      earnedAt: "2026-11-01T22:00:00.000Z",
      updatedAt: null,
    });
    expect(insigniaSana("oro")).toBeUndefined();
  });
});

describe("sync · vocabSano", () => {
  test("dedupe palabra+idioma sin caja, tope 500 y saneo de campos", () => {
    const filas = [
      { word: "Effluvium", lang: "es", short: "gas", bookTitle: "A", page: 3 },
      { word: "effluvium", lang: "es", short: "dup" }, // misma en minúscula: fuera
      { word: "effluvium", lang: "en", short: "ok en inglés" },
      { word: "   ", lang: "es" }, // vacía: fuera
      null,
      { word: "Perenne", lang: "fr", short: "idioma raro → es" },
    ];
    const out = vocabSano(filas);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ word: "Effluvium", lang: "es", page: 3 });
    expect(out[1].lang).toBe("en");
    expect(out[2].lang).toBe("es");
    const muchas = Array.from({ length: 600 }, (_, i) => ({ word: `p${i}`, lang: "es", short: "" }));
    expect(vocabSano(muchas)).toHaveLength(500);
  });
});

describe("sync · camposGanadores", () => {
  test("el que manda gana; el receptor conserva identidad y fechas llegan como Date", () => {
    const campos = camposGanadores(
      {
        ...libroBase,
        currentPage: 300,
        milestones: 12,
        dailyGoal: null,
        extras: { pause: { recap: "va por la mitad" } },
        finishedAt: null,
        readCount: 1,
        lastReadAt: "2026-11-06T23:10:00Z",
      },
      { totalPages: 670, currentPage: 120 }
    );
    expect(campos.title).toBe("El mundo de Sofía");
    expect(campos.totalPages).toBe(670);
    expect(campos.currentPage).toBe(300);
    expect(campos.milestones).toBe(12);
    expect(campos.dailyGoal).toBeNull();
    expect(campos.finishedAt).toBeNull();
    expect(campos.readCount).toBe(1);
    expect(campos.lastReadAt).toBeInstanceOf(Date);
  });
  test("totalPages distinto re-clampea la página al techo nuevo", () => {
    const campos = camposGanadores(
      { ...libroBase, totalPages: 250, currentPage: 400 },
      { totalPages: 670, currentPage: 120 }
    );
    expect(campos.totalPages).toBe(250);
    expect(campos.currentPage).toBe(250);
  });
});
