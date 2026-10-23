"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import type { BookDTO, BookExtras } from "@/lib/types";

/**
 * Extras del libro (notas, pausas, hitos por panel) con patch optimista y
 * persistencia, y estado abierto/colapsado del panel de ajustes persistido
 * en localStorage.
 */
export function useBookExtras(opts: {
  book: BookDTO;
  onBookChange?: (book: BookDTO) => void;
}) {
  const { book, onBookChange } = opts;
  const modes = useSettings((s) => s.modes);

  const [extras, setExtras] = useState<BookExtras>(() => book.extras ?? {});
  const extrasRef = useRef<BookExtras>(extras);
  const bookRef = useRef(book);

  // Recuerda si el usuario dejó el panel colapsado: se restaura tal cual en cualquier libro.
  // Sin regla guardada = cerrado: la primera lectura es texto puro hasta que pides el dock.
  const [dockOpen, setDockOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem("riel-dock-open") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    bookRef.current = book;
  }, [book]);

  const patchExtras = useCallback(
    (patch: Partial<BookExtras>) => {
      const merged = { ...extrasRef.current, ...patch };
      extrasRef.current = merged;
      setExtras(merged);
      onBookChange?.({ ...bookRef.current, extras: merged });
      fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extras: merged }),
      }).catch(() => undefined);
    },
    [book.id, onBookChange]
  );

  // Persistir el estado abierto/colapsado del panel de ajustes
  useEffect(() => {
    try {
      localStorage.setItem("riel-dock-open", dockOpen ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [dockOpen]);

  return { extras, extrasRef, bookRef, patchExtras, dockOpen, setDockOpen, modes };
}
