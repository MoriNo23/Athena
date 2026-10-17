"use client";

import { DictionaryCard } from "@/components/reader/DictionaryCard";
import { useDictionaryPopover } from "@/hooks/use-dictionary-popover";

/**
 * Popover de diccionario: al soltar el mouse con una palabra seleccionada
 * dentro de la capa de texto del PDF, consulta /api/dictionary (RAE es /
 * Wiktionary en, con detección automática de idioma) y muestra la definición.
 * Toda la lógica vive en useDictionaryPopover; aquí solo queda el posicionamiento.
 */
export function DictionaryPopover({
  enabled,
  bookId,
  bookTitle,
  page,
}: {
  enabled: boolean;
  bookId: string;
  bookTitle: string;
  page: number;
}) {
  const dict = useDictionaryPopover({ enabled, bookId, bookTitle, page });
  const { sel } = dict;

  if (!enabled || !sel) return null;

  // Posición: centrado sobre la selección, acotado a la ventana
  const cardW = 340;
  const left = Math.min(Math.max(8, sel.x - cardW / 2), window.innerWidth - cardW - 8);
  const top = Math.min(sel.y + 8, window.innerHeight - 380);

  return (
    <DictionaryCard
      word={sel.word}
      lang={dict.lang}
      data={dict.data}
      loading={dict.loading}
      error={dict.error}
      saved={dict.saved}
      left={left}
      top={top}
      cardRef={dict.cardRef}
      onClose={dict.close}
      onSwitchLang={dict.switchLang}
      onSave={dict.save}
      onPronounce={dict.pronounce}
    />
  );
}
