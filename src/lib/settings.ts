"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AppSettings,
  FilterPreset,
  FilterSettings,
  FILTER_PRESETS,
  ImmersionSettings,
  Lang,
  ModeToggleKey,
  ModeToggles,
  RailPosition,
  RailSettings,
  RailTheme,
  ReadingSettings,
  TeleprompterSettings,
  VocabEntry,
  TELEPROMPTER_FONDO_FILTRO_DEFAULT,
  TELEPROMPTER_WPS_DEFAULT,
  wpsDePresetAntiguo,
} from "@/lib/types";

/**
 * Ajustes de lectura: sin presets — la casa es literatura y cada lector
 * arma su propia configuración con los interruptores del panel.
 */
export interface ModesSettings {
  toggles: ModeToggles;
  /** minutos de sesión para la sugerencia de pausa en cortes naturales */
  pauseMinutes: number;
}

interface SettingsStore extends AppSettings {
  modes: ModesSettings;
  vocabulary: VocabEntry[];
  /** idioma de la interfaz (es/en/pt) */
  lang: Lang;
  setLang: (lang: Lang) => void;
  setRail: (patch: Partial<RailSettings>) => void;
  setPreset: (preset: FilterPreset) => void;
  setReading: (patch: Partial<ReadingSettings>) => void;
  setImmersion: (patch: Partial<ImmersionSettings>) => void;
  toggleMode: (key: ModeToggleKey) => void;
  setPauseMinutes: (minutes: number) => void;
  setTeleprompter: (patch: Partial<TeleprompterSettings>) => void;
  addVocab: (entry: VocabEntry) => void;
  removeVocab: (id: string) => void;
  reset: () => void;
}

const defaultSettings: AppSettings = {
  lang: "es",
  rail: {
    position: "left",
    segments: 10,
    theme: "egeo",
    showLabels: true,
    celebrate: true,
  },
  filters: {
    preset: "auto",
    brightness: 100,
    contrast: 100,
    sepia: 0,
    saturate: 100,
    warmth: 0,
    invert: 0,
  },
  reading: {
    dailyGoal: 20,
    scrollStepPct: 40, // ~2-3 pulsaciones de ↑/↓ por pantalla
    wheelBoost: 1, // rueda nativa del navegador
    font: "literata",
  },
  immersion: {
    enabled: true,
    idleSeconds: 4,
    toggleKey: "h",
  },
  teleprompter: {
    wps: TELEPROMPTER_WPS_DEFAULT, // control directo: sin presets (24-10)
    instante: false,
    sound: true,
    auto: false,
    fontScale: 1,
    fondo: "tema",
    fondoRuta: "",
    fondoFiltro: TELEPROMPTER_FONDO_FILTRO_DEFAULT,
    tarjetasPorFrase: true,
  },
};

/** Literatura por defecto: lo esencial encendido (fichas, índice,
    diccionario), lo que interrumpe apagado. Cada quien arma su casa. */
