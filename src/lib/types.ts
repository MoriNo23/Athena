/** Idiomas de la interfaz (persistidos en ajustes; es por defecto) */
export type Lang = "es" | "en" | "pt";

export interface BadgeDTO {
  tier: number; // 1 Bronce · 2 Plata · 3 Oro · 4 Diamante
  readings: number;
  earnedAt: string;
  updatedAt?: string;
}

export interface BookDTO {
  id: string;
  title: string;
  author: string | null;
  fileName: string;
  filePath: string;
  coverPath: string | null;
  totalPages: number;
  currentPage: number;
  /** tramos/hitos de este libro; null = usar el global de ajustes */
  milestones: number | null;
  /** meta diaria de este libro (1-500); null = heredar el mínimo global de ajustes */
  dailyGoal: number | null;
  /** PDF compañero para lectura dual (traducción u otra edición) */
  companionPath: string | null;
  companionPages: number | null;
  /** datos de los modos de lectura, por libro */
  extras: BookExtras | null;
  /** colección de insignias: cuándo terminó el libro y cuántas lecturas completas lleva */
  finishedAt: string | null;
  readCount: number;
  badge: BadgeDTO | null;
  createdAt: string;
  lastReadAt: string | null;
  /** "subido" = copia en uploads/ · "carpeta" = registrado en su sitio, sin copia */
  origin?: "subido" | "carpeta";
  /** fecha en que el escáner dejó de encontrar el fichero (movido/borrado) */
  fileMissingAt?: string | null;
  /** URL por la que el lector obtiene el fichero (uploads directo o stream API) */
  archivoUrl?: string;
  /** URL de la portada servida por la app; null = sin portada */
  coverUrl?: string | null;
}

/**
 * URL por la que el lector obtiene el fichero del libro: SIEMPRE el stream de
 * la app (change ficheros-servidos-por-la-app). Antes los subidos iban por el
 * estático de public/, pero un fichero creado tras el arranque del servidor no
 * existía al enumerarlo y daba 404 hasta reiniciar. La app lo sirve siempre.
 */
export function archivoUrlDe(book: { id: string; filePath: string; origin?: string }): string {
  return `/api/books/${book.id}/file`;
}

/** URL del fondo propio del teleprompter: la app sirve la imagen (no estático,
    igual que libros y portadas — los ficheros creados tras el arranque fallan
    en producción). La ruta guardada en config sigue siendo /uploads/<nombre>. */
export function fondoUrlDe(ruta: string): string {
  return `/api/teleprompter/fondo?ruta=${encodeURIComponent(ruta)}`;
}

// ---------- Insignias ----------

export const BADGE_TIERS: Record<number, { key: string; label: string; hint: string }> = {
  1: { key: "bronce", label: "Bronce", hint: "1 lectura completada" },
  2: { key: "plata", label: "Plata", hint: "2 lecturas completadas" },
  3: { key: "oro", label: "Oro", hint: "3 lecturas completadas" },
  4: { key: "diamante", label: "Diamante", hint: "4 o más lecturas" },
};

/** Tier que corresponde a N lecturas completadas (tope: Diamante) */
export function tierForReadings(readings: number): number {
  return Math.min(4, Math.max(1, Math.round(readings)));
}

// ---------- Modos de lectura ----------

/** La casa está enfocada en literatura: solo viven las subfeatures de lector
    de novelas y ensayos, más las comunes. Todo se activa a gusto desde el
    panel de ajustes — sin presets que elegir. */
export interface ModeToggles {
  xray: boolean; // fichas que siguen tu punto de lectura (sin spoilers)
  naturalPauses: boolean; // pausas en cortes naturales
  argumentSkeleton: boolean; // esqueleto argumental + predicción
  lockedNotes: boolean; // notas con candado de spoilers
  dualRead: boolean; // dos ediciones/traducciones a la vez
  outline: boolean; // esquema del PDF (índice navegable)
  dictionary: boolean; // definir palabra al seleccionarla
}

