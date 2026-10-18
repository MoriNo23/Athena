"use client";

import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { BookDTO } from "@/lib/types";

/** Parches de ficha que el lector puede tocar en vivo */
export type BookPatch = { milestones?: number | null; dailyGoal?: number | null };

/**
 * Ajustes individuales del libro (hitos y meta diaria): actualización
 * optimista + confirmación desde la BD. null = heredar el global.
 */
export function useBookMilestones(opts: {
  book: BookDTO;
  onBookChange?: (book: BookDTO) => void;
}) {
  const { book, onBookChange } = opts;
  const { toast } = useToast();

  const patchBook = useCallback(
    (patch: BookPatch) => {
      // optimista: los dos campos viajan en el mismo PATCH, se aplican juntos
      if ("milestones" in patch || "dailyGoal" in patch) {
        onBookChange?.({
          ...book,
          ...("milestones" in patch ? { milestones: patch.milestones ?? null } : {}),
          ...("dailyGoal" in patch ? { dailyGoal: patch.dailyGoal ?? null } : {}),
        });
      }
      if (patch.milestones != null) {
        toast({
          title: "Hitos actualizados",
          description: `«${book.title}» ahora tiene ${patch.milestones} tramos en su riel.`,
          duration: 3500,
        });
      }
      fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          if (data.book) onBookChange?.({ ...data.book });
        })
        .catch(() => undefined);
    },
    [book, onBookChange, toast]
  );

  return { patchBook };
}
