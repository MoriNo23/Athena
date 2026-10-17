"use client";

import { useEffect, useMemo } from "react";
import { useSettings } from "@/lib/settings";
import type { Lang } from "@/lib/types";
import { es } from "./es";
import { en } from "./en";
import { pt } from "./pt";

/**
 * Idiomas de la casa. La interfaz nació en español y ahora habla tres lenguas:
 * es (por defecto), en y pt. Los diccionarios son planos (clave → cadena) para
 * poder auditar claves huérfanas con un script, y toda interpolación viaja en
 * llaves: t("card.pages", { cur: 4, total: 670 }).
 */

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

const DICTS: Record<Lang, Record<string, string>> = { es, en, pt };

/** Idiomas ofrecidos en el selector (el nombre va siempre en su propia lengua) */
export const LANGUAGES: { id: Lang; label: string; short: string }[] = [
  { id: "es", label: "Español", short: "ES" },
  { id: "en", label: "English", short: "EN" },
  { id: "pt", label: "Português", short: "PT" },
];

const LOCALES: Record<Lang, string> = { es: "es-ES", en: "en-GB", pt: "pt-BR" };

/** Fecha de imprenta («3 de noviembre») en el idioma de la interfaz */
export function formatDate(d: Date, lang: Lang): string {
  return d.toLocaleDateString(LOCALES[lang] ?? "es-ES", { day: "numeric", month: "long" });
}

export function translator(lang: Lang): Translator {
  const dict = DICTS[lang] ?? DICTS.es;
  return (key, vars) => {
    let out = dict[key] ?? DICTS.es[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(`{${k}}`, String(v));
      }
    }
    return out;
  };
}

/** Locale BCP-47 del idioma (para toLocaleDateString de paneles) */
export function localeOf(lang: Lang): string {
  return LOCALES[lang] ?? "es-ES";
}

export function useI18n() {
  const lang = useSettings((s) => s.lang);
  const setLang = useSettings((s) => s.setLang);
  const t = useMemo(() => translator(lang), [lang]);

  // <html lang> sincronizado con la elección (lectores de pantalla incluidos)
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return { lang, setLang, t };
}