export type ModeToggleKey = keyof ModeToggles;

export const MODE_TOGGLE_META: Record<
  ModeToggleKey,
  { label: string; hint: string }
> = {
  xray: { label: "Fichas (X-Ray)", hint: "Quién aparece hasta donde llegaste, sin spoilers" },
  naturalPauses: { label: "Pausas en cortes", hint: "Te sugiere pausar al terminar la página, nunca a mitad" },
  argumentSkeleton: { label: "Esqueleto + predicción", hint: "Predice la tesis y compárala al final" },
  lockedNotes: { label: "Notas con candado", hint: "Notas futuras, veladas hasta llegar" },
  dualRead: { label: "Lectura dual", hint: "Dos ediciones o idiomas lado a lado" },
  outline: { label: "Esquema del PDF", hint: "Índice navegable si el PDF lo trae" },
  dictionary: { label: "Diccionario", hint: "Selecciona una palabra para definirla (ES/EN)" },
};

// ---------- Extras por libro (persistidos en BD) ----------

export interface XrayCard {
  id: string;
  name: string;
  aliases: string;
  note: string;
  unlockPage: number; // aparece desde esta página
}

export interface LockedNote {
  id: string;
  text: string;
  unlockPage: number; // se desbloquea en esta página
  createdAt: string;
}

export interface BookExtras {
  xray?: XrayCard[];
  pause?: { recap: string; pausesTaken: number };
  prediction?: { text: string; savedAt: string };
  conclusion?: { text: string; savedAt: string };
  lockedNotes?: LockedNote[];
  /** modo de lectura recordado del PDF (página tal cual o texto reflowable) */
  readerMode?: "page" | "text";
}

// ---------- Vocabulario global ----------

export interface VocabEntry {
  id: string;
  word: string;
  lang: "es" | "en";
  short: string; // definición recortada
  bookId: string;
  bookTitle: string;
  page: number;
  createdAt: string;
}

// ---------- Diccionario (respuesta normalizada del proxy) ----------

export interface DictDef {
  d: string;
  ex?: string;
}

export interface DictEntry {
  pos: string; // categoría gramatical legible
  defs: DictDef[];
  synonyms?: string[];
}

export interface DictionaryResult {
  word: string;
  lang: "es" | "en";
  found: boolean;
  phonetic?: string;
  audio?: string;
  origin?: string;
  entries: DictEntry[];
  source: string;
}

export interface SessionDTO {
  id: string;
  bookId: string;
  pagesRead: number;
  minutes: number;
  date: string;
}

export interface GlobalStats {
  streak: number;
  pagesToday: number;
  minutesToday: number;
  pages7d: number;
  minutes7d: number;
  days7d: number;
  booksFinished: number;
}

export type ZoomPresetId = "optimal" | "page" | "wide" | "mid" | "far";

export type RailPosition = "bottom" | "top" | "left" | "right";

export type RailTheme = "egeo" | "dynamic" | "amber" | "emerald" | "rose" | "violet" | "cyan";

export type FilterPreset =
  | "auto"
  | "normal"
  | "papel"
  | "sepia"
  | "noche"
  | "calido"
  | "custom";

export interface FilterSettings {
  preset: FilterPreset;
  brightness: number; // %
  contrast: number; // %
  sepia: number; // %
  saturate: number; // %
  warmth: number; // 0-100 opacidad del tinte cálido superpuesto
  invert: number; // 0-100 inversión de colores (modo noche)
}

export interface RailSettings {
  position: RailPosition;
  segments: number; // nº de tramos = nº de hitos
  theme: RailTheme;
  showLabels: boolean;
  celebrate: boolean;
}

/** Fuentes curadas de la casa para el texto reflowable (EPUB y PDF texto) */
export type ReadingFont = "literata" | "garamond" | "atkinson";