const defaultModes: ModesSettings = {
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

/** --- escritura al fichero `db/config.json` vía API (fuente única) ---
    La UI manda su cambio al fichero con un PUT diferido: arrastrar un slider
    no escribe 40 veces, escribe al asentarse. `hidratado` evita escribir
    defaults por encima del fichero antes de leerlo. */
let putTimer: ReturnType<typeof setTimeout> | null = null;
let hidratado = false;
let listenerArrancado = false;
let docActual: Record<string, string> = {};

/** Config pura (sin setters ni vocabulario: eso no va al fichero). */
function snapshotAjustes(s: {
  lang: Lang;
  rail: RailSettings;
  filters: FilterSettings;
  reading: ReadingSettings;
  immersion: ImmersionSettings;
  teleprompter: TeleprompterSettings;
  modes: ModesSettings;
}): AppSettings & { modes: ModesSettings } {
  return {
    lang: s.lang,
    rail: s.rail,
    filters: s.filters,
    reading: s.reading,
    immersion: s.immersion,
    teleprompter: s.teleprompter,
    modes: s.modes,
  };
}

function putAjustes() {
  if (!hidratado) return;
  if (putTimer) clearTimeout(putTimer);
  putTimer = setTimeout(() => {
    putTimer = null;
    escribirAhorra(useSettings.getState());
  }, 1000);
}

/** Bloques que el usuario cambió respecto a `base` (migración local no lo es:
    durante la hidratación un toggle del primer segundo NO debe descartarse). */
function bloquesTocados(state: SettingsStore, base: AppSettings & { modes: ModesSettings }) {
  const ahora = snapshotAjustes(state);
  const out: Record<string, unknown> = {};
  for (const bloque of ["lang", "rail", "filters", "reading", "immersion", "teleprompter", "modes"] as const) {
    if (JSON.stringify(ahora[bloque]) !== JSON.stringify(base[bloque])) {
      out[bloque] = ahora[bloque];
    }
  }
  return Object.keys(out).length > 0 ? (out as Partial<SettingsStore>) : null;
}

/** SET directo (sin debounce): se usa en flush de pestaña oculta y migración. */
function escribirAhorra(state: SettingsStore) {
  void fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings: snapshotAjustes(state), _doc: docActual }),
  }).catch(() => {
    /* sin red: el fichero queda como estaba; el próximo cambio reintenta */
  });
}

