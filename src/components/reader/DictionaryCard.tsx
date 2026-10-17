"use client";

import { Button } from "@/components/ui/button";
import { DictionaryEntries } from "@/components/reader/DictionaryEntries";
import type { DictionaryResult } from "@/lib/types";
import { Globe, Loader2, Star, Volume2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { RefObject } from "react";

interface DictionaryCardProps {
  word: string;
  lang: "auto" | "es" | "en";
  data: DictionaryResult | null;
  loading: boolean;
  error: string | null;
  saved: boolean;
  left: number;
  top: number;
  cardRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onSwitchLang: (l: "es" | "en") => void;
  onSave: () => void;
  onPronounce: () => void;
}

/**
 * Tarjeta del diccionario: cabecera (palabra, idioma, fonética, origen,
 * pronunciar), cuerpo (cargando / error / sin resultados / definiciones) y pie
 * (idioma + guardar en vocabulario). Presentación pura.
 */
export function DictionaryCard({
  word,
  lang,
  data,
  loading,
  error,
  saved,
  left,
  top,
  cardRef,
  onClose,
  onSwitchLang,
  onSave,
  onPronounce,
}: DictionaryCardProps) {
  const { t } = useI18n();
  return (
    <div
      ref={cardRef}
      className="dict-pop fixed z-50 rounded-xl border border-border/70 bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur"
      style={{ left, top, width: 340 }}
      role="dialog"
      aria-label={t("dict.aria", { word })}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2 border-b border-border/60 px-4 pt-3 pb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-display text-lg font-semibold leading-tight">{word}</h4>
            {data && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">
                {data.lang}
              </span>
            )}
            {data?.phonetic && (
              <span className="hidden truncate text-xs text-muted-foreground xl:inline">{data.phonetic}</span>
            )}
          </div>
          {data?.origin && (
            <p className="mt-0.5 line-clamp-1 text-[11px] italic text-muted-foreground">{data.origin}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {data?.audio && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPronounce} aria-label={t("dict.pronounce")} title={t("dict.pronounce")}>
              <Volume2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label={t("dict.close")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="max-h-[300px] overflow-y-auto px-4 py-3" data-testid="dictionary-card">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("dict.searching")}
          </div>
        )}
        {error && <p className="py-4 text-center text-sm text-muted-foreground">{error}</p>}
        {data && !data.found && (
          <div className="grid gap-2 py-2 text-center">
            <p className="text-sm text-muted-foreground">
              {t("dict.noResults", { word: data.word, lang: data.lang === "es" ? t("dict.langEs") : t("dict.langEn") })}
            </p>
            <p className="text-xs text-muted-foreground">{t("dict.tryOther")}</p>
          </div>
        )}
        {data?.found && <DictionaryEntries data={data} />}
      </div>

      {/* Pie: idioma + guardar */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
        <div className="flex items-center gap-1" role="group" aria-label={t("dict.langGroup")}>
          <Globe className="mr-0.5 h-3.5 w-3.5 text-muted-foreground" />
          {(["es", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => onSwitchLang(l)}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase transition-colors ${
                lang === l
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={lang === l}
            >
              {l}
            </button>
          ))}
        </div>
        <Button
          variant={saved ? "secondary" : "outline"}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onSave}
          disabled={!data?.found || saved}
          title={saved ? t("dict.savedTip") : t("dict.saveTip")}
        >
          <Star className={`h-3.5 w-3.5 ${saved ? "fill-primary text-primary" : ""}`} />
          {saved ? t("dict.saved") : t("dict.save")}
        </Button>
      </div>
    </div>
  );
}
