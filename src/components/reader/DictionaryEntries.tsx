"use client";

import type { DictionaryResult } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

/** Bloque de resultados: definiciones numeradas con ejemplos y sinónimos */
export function DictionaryEntries({ data }: { data: DictionaryResult }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3">
      {data.entries.map((entry, i) => (
        <div key={i} className="grid gap-1.5">
          {entry.pos && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/90">{entry.pos}</p>
          )}
          <ol className="grid gap-1.5">
            {entry.defs.map((def, j) => (
              <li key={j} className="text-sm leading-snug">
                <span className="mr-1 text-muted-foreground tabular-nums">{j + 1}.</span>
                {def.d}
                {def.ex && (
                  <span className="mt-0.5 block text-xs italic text-muted-foreground">«{def.ex}»</span>
                )}
              </li>
            ))}
          </ol>
          {entry.synonyms && entry.synonyms.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {entry.synonyms.map((s) => (
                <span key={s} className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] text-secondary-foreground">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      <p className="pt-1 text-[10px] text-muted-foreground/80">{t("dict.source", { src: data.source })}</p>
    </div>
  );
}
