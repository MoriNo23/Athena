"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AppSettings,
  FilterPreset,
  FilterSettings,
  ImmersionSettings,
  Lang,
  ModeToggleKey,
  ModeToggles,
  RailPosition,
  RailSettings,
  RailTheme,
  ReadingSettings,
  VnSettings,
  VocabEntry,
  VN_DEFAULT_PRESET,
} from "@/lib/types";

/** Ajustes de lectura: sin presets — la casa es literatura y cada lector
    arma su propia configuración con los interruptores del panel. */
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
  setFilters: (patch: Partial<FilterSettings>) => void;
  setPreset: (preset: FilterPreset) => void;
  setReading: (patch: Partial<ReadingSettings>) => void;
  setImmersion: (patch: Partial<ImmersionSettings>) => void;
  toggleMode: (key: ModeToggleKey) => void;
  setPauseMinutes: (minutes: number) => void;
  setVn: (patch: Partial<VnSettings>) => void;
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
    preset: "papel",
    brightness: 103,
    contrast: 96,
    sepia: 18,
    saturate: 95,
    warmth: 22,
    invert: 0,
  },
  reading: {
    dailyGoal: 20,
    scrollStepPct: 40, // ~2-3 pulsaciones de ↑/↓ por pantalla
    wheelBoost: 1, // rueda nativa del navegador
  },
  immersion: {
    enabled: true,
    idleSeconds: 4,
    toggleKey: "h",
  },
  vn: {
    speedPreset: VN_DEFAULT_PRESET,
    sound: true,
    auto: false,
    fontScale: 1,
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

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      modes: defaultModes,
      vocabulary: [],
      setLang: (lang) => set({ lang }),
      setRail: (patch) =>
        set((s) => ({ rail: { ...s.rail, ...patch } })),
      setFilters: (patch) =>
        set((s) => ({ filters: { ...s.filters, ...patch, preset: "custom" as FilterPreset } })),
      setPreset: (preset) =>
        set((s) => ({ filters: { ...s.filters, ...patchOf(s.filters, preset) } })),
      setReading: (patch) =>
        set((s) => ({ reading: { ...s.reading, ...patch } })),
      setImmersion: (patch) =>
        set((s) => ({ immersion: { ...s.immersion, ...patch } })),
      toggleMode: (key) =>
        set((s) => ({
          modes: {
            ...s.modes,
            toggles: { ...s.modes.toggles, [key]: !s.modes.toggles[key] },
          },
        })),
      setPauseMinutes: (minutes) =>
        set((s) => ({ modes: { ...s.modes, pauseMinutes: Math.min(120, Math.max(5, Math.round(minutes))) } })),
      setVn: (patch) =>
        set((s) => ({ vn: { ...s.vn, ...patch } })),
      addVocab: (entry) =>
        set((s) => ({
          // sin duplicados por palabra+idioma
          vocabulary: s.vocabulary.some((v) => v.word.toLowerCase() === entry.word.toLowerCase() && v.lang === entry.lang)
            ? s.vocabulary
            : [entry, ...s.vocabulary].slice(0, 500),
        })),
      removeVocab: (id) => set((s) => ({ vocabulary: s.vocabulary.filter((v) => v.id !== id) })),
      reset: () => set((s) => ({ ...defaultSettings, modes: defaultModes, lang: s.lang, vocabulary: s.vocabulary })),
    }),
    {
      name: "riel-settings-v1",
      version: 10,
      migrate: (persisted, version) => {
        const state = persisted as Partial<AppSettings> & {
          filters?: Partial<FilterSettings>;
          modes?: Partial<ModesSettings> & {
            toggles?: Partial<ModeToggles> & Record<string, boolean | undefined>;
          };
          vn?: Partial<VnSettings>;
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
          // v8: modo novela visual · v9: + tamaño de letra de las tarjetas
          vn: { ...defaultSettings.vn, ...state.vn, fontScale: state.vn?.fontScale ?? 1 },
        } as AppSettings & { modes: ModesSettings };
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
        return base;
      },
    }
  )
);

/** Filtra el objeto de filtros al activar un preset (mantiene compatibilidad) */
function patchOf(current: FilterSettings, preset: FilterPreset): FilterSettings {
  const table: Record<FilterPreset, FilterSettings> = {
    normal: { preset: "normal", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
    papel: { preset: "papel", brightness: 103, contrast: 96, sepia: 18, saturate: 95, warmth: 22, invert: 0 },
    sepia: { preset: "sepia", brightness: 100, contrast: 97, sepia: 50, saturate: 90, warmth: 30, invert: 0 },
    noche: { preset: "noche", brightness: 94, contrast: 105, sepia: 0, saturate: 85, warmth: 0, invert: 92 },
    calido: { preset: "calido", brightness: 97, contrast: 100, sepia: 28, saturate: 105, warmth: 45, invert: 0 },
    custom: { ...current, preset: "custom" },
  };
  return table[preset];
}

/** Utilidad: estilo CSS filter a partir de FilterSettings */
export function filterCss(f: FilterSettings): string {
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
