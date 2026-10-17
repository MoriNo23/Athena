"use client";

import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { BookDTO } from "@/lib/types";

/**
 * Hitos individuales del libro: actualización optimista + confirmación desde
 * la BD. null = hereda los hitos globales del riel.
 */
export function useBookMilestones(opts: {
  book: BookDTO;
  onBookChange?: (book: BookDTO) => void;
}) {
  const { book, onBookChange } = opts;
  const { toast } = useToast();

  const patchBook = useCallback(
    (patch: { milestones?: number | null }) => {
      if ("milestones" in patch) {
        onBookChange?.({ ...book, milestones: patch.milestones ?? null });
        if (patch.milestones != null) {
          toast({
            title: "Hitos actualizados",
            description: `«${book.title}» ahora tiene ${patch.milestones} tramos en su riel.`,
            duration: 3500,
          });
        }
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
