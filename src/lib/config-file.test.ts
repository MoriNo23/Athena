/**
 * Tests del saneo de ajustes (change primeros-tests-de-la-casa): `saneaAjustes`
 * y el round-trip de `db/config.json`. El bloque puro corre sin tocar disco;
 * el de round-trip usa sandbox en tests/.sandbox (nunca el db/ real).
 * Correr con `bun test src/lib/config-file.test.ts`.
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { leerAjustes, saneaAjustes, escribirAjustes } from "@/lib/config-file";

/* ---------------- bloque puro: saneaAjustes ---------------- */

test("saneaAjustes(null): todo a defaults de la casa", () => {
  expect(saneaAjustes(null)).toEqual({
    lang: "es",
    rail: { position: "left", segments: 10, theme: "egeo", showLabels: true, celebrate: true },
    filters: { preset: "auto", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
    reading: { dailyGoal: 20, scrollStepPct: 40, wheelBoost: 1, font: "literata" },
    immersion: { enabled: true, idleSeconds: 4, toggleKey: "h" },
    teleprompter: {
      wps: 2.5,
      instante: false,
      sound: true,
      auto: false,
      fontScale: 1,
      fondo: "tema",
      fondoRuta: "",
      fondoFiltro: 55,
      tarjetasPorFrase: true,
    },
    modes: {
      toggles: {
        xray: true,
        naturalPauses: false,
        argumentSkeleton: false,
        lockedNotes: false,
        dualRead: false,
        outline: true,
        dictionary: true,
      },
      pauseMinutes: 25,
    },
  });
});

test("saneaAjustes: raíz no-objeto también cae en defaults", () => {
  expect(saneaAjustes("no-soy-objeto")).toEqual(saneaAjustes(null));
  expect(saneaAjustes(42)).toEqual(saneaAjustes(null));
});

test("saneaAjustes: tipos falseados vuelven al default de su bloque", () => {
  const s = saneaAjustes({
    rail: { segments: "10", theme: 7, showLabels: "sí" },
    reading: { dailyGoal: null },
    immersion: { enabled: 1, toggleKey: 42 },
  });
  expect(s.rail).toEqual({ position: "left", segments: 10, theme: "egeo", showLabels: true, celebrate: true });
  expect(s.reading.dailyGoal).toBe(20);
  expect(s.immersion.enabled).toBe(true);
  expect(s.immersion.toggleKey).toBe("h");
});

test("saneaAjustes: clamps por arriba y por abajo", () => {
  const s = saneaAjustes({
    rail: { segments: 999 },
    reading: { dailyGoal: 0 },
    immersion: { idleSeconds: 99 },
    teleprompter: { wps: 9, fontScale: 9 },
    modes: { pauseMinutes: 1 },
  });
  expect(s.rail.segments).toBe(40); // máximo 40
  expect(s.reading.dailyGoal).toBe(1); // mínimo 1
  expect(s.immersion.idleSeconds).toBe(12); // máximo 12
  expect(s.teleprompter.wps).toBe(4); // máximo 4, sin redondear
  expect(s.teleprompter.fontScale).toBe(1.6); // máximo 1.6
  expect(s.modes.pauseMinutes).toBe(5); // 1 queda bajo el mínimo 5 → se clampea al mínimo

  const bajo = saneaAjustes({ rail: { segments: -3 }, reading: { dailyGoal: -3 } });
  expect(bajo.rail.segments).toBe(2); // mínimo 2
  expect(bajo.reading.dailyGoal).toBe(1); // mínimo 1
});

test("saneaAjustes: listas cerradas — valor no listado cae al default", () => {
  const s = saneaAjustes({
    lang: "fr",
    rail: { position: "centro", theme: "cobalto" },
    filters: { preset: "vaporwave" },
    reading: { font: "comic" },
    teleprompter: { fondo: "video" },
  });
  expect(s.lang).toBe("es");
  expect(s.rail.position).toBe("left");
  expect(s.rail.theme).toBe("egeo");
  expect(s.filters.preset).toBe("auto");
  expect(s.reading.font).toBe("literata");
  expect(s.teleprompter.fondo).toBe("tema");
});

test("saneaAjustes: toggleKey se reduce a una letra minúscula", () => {
  expect(saneaAjustes({ immersion: { toggleKey: "K" } }).immersion.toggleKey).toBe("k");
  expect(saneaAjustes({ immersion: { toggleKey: "ab" } }).immersion.toggleKey).toBe("a");
  expect(saneaAjustes({ immersion: { toggleKey: "" } }).immersion.toggleKey).toBe("h");
});

test("saneaAjustes: fondoRuta solo bajo /uploads/ y truncado a 200", () => {
  expect(saneaAjustes({ teleprompter: { fondoRuta: "/etc/passwd" } }).teleprompter.fondoRuta).toBe("");
  expect(saneaAjustes({ teleprompter: { fondoRuta: "http://x/f.png" } }).teleprompter.fondoRuta).toBe("");
  const larga = saneaAjustes({ teleprompter: { fondoRuta: "/uploads/" + "a".repeat(300) } }).teleprompter.fondoRuta;
  expect(larga.startsWith("/uploads/")).toBe(true);
  expect(larga.length).toBe(200);
});

test("saneaAjustes: migración de speedPreset antiguo a wps", () => {
  expect(saneaAjustes({ teleprompter: { speedPreset: "1-5" } }).teleprompter.wps).toBe(1.5);
  expect(saneaAjustes({ teleprompter: { speedPreset: "0-8" } }).teleprompter.wps).toBe(0.8);
  expect(saneaAjustes({ teleprompter: { speedPreset: "4" } }).teleprompter.wps).toBe(4);
  expect(saneaAjustes({ teleprompter: { speedPreset: "raro" } }).teleprompter.wps).toBe(2.5);
  expect(saneaAjustes({ teleprompter: { speedPreset: "instant" } }).teleprompter.instante).toBe(true);
  // wps numérico válido manda sobre el preset viejo
  expect(saneaAjustes({ teleprompter: { wps: 3, speedPreset: "0-8" } }).teleprompter.wps).toBe(3);
});

/* ---------------- bloque round-trip: leer/escribir con sandbox ---------------- */

const SANDBOX = "tests/.sandbox";
const cwdOriginal = process.cwd();

function sandbox() {
  rmSync(SANDBOX, { recursive: true, force: true });
  mkdirSync(`${SANDBOX}/db`, { recursive: true });
  process.chdir(SANDBOX);
}

beforeEach(() => {
  sandbox();
});

afterEach(() => {
  process.chdir(cwdOriginal);
  rmSync(SANDBOX, { recursive: true, force: true });
});

const DEFAULTS = saneaAjustes(null);

test("round-trip: sin fichero escribe defaults con _doc y avisa created", async () => {
  expect(existsSync("db/config.json")).toBe(false);
  const leido = await leerAjustes();
  expect(leido.created).toBe(true);
  expect(leido.settings).toEqual(DEFAULTS);
  expect(leido._doc._doc).toContain("Explicaciones de cada bloque");
  // JSON legible: 2 espacios y salto final
  const txt = readFileSync("db/config.json", "utf8");
  expect(txt).toContain('\n  "lang": "es"');
  expect(txt.endsWith("\n")).toBe(true);
});

test("round-trip: escribir y leer conserva valores, carpeta y _doc", async () => {
  const settings = structuredClone(DEFAULTS);
  settings.rail.segments = 7;
  await escribirAjustes(settings, { carpeta: "/home/bib" }, { lang: "explicación mía" });
  const leido = await leerAjustes();
  expect(leido.created).toBe(false);
  expect(leido.settings.rail.segments).toBe(7);
  expect(leido.biblioteca.carpeta).toBe("/home/bib");
  expect(leido._doc).toEqual({ lang: "explicación mía" });
});

test("round-trip: _doc solo acepta valores string (y sin _doc)", async () => {
  writeFileSync("db/config.json", JSON.stringify({ _doc: { x: 5, _doc: "raro", lang: "vale" } }));
  const leido = await leerAjustes();
  expect(leido._doc).toEqual({ lang: "vale" });
});

test("round-trip: las claves raras de la raíz sobreviven a la reescritura", async () => {
  writeFileSync("db/config.json", JSON.stringify({ miClave: 42, rail: { segments: 9 } }));
  const leido = await leerAjustes();
  expect(leido.created).toBe(false);
  await escribirAjustes(leido.settings, leido.biblioteca, leido._doc);
  expect(JSON.parse(readFileSync("db/config.json", "utf8")).miClave).toBe(42);
});

test("round-trip: config roto se respalda como .roto-* y arranca defaults", async () => {
  writeFileSync("db/config.json", "{roto");
  const leido = await leerAjustes();
  expect(leido.created).toBe(true);
  expect(leido.settings).toEqual(DEFAULTS);
  const roto = readdirSync("db").filter((f) => f.startsWith("config.json.roto-"));
  expect(roto.length).toBe(1);
});

test("round-trip: fichero mayor que el límite (256 KB) se trata como roto", async () => {
  writeFileSync("db/config.json", JSON.stringify({ lang: "es", relleno: "x".repeat(257 * 1024) }));
  const leido = await leerAjustes();
  expect(leido.created).toBe(true);
  const roto = readdirSync("db").filter((f) => f.startsWith("config.json.roto-"));
  expect(roto.length).toBe(1);
});

test("round-trip: escribir crea db/ si no existe y no deja tmp", async () => {
  rmSync("db", { recursive: true, force: true });
  await escribirAjustes(DEFAULTS, { carpeta: "" }, { _doc: "guía" });
  expect(existsSync("db/config.json")).toBe(true);
  const tmp = readdirSync("db").filter((f) => f.includes("config.json.tmp-"));
  expect(tmp.length).toBe(0);
});