/** Opciones del selector de fuente: id, nombre visible y variable next/font */
export const READING_FONTS: { id: ReadingFont; label: string; cssVar: string }[] = [
  { id: "literata", label: "Literata", cssVar: "--font-literata" },
  { id: "garamond", label: "EB Garamond", cssVar: "--font-eb-garamond" },
  { id: "atkinson", label: "Atkinson Hyperlegible", cssVar: "--font-atkinson" },
];

export interface ReadingSettings {
  dailyGoal: number; // páginas/día
  /** salto de scroll con ↑/↓ como % del alto visible del visor (10-100) */
  scrollStepPct: number;
  /** multiplicador de la rueda del mouse (1 = rueda nativa del navegador) */
  wheelBoost: number;
  /** fuente del texto reflowable (EPUB y modo texto) */
  font: ReadingFont;
}

/** Modo inmersión: la interfaz se desvanece si el mouse queda quieto */
export interface ImmersionSettings {
  enabled: boolean;
  idleSeconds: number; // 2-12 s de inactividad antes de ocultar
  /** tecla que oculta/muestra la interfaz al instante (independiente del mouse) */
  toggleKey: string;
}

/** Modo teleprompter: la página se enciende letra a letra a pantalla completa */
export interface TeleprompterSettings {
  /** palabras por segundo (0.8–4.0); el ritmo real respira con la puntuación */
  wps: number;
  /** Instantánea: todo de golpe, sin espera entre letras */
  instante: boolean;
  /** tic de tipeo por letra */
  sound: boolean;
  /** modo auto: al terminar una tarjeta avanza solo (y gira la página al acabar) */
  auto: boolean;
  /** multiplicador del tamaño de letra de las tarjetas (TELEPROMPTER_FONT_MIN..TELEPROMPTER_FONT_MAX) */
  fontScale: number;
  /** fondo del escenario: color del tema, portada del libro o imagen propia */
  fondo: TeleprompterFondo;
  /** ruta (en /uploads/) de la imagen propia; vacío = ninguna puesta */
  fondoRuta: string;
  /** intensidad del filtro de legibilidad sobre la imagen (0-100) */
  fondoFiltro: number;
  /** tarjetas por frase: los bloques largos se parten en frases legibles */
  tarjetasPorFrase: boolean;
  /** P2: pausar a mostrar las figuras (EPUB incorporadas, PDF renderizadas) */
  pausaImagen: boolean;
  /** P2: cuánto se muestra cada figura (ms), independiente de la velocidad */
  imagenHoldMs: number;
}

/** De dónde sale el fondo del escenario del teleprompter */
export type TeleprompterFondo = "tema" | "portada" | "imagen";

export const TELEPROMPTER_FONT_MIN = 0.8;
export const TELEPROMPTER_FONT_MAX = 1.6;
export const TELEPROMPTER_FONT_STEP = 0.1;

export function clampTeleprompterFontScale(v: number): number {
  const r = Math.round(v * 10) / 10;
  return Math.min(TELEPROMPTER_FONT_MAX, Math.max(TELEPROMPTER_FONT_MIN, r));
}

export interface AppSettings {
  /** idioma de la interfaz */
  lang: Lang;
  rail: RailSettings;
  filters: FilterSettings;
  reading: ReadingSettings;
  immersion: ImmersionSettings;
  teleprompter: TeleprompterSettings;
}

// ---------- Teleprompter: velocidades ----------

/** Control DIRECTO de velocidad: sin presets — la dueña manda (24-10) */
export const TELEPROMPTER_WPS_MIN = 0.8;
export const TELEPROMPTER_WPS_MAX = 4;
export const TELEPROMPTER_WPS_STEP = 0.1;
export const TELEPROMPTER_WPS_DEFAULT = 2.5;
/** intensidad por defecto del filtro de legibilidad del fondo (0-100) */
export const TELEPROMPTER_FONDO_FILTRO_DEFAULT = 55;
/** P2: espera de cada tarjeta de imagen (ms): independiente de la velocidad */
export const TELEPROMPTER_IMAGEN_HOLD_MIN = 2000;
export const TELEPROMPTER_IMAGEN_HOLD_MAX = 30000;
export const TELEPROMPTER_IMAGEN_HOLD_STEP = 500;
export const TELEPROMPTER_IMAGEN_HOLD_DEFAULT = 5000;

