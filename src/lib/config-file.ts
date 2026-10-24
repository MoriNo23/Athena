import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import {
  AppSettings,
  FilterPreset,
  Lang,
  ModeToggles,
  RailPosition,
  RailSettings,
  RailTheme,
  ReadingFont,
  ReadingSettings,
  TeleprompterSettings,
  TELEPROMPTER_WPS_DEFAULT,
  TELEPROMPTER_FONT_MAX,
  TELEPROMPTER_FONT_MIN,
  TELEPROMPTER_WPS_MAX,
  TELEPROMPTER_WPS_MIN,
  TeleprompterFondo,
  wpsDePresetAntiguo,
} from "@/lib/types";

/**
 * `db/config.json` — la casa de los ajustes (change cfg-y-biblioteca-por-carpeta).
 *
 * Reglas del fichero:
 *  - Fuente ÚNICA de la configuración. El localStorage solo arranca el render
 *    antes de que llegue el fichero; si discrepan, el fichero manda.
 *  - Es JSON legible y editable a mano: bloques planos, 2 espacios, salto final.
 *  - Sin comentarios de verdad (JSON no tiene) → la clave `_doc` guarda
 *    explicaciones como datos: la app la ignora y la CONSERVA en cada escritura.
 *  - Escritura atómica (tmp + rename) y tolerante: un valor inválido no rompe
 *    el arranque, vuelve a su default. El vocabulario NO viaja aquí — es data
 *    y vive en la BD (modelo Vocab).
 *  - La carpeta de biblioteca escaneada vive en `biblioteca.carpeta` (ruta
 *    absoluta de la máquina que sirve; del fichero de un libro solo se LEE).
 */

// rutas relativas a propósito: se resuelven contra el cwd EN CADA LLAMADA (no
// al importar), lo que deja que los tests apunten a sandbox con chdir.
const DATA_DIR = "db";
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const MAX_SIZE = 256 * 1024; // un config a mano no pasa de esto; es guardia, no regla

/** Bloques de modos (mismo shape que el store: toggles + pauseMinutes). */
export interface ModesFichero {
  toggles: ModeToggles;
  pauseMinutes: number;
}

/** Ajustes tal como los conoce el store de la UI + biblioteca (solo servidor). */
export interface ConfigCompleto {
  settings: AppSettings & { modes: ModesFichero };
  biblioteca: { carpeta: string };
  _doc: Record<string, string>;
}

/** Ajustes por defecto de la casa (espejo de src/lib/settings.ts). */
const DEFAULT_SETTINGS: AppSettings = {
  lang: "es",
  rail: { position: "left", segments: 10, theme: "egeo", showLabels: true, celebrate: true },
  filters: { preset: "auto", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
  reading: { dailyGoal: 20, scrollStepPct: 40, wheelBoost: 1, font: "literata" },
  immersion: { enabled: true, idleSeconds: 4, toggleKey: "h" },
  teleprompter: {
    wps: TELEPROMPTER_WPS_DEFAULT,
    instante: false,
    sound: true,
    auto: false,
    fontScale: 1,
    fondo: "tema",
    fondoRuta: "",
    fondoFiltro: 55,
    tarjetasPorFrase: true,
  },
};

const DEFAULT_MODES: ModesFichero = {
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
};

const RAIL_POSITIONS: RailPosition[] = ["bottom", "top", "left", "right"];
const RAIL_THEMES: RailTheme[] = ["egeo", "dynamic", "amber", "emerald", "rose", "violet", "cyan"];
const FILTER_PRESETS_ID: FilterPreset[] = ["auto", "normal", "papel", "sepia", "noche", "calido", "custom"];
const FONTS: ReadingFont[] = ["literata", "garamond", "atkinson"];
const LANGS: Lang[] = ["es", "en", "pt"];
const FONDOS: TeleprompterFondo[] = ["tema", "portada", "imagen"];

/** _doc por defecto: explicaciones en cristiano para quien abre el fichero a mano. */
export function docPorDefecto(): Record<string, string> {
  return {
    _doc:
      "Explicaciones de cada bloque. La app conserva este bloque al reescribir; se puede editar a mano.",
    raiz:
      "Cada bloque mapea 1 a 1 el panel de ajustes. Un valor inválido vuelve a su default: no rompe la app.",
    lang: 'Idioma de la interfaz: "es", "en" o "pt".',
    rail:
      'Riel de progreso: "position" bottom|top|left|right · "segments" tramos/hitos (2-40) · "theme" egeo|dynamic|amber|emerald|rose|violet|cyan · "showLabels" y "celebrate" encienden etiquetas y celebración.',
    filters:
      'Filtros de imagen: "preset" auto|normal|papel|sepia|noche|calido|custom · brightness/contrast (0-200) · sepia/saturate/warmth/invert (0-100). "auto" sigue al tema.',
    reading:
      'Lectura: "dailyGoal" páginas/día (1-500) · "scrollStepPct" salto de ↑/↓ como % del visor (10-100) · "wheelBoost" multiplicador de rueda (1-5) · "font" literata|garamond|atkinson.',
    immersion:
      'Inmersión: "enabled" esconde la UI si el mouse queda quieto · "idleSeconds" 2-12 · "toggleKey" la tecla que la muestra al instante.',
    teleprompter:
      'Teleprompter: "wps" palabras por segundo (0.8-4, control directo sin presets) · "instante" todo de golpe · "sound" tic de tipeo · "auto" avanza solo al acabar la tarjeta · "fontScale" 0.8-1.6 · "fondo" tema|portada|imagen · "fondoRuta" ruta en /uploads/ de la imagen propia · "fondoFiltro" 0-100 (filtro de legibilidad sobre la imagen: a más alto, más oscura y desaturada) · "tarjetasPorFrase" parte los bloques largos en frases.',
    modes:
      'Modos de lectura: interruptores xray (fichas), naturalPauses, argumentSkeleton, lockedNotes, dualRead, outline, dictionary · "pauseMinutes" minutos de la pausa sugerida (5-120).',
    biblioteca:
      "Carpeta de libros escaneados: los PDF/EPUB se registran EN SU SITIO, sin copia. Ruta ABSOLUTA de la máquina que sirve. También se elige desde la biblioteca («Añadir carpeta»).",
  };
}

/** --- utilidades de saneo --- */

function boolIn(v: unknown, fallback: boolean): boolean {
  if (v === true || v === false) return v;
  return fallback;
}

function numIn(v: unknown, fallback: number, min: number, max: number, round = true): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.min(max, Math.max(min, n));
  return round ? Math.round(clamped) : clamped;
}