/** Si la pestaña se esconde con un PUT pendiente, lo escribe ya (una vez). */
if (typeof document !== "undefined" && !listenerArrancado) {
  listenerArrancado = true;
  document.addEventListener("visibilitychange", () => {
    if (putTimer && document.visibilityState === "hidden") {
      clearTimeout(putTimer);
      putTimer = null;
      escribirAhorra(useSettings.getState());
    }
  });
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => {
      const escribe = () => putAjustes();
      return {
        ...defaultSettings,
        modes: defaultModes,
        vocabulary: [],
        setLang: (lang) => {
          set({ lang });
          escribe();
        },
        setRail: (patch) => {
          set((s) => ({ rail: { ...s.rail, ...patch } }));
          escribe();
        },
        setPreset: (preset) => {
          set((s) => ({ filters: { ...s.filters, ...patchOf(s.filters, preset) } }));
          escribe();
        },
        setReading: (patch) => {
          set((s) => ({ reading: { ...s.reading, ...patch } }));
          escribe();
        },
        setImmersion: (patch) => {
          set((s) => ({ immersion: { ...s.immersion, ...patch } }));
          escribe();
        },
        toggleMode: (key) => {
          set((s) => ({
            modes: {
              ...s.modes,
              toggles: { ...s.modes.toggles, [key]: !s.modes.toggles[key] },
            },
          }));
          escribe();
        },
        setPauseMinutes: (minutes) => {
          set((s) => ({ modes: { ...s.modes, pauseMinutes: Math.min(120, Math.max(5, Math.round(minutes))) } }));
          escribe();
        },
        setTeleprompter: (patch) => {
          set((s) => ({ teleprompter: { ...s.teleprompter, ...patch } }));
          escribe();
        },
        addVocab: (entry) => {
          // data aparte: la palabra vive en la BD; el store es solo su eco
          const dup = get().vocabulary.some(
            (v) => v.word.toLowerCase() === entry.word.toLowerCase() && v.lang === entry.lang
          );
          if (dup) return;
          set((s) => ({ vocabulary: [entry, ...s.vocabulary].slice(0, 500) }));
          void fetch("/api/vocab", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry),
          })
            .then(async (res) => {
              if (res.ok) {
                const data = (await res.json()) as { entry?: VocabEntry };
                if (data.entry) {
                  // el id canónico es el de la BD (cuida re-quitar la misma palabra)
                  set((s) => ({
                    vocabulary: s.vocabulary.map((v) => (v.id === entry.id ? { ...v, id: data.entry!.id } : v)),
                  }));
                }
              } else {
                set((s) => ({ vocabulary: s.vocabulary.filter((v) => v.id !== entry.id) }));
              }
            })
            .catch(() => {
              set((s) => ({ vocabulary: s.vocabulary.filter((v) => v.id !== entry.id) }));
            });
        },
        removeVocab: (id) => {
          const prev = get().vocabulary;
          set((s) => ({ vocabulary: s.vocabulary.filter((v) => v.id !== id) }));
          void fetch(`/api/vocab/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {
            set({ vocabulary: prev });
          });
        },
        reset: () => {
          set((s) => ({ ...defaultSettings, modes: defaultModes, lang: s.lang, vocabulary: s.vocabulary }));
          escribe();
        },
      };
    },
    {
      name: "riel-settings-v1",
      version: 13,
      migrate: migrateSettings,
      // el vocabulario no persiste aquí: es data, vive en la BD (change
      // cfg-y-biblioteca-por-carpeta); el localStorage queda como caché de
      // arranque de la CONFIG, nunca como fuente.
      partialize: (state) => {
        const { vocabulary: _vocabulary, ...rest } = state as SettingsStore;
        return rest as SettingsStore;
      },
    }
  )
);

/** Hidratación desde el fichero (se llama una vez al montar la app):
    1) GET /api/settings → el fichero manda (si no existe, el servidor acaba de
       crearlo con defaults y avisa `created`).
    2) `created` + ajustes locales ≠ defaults ⇒ instalación vieja: se SUBE el
       localStorage al fichero (migración one-shot).
    3) igual para el vocabulario: si la BD está vacía y había palabras en el
       eco local, viajan a /api/vocab/import.
    4) vocabulary queda poblado desde la BD. */
export async function hidratarAjustes(): Promise<void> {
  try {
    const baseAntes = snapshotAjustes(useSettings.getState()); // previo al fetch
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = (await res.json()) as {
      settings: AppSettings & { modes: ModesSettings };
      biblioteca?: { carpeta: string };
      _doc?: Record<string, string>;
      created?: boolean;
    };
    docActual = data._doc ?? {};

    const store = useSettings.getState();
    const localSnapshot = snapshotAjustes(store);
    const esInstalacionVieja = Boolean(data.created) && !esDefaults(localSnapshot);

    let finales = data.settings;
    if (esInstalacionVieja) {
      // migración one-shot: lo aprendido en el localStorage sube al fichero
      const put = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: localSnapshot, biblioteca: data.biblioteca, _doc: docActual }),
      });
      if (put.ok) {
        const respuesta = (await put.json()) as { settings: AppSettings & { modes: ModesSettings } };
        finales = respuesta.settings;
      }
    }

    // vocabulario: BD primero; instalación vieja con eco local → migra
    try {
      const vRes = await fetch("/api/vocab");
      const vData = (await vRes.json()) as { vocabulary: VocabEntry[] };
      let vocab = vData.vocabulary ?? [];
      if (esInstalacionVieja && store.vocabulary.length > 0 && vocab.length === 0) {
        await fetch("/api/vocab/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: store.vocabulary }),
        });
        const vRes2 = await fetch("/api/vocab");
        vocab = ((await vRes2.json()) as { vocabulary: VocabEntry[] }).vocabulary ?? [];
      }
      useSettings.setState({ ...finales, vocabulary: vocab });
    } catch {
      useSettings.setState(finales);
    }
    // si la dueña tocó algo MIENTRAS bajaba el fichero, el fichero no puede
    // pisarlo: los bloques distintos al snapshot previo quedan como estaban
    const tocado = bloquesTocados(useSettings.getState(), baseAntes);
    if (tocado) {
      useSettings.setState(tocado);
      putAjustes();
    }
    hidratado = true;
  } catch {
    /* sin red: toca vivir con el localStorage; se reintenta en el próximo boot */
  }
}

/** ¿snapshot local idéntico a los defaults de la casa? (migración solo si no) */
function esDefaults(snapshot: AppSettings & { modes: ModesSettings }): boolean {
  const middles = {
    ...defaultSettings,
    modes: defaultModes,
    lang: defaultSettings.lang,
  } as AppSettings & { modes: ModesSettings };
  const trivial = ["rail", "filters", "reading", "immersion", "teleprompter", "modes"] as const;
  if (snapshot.lang !== middles.lang) return false;
  for (const bloque of trivial) {
    if (JSON.stringify(snapshot[bloque]) !== JSON.stringify(middles[bloque])) return false;
  }
  return true;
}

/** Migración de `riel-settings-v1` (exportada para los tests del motor). */
export function migrateSettings(persisted: unknown, version: number) {
  const state = persisted as Partial<AppSettings> & {
    filters?: Partial<FilterSettings>;
    modes?: Partial<ModesSettings> & {
      toggles?: Partial<ModeToggles> & Record<string, boolean | undefined>;
    };
    /** estado ≤ v10: los ajustes del modo viajaban en `vn` */
    vn?: Partial<TeleprompterSettings>;
    lang?: Lang;
  };
  // Al venir de versiones sin el campo invert, preserva la intención del preset noche
  const storedInvert = state.filters?.invert;
  const legacyInvert =
    storedInvert != null && storedInvert > 0
      ? storedInvert
      : state.filters?.preset === "noche"
        ? 92
        : 0;
  const base = {
    ...defaultSettings,
    ...state,
    // v10: idioma de la interfaz (los estados viejos no lo traen → es)
    lang: state.lang ?? "es",
    filters: { ...defaultSettings.filters, ...state.filters, invert: legacyInvert },
    // v7: navegación configurable — los objetos viejos no traen los campos nuevos
    reading: { ...defaultSettings.reading, ...state.reading },
    immersion: { ...defaultSettings.immersion, ...state.immersion },
    // v8: modo teleprompter · v9: + tamaño de letra · v11: el ajuste se llama
    // `teleprompter` (se conservan velocidad, sonido, auto y tamaño) · v13: los
    // presets se jubilan — el id guardado se traduce a palabras por segundo
    teleprompter: teleprompterMigrado(state.vn ?? state.teleprompter),
  } as AppSettings & { modes: ModesSettings };
  // el estado viejo queda en `vn`: no debe volver a persistirse
  delete (base as { vn?: unknown }).vn;
  // v11: el libro sigue al tema por defecto; un preset guardado solo sobrevive
  // si era `custom` (los presets siguen eligiéndose a mano)
  if (version < 11) {
    base.filters = {
      ...base.filters,
      preset: state.filters?.preset === "custom" ? "custom" : "auto",
    };
  }
  // v9: la casa se enfoca en literatura — fuera presets y toggles técnicos;
  // lo que el lector ya había encendido (literatura/comunes) se conserva
  const legacyToggles = (state.modes?.toggles ?? {}) as Partial<ModeToggles> &
    Record<string, boolean | undefined>;
  base.modes = {
    toggles: {
      xray: legacyToggles.xray ?? defaultModes.toggles.xray,
      naturalPauses: legacyToggles.naturalPauses ?? defaultModes.toggles.naturalPauses,
      argumentSkeleton: legacyToggles.argumentSkeleton ?? defaultModes.toggles.argumentSkeleton,
      lockedNotes: legacyToggles.lockedNotes ?? defaultModes.toggles.lockedNotes,
      dualRead: legacyToggles.dualRead ?? defaultModes.toggles.dualRead,
      outline: legacyToggles.outline ?? defaultModes.toggles.outline,
      dictionary: legacyToggles.dictionary ?? defaultModes.toggles.dictionary,
    },
    pauseMinutes: state.modes?.pauseMinutes ?? defaultModes.pauseMinutes,
  };
  // v4: introduce la barra dinámica estilo Duolingo como modo de color
  if (version < 4) {
    base.rail = { ...base.rail, theme: "dynamic" };
  }
  // v8: la casa viste de azul Atenas — el riel migrá al tema Egeo
  if (version < 8) {
    base.rail = { ...base.rail, theme: "egeo" };
  }
  // v5: modos de lectura + vocabulario (v9 los redefine sin presets)
  if (version < 5) {
    base.modes = { ...defaultModes };
  }
  // v12: destilado del lector — el preset `custom` se jubila (solo quedan los
  // presets con nombre; `auto` sigue al tema) y los microajustes de la antigua
  // navegación/inmersión vuelven a los defaults de la casa
  if (version < 12) {
    if (base.filters.preset === "custom") {
      base.filters = { ...base.filters, preset: "auto" };
    }
    base.reading = {
      ...base.reading,
      scrollStepPct: defaultSettings.reading.scrollStepPct,
      wheelBoost: defaultSettings.reading.wheelBoost,
    };
    base.immersion = {
      ...base.immersion,
      idleSeconds: defaultSettings.immersion.idleSeconds,
    };
  }
  return base;
}

/** v13: presets → control directo. El `speedPreset` viejo (id) se traduce a
    `wps` numérico; «instant» además enciende `instante`. Lo demás se conserva. */
function teleprompterMigrado(viejo: unknown): typeof defaultSettings.teleprompter {
  const base = { ...defaultSettings.teleprompter };
  const v = (viejo ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base, ...v };
  const idPreset = typeof v.speedPreset === "string" ? v.speedPreset : null;
  if (idPreset) {
    out.wps = wpsDePresetAntiguo(idPreset);
    out.instante = idPreset === "instant";
  }
  delete out.speedPreset; // el ajuste viejo no debe volver a persistirse
  return out as unknown as typeof defaultSettings.teleprompter;
}

/** Filtra el objeto de filtros al activar un preset (mantiene compatibilidad) */
function patchOf(current: FilterSettings, preset: FilterPreset): FilterSettings {
  const table: Record<FilterPreset, FilterSettings> = {
    // automático: el libro lo pinta el tema; los valores guardados no aplican
    auto: { preset: "auto", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
    normal: { preset: "normal", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
    papel: { preset: "papel", brightness: 103, contrast: 96, sepia: 18, saturate: 95, warmth: 22, invert: 0 },
    sepia: { preset: "sepia", brightness: 100, contrast: 97, sepia: 50, saturate: 90, warmth: 30, invert: 0 },
    noche: { preset: "noche", brightness: 94, contrast: 105, sepia: 0, saturate: 85, warmth: 0, invert: 92 },
    calido: { preset: "calido", brightness: 97, contrast: 100, sepia: 28, saturate: 105, warmth: 45, invert: 0 },
    custom: { ...current, preset: "custom" },
  };
  return table[preset];
}

/** Utilidad: estilo CSS filter para la página imagen (PDF). `auto` sigue al
    tema: render nocturno afinado en oscuro, página limpia en claro. */
export function filterCss(f: FilterSettings, isDark = false): string {
  // `auto` en oscuro reutiliza el render nocturno del preset manual: una sola
  // inversión, sin apilarse con la elección explícita de «Noche».
  if (f.preset === "auto") return isDark ? FILTER_PRESETS.noche.css : "none";
  // `normal` no filtra: la superficie la pinta el tema
  if (f.preset === "normal") return "none";
  const inv = f.invert ?? 0;
  const parts = [
    inv > 0 ? `invert(${inv / 100}) hue-rotate(180deg)` : "",
    `brightness(${f.brightness}%)`,
    `contrast(${f.contrast}%)`,
    f.sepia > 0 ? `sepia(${f.sepia / 100})` : "",
    `saturate(${f.saturate}%)`,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "none";
}

/** Utilidad: tinte del texto reflowable (EPUB y modo texto). Nunca invierte:
    su noche la dan los tokens del tema; los presets manuales son tintes suaves. */
export function reflowFilterCss(f: FilterSettings): string {
  if (f.preset === "auto" || f.preset === "normal") return "none";
  const parts = [
    `brightness(${f.brightness}%)`,
    `contrast(${f.contrast}%)`,
    f.sepia > 0 ? `sepia(${f.sepia / 100})` : "",
    `saturate(${f.saturate}%)`,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "none";
}