export function clampTeleprompterImagenHold(v: number): number {
  const r = Math.round(v / TELEPROMPTER_IMAGEN_HOLD_STEP) * TELEPROMPTER_IMAGEN_HOLD_STEP;
  return Math.min(TELEPROMPTER_IMAGEN_HOLD_MAX, Math.max(TELEPROMPTER_IMAGEN_HOLD_MIN, r));
}

export function clampTeleprompterWps(v: number): number {
  const r = Math.round(v * 10) / 10;
  return Math.min(TELEPROMPTER_WPS_MAX, Math.max(TELEPROMPTER_WPS_MIN, r));
}

/** Migración de instalaciones viejas: id de preset → palabras por segundo */
export function wpsDePresetAntiguo(id: string): number {
  switch (id) {
    case "0-8":
      return 0.8;
    case "1-5":
      return 1.5;
    case "2-5":
      return 2.5;
    case "4":
      return 4;
    default:
      return TELEPROMPTER_WPS_DEFAULT;
  }
}

export const RAIL_THEMES: Record<
  RailTheme,
  { label: string; fill: string; fillV: string; glow: string; cursor: string; soft: string }
> = {
  egeo: {
    label: "Egeo",
    // Azul Atenas: de abismo a espuma del mar Egeo según avanza la lectura
    fill: "linear-gradient(90deg, oklch(0.5 0.12 260), oklch(0.72 0.12 235))",
    fillV: "linear-gradient(0deg, oklch(0.5 0.12 260), oklch(0.72 0.12 235))",
    glow: "oklch(0.7 0.13 240 / 55%)",
    cursor: "oklch(0.82 0.11 235)",
    soft: "oklch(0.7 0.13 240 / 14%)",
  },
  dynamic: {
    label: "Dinámico (progreso)",
    // El color lo calcula RailBar según el avance (naranja → verde);
    // estos valores son la referencia para swatches y glow base.
    fill: "linear-gradient(90deg, oklch(0.75 0.14 55), oklch(0.8 0.15 145))",
    fillV: "linear-gradient(0deg, oklch(0.75 0.14 55), oklch(0.8 0.15 145))",
    glow: "oklch(0.8 0.15 130 / 55%)",
    cursor: "oklch(0.85 0.16 130)",
    soft: "oklch(0.8 0.15 130 / 14%)",
  },
  amber: {
    label: "Ámbar",
    fill: "linear-gradient(90deg, oklch(0.72 0.12 75), oklch(0.83 0.14 85))",
    fillV: "linear-gradient(0deg, oklch(0.72 0.12 75), oklch(0.83 0.14 85))",
    glow: "oklch(0.79 0.13 82 / 55%)",
    cursor: "oklch(0.85 0.15 85)",
    soft: "oklch(0.79 0.13 82 / 14%)",
  },
  emerald: {
    label: "Esmeralda",
    fill: "linear-gradient(90deg, oklch(0.6 0.12 150), oklch(0.76 0.15 155))",
    fillV: "linear-gradient(0deg, oklch(0.6 0.12 150), oklch(0.76 0.15 155))",
    glow: "oklch(0.72 0.14 145 / 55%)",
    cursor: "oklch(0.8 0.15 152)",
    soft: "oklch(0.72 0.14 145 / 14%)",
  },
  rose: {
    label: "Rosa",
    fill: "linear-gradient(90deg, oklch(0.62 0.15 15), oklch(0.75 0.16 22))",
    fillV: "linear-gradient(0deg, oklch(0.62 0.15 15), oklch(0.75 0.16 22))",
    glow: "oklch(0.7 0.16 25 / 55%)",
    cursor: "oklch(0.78 0.16 22)",
    soft: "oklch(0.7 0.16 25 / 14%)",
  },
  violet: {
    label: "Violeta",
    fill: "linear-gradient(90deg, oklch(0.58 0.15 300), oklch(0.72 0.15 310))",
    fillV: "linear-gradient(0deg, oklch(0.58 0.15 300), oklch(0.72 0.15 310))",
    glow: "oklch(0.72 0.14 310 / 55%)",
    cursor: "oklch(0.78 0.14 312)",
    soft: "oklch(0.72 0.14 310 / 14%)",
  },
  cyan: {
    label: "Turquesa",
    fill: "linear-gradient(90deg, oklch(0.6 0.1 195), oklch(0.78 0.12 200))",
    fillV: "linear-gradient(0deg, oklch(0.6 0.1 195), oklch(0.78 0.12 200))",
    glow: "oklch(0.78 0.12 200 / 55%)",
    cursor: "oklch(0.82 0.12 202)",
    soft: "oklch(0.78 0.12 200 / 14%)",
  },
};