function listIn<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === "string" && (allowed as string[]).includes(v) ? (v as T) : fallback;
}

/** Sanea los ajustes (bloques conocidos, claves de la app) aplicándolos sobre defaults. */
export function saneaAjustes(raw: unknown): AppSettings & { modes: ModesFichero } {
  const base = DEFAULT_SETTINGS;
  const safe = (raw ?? {}) as Record<string, unknown>;
  const rail = safe.rail ?? {};
  const filters = safe.filters ?? {};
  const reading = safe.reading ?? {};
  const immersion = safe.immersion ?? {};
  const tp = safe.teleprompter ?? {};
  const modes = safe.modes ?? {};
  const toggles = (modes as Record<string, unknown>).toggles ?? {};
  const R = rail as Record<string, unknown>;
  const F = filters as Record<string, unknown>;
  const RD = reading as Record<string, unknown>;
  const I = immersion as Record<string, unknown>;
  const T = tp as Record<string, unknown>;
  const M = modes as Record<string, unknown>;
  const G = toggles as Record<string, unknown>;

  const out: AppSettings & { modes: ModesFichero } = {
    lang: listIn<Lang>(safe.lang, LANGS, base.lang),
    rail: {
      position: listIn<RailPosition>(R.position, RAIL_POSITIONS, base.rail.position),
      segments: numIn(R.segments, base.rail.segments, 2, 40),
      theme: listIn<RailTheme>(R.theme, RAIL_THEMES, base.rail.theme),
      showLabels: boolIn(R.showLabels, base.rail.showLabels),
      celebrate: boolIn(R.celebrate, base.rail.celebrate),
    },
    filters: {
      preset: listIn<FilterPreset>(F.preset, FILTER_PRESETS_ID, base.filters.preset),
      brightness: numIn(F.brightness, base.filters.brightness, 0, 200),
      contrast: numIn(F.contrast, base.filters.contrast, 0, 200),
      sepia: numIn(F.sepia, base.filters.sepia, 0, 100),
      saturate: numIn(F.saturate, base.filters.saturate, 0, 100),
      warmth: numIn(F.warmth, base.filters.warmth, 0, 100),
      invert: numIn(F.invert, base.filters.invert, 0, 100),
    },
    reading: {
      dailyGoal: numIn(RD.dailyGoal, base.reading.dailyGoal, 1, 500),
      scrollStepPct: numIn(RD.scrollStepPct, base.reading.scrollStepPct, 10, 100),
      wheelBoost: numIn(RD.wheelBoost, base.reading.wheelBoost, 1, 5),
      font: listIn<ReadingFont>(RD.font, FONTS, base.reading.font),
    },
    immersion: {
      enabled: boolIn(I.enabled, base.immersion.enabled),
      idleSeconds: numIn(I.idleSeconds, base.immersion.idleSeconds, 2, 12),
      toggleKey:
        (typeof I.toggleKey === "string" ? I.toggleKey.toLowerCase().slice(0, 1) : "") ||
        base.immersion.toggleKey,
    },
    teleprompter: {
      // migración tolerante: un fichero viejo con speedPreset se traduce a wps
      wps:
        typeof T.wps === "number" && Number.isFinite(T.wps)
          ? numIn(T.wps, base.teleprompter.wps, TELEPROMPTER_WPS_MIN, TELEPROMPTER_WPS_MAX, false)
          : typeof T.speedPreset === "string"
            ? wpsDePresetAntiguo(T.speedPreset)
            : base.teleprompter.wps,
      instante:
        typeof T.instante === "boolean"
          ? T.instante
          : T.speedPreset === "instant",
      sound: boolIn(T.sound, base.teleprompter.sound),
      auto: boolIn(T.auto, base.teleprompter.auto),
      fontScale: numIn(
        typeof T.fontScale === "number" ? T.fontScale : base.teleprompter.fontScale,
        base.teleprompter.fontScale,
        TELEPROMPTER_FONT_MIN,
        TELEPROMPTER_FONT_MAX,
        false
      ),
      fondo: listIn<TeleprompterFondo>(T.fondo, FONDOS, base.teleprompter.fondo),
      fondoRuta:
        typeof T.fondoRuta === "string" && T.fondoRuta.startsWith("/uploads/")
          ? T.fondoRuta.slice(0, 200)
          : "",
      fondoFiltro: numIn(T.fondoFiltro, base.teleprompter.fondoFiltro, 0, 100),
      tarjetasPorFrase: boolIn(T.tarjetasPorFrase, base.teleprompter.tarjetasPorFrase),
    },
    modes: {
      toggles: {
        xray: boolIn(G.xray, DEFAULT_MODES.toggles.xray),
        naturalPauses: boolIn(G.naturalPauses, DEFAULT_MODES.toggles.naturalPauses),
        argumentSkeleton: boolIn(G.argumentSkeleton, DEFAULT_MODES.toggles.argumentSkeleton),
        lockedNotes: boolIn(G.lockedNotes, DEFAULT_MODES.toggles.lockedNotes),
        dualRead: boolIn(G.dualRead, DEFAULT_MODES.toggles.dualRead),
        outline: boolIn(G.outline, DEFAULT_MODES.toggles.outline),
        dictionary: boolIn(G.dictionary, DEFAULT_MODES.toggles.dictionary),
      },
      pauseMinutes: numIn(M.pauseMinutes, DEFAULT_MODES.pauseMinutes, 5, 120),
    },
  };
  return out;
}

