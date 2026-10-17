"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings";
import { useWordSelectionEvents } from "@/hooks/use-word-selection";
import { useI18n } from "@/lib/i18n";
import type { DictionaryResult } from "@/lib/types";

export interface SelectionState {
  word: string;
  x: number;
  y: number;
}

/**
 * Estado del popover de diccionario: al soltar el mouse con una palabra
 * seleccionada dentro de la capa de texto del PDF consulta /api/dictionary
 * (RAE es / Wiktionary en, con detección automática de idioma), permite cambiar
 * de idioma, pronunciar y guardar en vocabulario. La detección de eventos vive
 * en useWordSelectionEvents.
 */
export function useDictionaryPopover(opts: {
  enabled: boolean;
  bookId: string;
  bookTitle: string;
  page: number;
}) {
  const { enabled, bookId, bookTitle, page } = opts;
  const { toast } = useToast();
  const { t } = useI18n();
  const vocabulary = useSettings((s) => s.vocabulary);
  const addVocab = useSettings((s) => s.addVocab);

  const [sel, setSel] = useState<SelectionState | null>(null);
  const [lang, setLang] = useState<"auto" | "es" | "en">("auto");
  const [data, setData] = useState<DictionaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const close = useCallback(() => {
    setSel(null);
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  /** Consulta al diccionario; se llama desde eventos (mouseup / cambio de idioma) */
  const runLookup = useCallback((word: string, which: "auto" | "es" | "en") => {
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/dictionary?word=${encodeURIComponent(word)}&lang=${which}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("bad response");
        return (await r.json()) as DictionaryResult;
      })
      .then((res) => {
        if (requestIdRef.current !== id) return;
        setData(res);
      })
      .catch(() => {
        if (requestIdRef.current !== id) return;
        setError(t("dict.errOffline"));
      })
      .finally(() => {
        if (requestIdRef.current === id) setLoading(false);
      });
  }, [t]);

  const onPick = useCallback(
    (pick: { word: string; x: number; y: number }) => {
      setSel(pick);
      setLang("auto");
      runLookup(pick.word, "auto");
    },
    [runLookup]
  );

  useWordSelectionEvents({
    enabled,
    bookId,
    active: !!sel,
    cardRef,
    onPick,
    onClear: close,
  });

  const wordLower = sel?.word.toLowerCase() ?? "";
  const saved =
    !!data && vocabulary.some((v) => v.word.toLowerCase() === wordLower && v.lang === data.lang);

  const save = useCallback(() => {
    if (!data || saved) return;
    const first = data.entries[0]?.defs[0]?.d ?? "";
    addVocab({
      id: `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      word: data.word,
      lang: data.lang,
      short: first.length > 140 ? `${first.slice(0, 137)}…` : first,
      bookId,
      bookTitle,
      page,
      createdAt: new Date().toISOString(),
    });
    toast({
      title: t("dict.savedToast", { word: data.word }),
      description: t("dict.savedToastBody"),
      duration: 3000,
    });
  }, [data, saved, addVocab, bookId, bookTitle, page, toast, t]);

  const pronounce = useCallback(() => {
    if (!data?.audio) return;
    try {
      const audio = new Audio(data.audio);
      void audio.play().catch(() => undefined);
    } catch {
      /* noop */
    }
  }, [data]);

  const switchLang = useCallback(
    (l: "es" | "en") => {
      if (!sel) return;
      setLang(l);
      runLookup(sel.word, l);
    },
    [sel, runLookup]
  );

  return { sel, cardRef, lang, data, loading, error, saved, close, switchLang, save, pronounce };
}