/**
 * Tema dinámico estilo Duolingo: el color del tramo avanza por una rampa
 * cálida → verde según el avance global del libro. Devuelve color oklch.
 */
export function dynamicSegmentColor(progressInSegment: number, overallProgress: number): string {
  const p = Math.min(1, Math.max(0, overallProgress));
  // Hue: 55 (ámbar/naranja) al empezar → 150 (verde) cerca del final
  const hue = 55 + (150 - 55) * p;
  // El tramo activo se aclara un poco a medida que se llena (feedback sutil)
  const light = 0.7 + 0.1 * Math.min(1, Math.max(0, progressInSegment));
  const chroma = 0.13 + 0.03 * p;
  return `oklch(${light.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

export function dynamicCursorColor(overallProgress: number): string {
  const p = Math.min(1, Math.max(0, overallProgress));
  const hue = 55 + (150 - 55) * p;
  return `oklch(0.85 0.16 ${hue.toFixed(1)})`;
}

export const FILTER_PRESETS: Record<
  FilterPreset,
  { label: string; filters: FilterSettings; css: string }
> = {
  auto: {
    label: "Auto",
    css: "none",
    filters: { preset: "auto", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
  },
  normal: {
    label: "Normal",
    css: "none",
    filters: { preset: "normal", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
  },
  papel: {
    label: "Papel",
    css: "brightness(1.03) contrast(0.96) sepia(0.18) saturate(0.95)",
    filters: { preset: "papel", brightness: 103, contrast: 96, sepia: 18, saturate: 95, warmth: 22, invert: 0 },
  },
  sepia: {
    label: "Sepia",
    css: "brightness(1.0) contrast(0.97) sepia(0.5) saturate(0.9)",
    filters: { preset: "sepia", brightness: 100, contrast: 97, sepia: 50, saturate: 90, warmth: 30, invert: 0 },
  },
  noche: {
    label: "Noche",
    css: "invert(0.92) hue-rotate(180deg) brightness(0.94) contrast(1.05) saturate(0.85)",
    filters: { preset: "noche", brightness: 94, contrast: 105, sepia: 0, saturate: 85, warmth: 0, invert: 92 },
  },
  calido: {
    label: "Cálido",
    css: "brightness(0.97) contrast(1.0) sepia(0.28) saturate(1.05)",
    filters: { preset: "calido", brightness: 97, contrast: 100, sepia: 28, saturate: 105, warmth: 45, invert: 0 },
  },
  custom: {
    label: "Personalizado",
    css: "none",
    filters: { preset: "custom", brightness: 100, contrast: 100, sepia: 0, saturate: 100, warmth: 0, invert: 0 },
  },
};
