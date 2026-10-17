"use client";

import { useEffect, useMemo, useState } from "react";
import { estimateFinishDate, groupSessionsByDay, pickDailyRate, type DailyRate } from "@/lib/reading";

/**
 * Fecha estimada de fin del libro en el lector, a partir del ritmo real de
 * sesiones (7 días → 30 días → toda la historia). El ritmo se carga una vez
 * al abrir el libro; la fecha se recalcula con la página VIVA, así la
 * estimación mejora delante de tus ojos mientras lees.
 */
export function useFinishEta(opts: { bookId: string; livePage: number; totalPages: number }) {
  const { bookId, livePage, totalPages } = opts;
  const [rate, setRate] = useState<DailyRate>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/books", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const mine = (data.books ?? []).find((b: { id: string }) => b.id === bookId);
        if (!mine) return;
        setRate(pickDailyRate(groupSessionsByDay(mine.sessions ?? [])));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [bookId]);

  const eta = useMemo(
    () => (rate ? estimateFinishDate({ totalPages, currentPage: livePage }, rate.pages) : null),
    [rate, livePage, totalPages]
  );

  return eta;
}