/** Claves raras en la raíz del fichero (manos curiosas): se conservan al reescribir. */
let extraKeys: Record<string, unknown> = {};

/** Lee y valida `db/config.json`. Si falta (o está roto), escribe el fichero
    inicial con defaults + `_doc` y avisa `created`: el cliente usa esa señal
    para subir la instalación vieja de localStorage. Nunca lanza: si el disco
    está quisquilloso, la app arranca igual con defaults en memoria. */
export async function leerAjustes(): Promise<ConfigCompleto & { created: boolean }> {
  const respuesta = await leerAjustesInterno();
  return respuesta;
}

async function leerAjustesInterno(): Promise<ConfigCompleto & { created: boolean }> {
  try {
    const txt = await readFile(CONFIG_PATH, "utf8");
    if (txt.length > MAX_SIZE) throw new Error("config demasiado grande");
    const raw = JSON.parse(txt) as { _doc?: Record<string, unknown>; biblioteca?: Record<string, unknown> } & Record<string, unknown>;
    const doc: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw._doc ?? {})) {
      if (typeof v === "string" && k !== "_doc") doc[k] = v;
    }
    const knownRoot = new Set([
      "_doc", "lang", "rail", "filters", "reading", "immersion", "teleprompter", "modes", "biblioteca",
    ]);
    extraKeys = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!knownRoot.has(k)) extraKeys[k] = v;
    }
    const bib = raw.biblioteca ?? {};
    const carpeta = typeof bib.carpeta === "string" ? bib.carpeta.slice(0, 1024) : "";
    return { settings: saneaAjustes(raw), biblioteca: { carpeta }, _doc: doc, created: false };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const roto = err.code !== "ENOENT"; // existe pero no parseó (o el fs tronó)
    if (roto) {
      try {
        await rename(CONFIG_PATH, CONFIG_PATH + ".roto-" + Date.now());
      } catch {
        /* nada que respaldar */
      }
    }
    const fresh: ConfigCompleto = {
      settings: saneaAjustes(null),
      biblioteca: { carpeta: "" },
      _doc: docPorDefecto(),
    };
    try {
      await escribirAjustes(fresh.settings, fresh.biblioteca, fresh._doc);
    } catch {
      /* disco quisquilloso: la app vive con defaults en memoria */
    }
    return { ...fresh, created: true };
  }
}

/** Serializa y escribe `db/config.json` de forma atómica (tmp + rename). */
export async function escribirAjustes(
  settings: AppSettings & { modes: ModesFichero },
  biblioteca: { carpeta: string },
  doc: Record<string, string>
): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const cuerpo: Record<string, unknown> = {
    _doc: doc && Object.keys(doc).length > 0 ? doc : docPorDefecto(),
    lang: settings.lang,
    rail: settings.rail,
    filters: settings.filters,
    reading: settings.reading,
    immersion: settings.immersion,
    teleprompter: settings.teleprompter,
    modes: settings.modes,
    biblioteca: { carpeta: biblioteca.carpeta },
    ...extraKeys,
  };
  const txt = JSON.stringify(cuerpo, null, 2) + "\n";
  // pid + hora: dos escrituras concurrentes no pisan el mismo tmp
  const tmp = CONFIG_PATH + `.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, txt, "utf8");
  await rename(tmp, CONFIG_PATH);
}

/** server-only: este fichero toca el disco (fs de node). */
