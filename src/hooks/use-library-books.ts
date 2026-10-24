"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { computeStreak, dayKey, groupSessionsByDay } from "@/lib/reading";
import type { BookDTO } from "@/lib/types";

export type BookWithSessions = BookDTO & {
  sessions: { pagesRead: number; minutes: number; date: string }[];
};

/** Biblioteca: carga de libros, fusión de parches y stats globales de hoy */
export function useLibraryBooks() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [books, setBooks] = useState<BookWithSessions[] | null>(null);
  const [locked, setLocked] = useState(false);

  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch("/api/books", { cache: "no-store" });
      // candado auth-api: el API protegido responde 401 → puerta de contraseña
      // (no tratarlo como biblioteca vacía)
      if (res.status === 401) {
        setLocked(true);
        return;
      }
      const data = await res.json();
      setBooks(data.books ?? []);
      setLocked(false);
    } catch {
      toast({ title: t("lib.errorTitle"), description: t("lib.errorBody"), variant: "destructive" });
      setBooks([]);
    }
  }, [toast, t]);

  /** fusiona cambios parciales de un libro (ficha/portada/insignia) en el estado local */
  const updateBook = useCallback((patch: Partial<BookWithSessions> & { id: string }) => {
    setBooks((prev) => (prev ? prev.map((b) => (b.id === patch.id ? { ...b, ...patch } : b)) : prev));
  }, []);

  const stats = useMemo(() => {
    const allSessions = (books ?? []).flatMap((b) => b.sessions);
    const dayMap = groupSessionsByDay(allSessions);
    const today = dayMap.get(dayKey(new Date())) ?? { pages: 0, minutes: 0 };
    const streak = computeStreak(dayMap);
    // libros de carpeta con páginas sin contar (totalPages=0) no cuentan como terminados
    const finished = (books ?? []).filter((b) => b.totalPages > 0 && b.currentPage >= b.totalPages).length;
    return { streak, pagesToday: today.pages, minutesToday: today.minutes, finished };
  }, [books]);

  return { books, fetchBooks, updateBook, stats, locked };
}
