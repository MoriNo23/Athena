"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { BookWithSessions } from "@/hooks/use-library-books";

/**
 * Acciones destructivas de la biblioteca (con confirmación): eliminar un libro,
 * reiniciar sus lecturas y reiniciar todo el progreso. Los guardas anti doble
 * clic (resettingOne/resettingAll) evitan disparos repetidos.
 */
export function useBookActions(opts: { onBooksChanged: () => Promise<void> }) {
  const { onBooksChanged } = opts;
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<BookWithSessions | null>(null);
  const [editTarget, setEditTarget] = useState<BookWithSessions | null>(null);
  const [resetTarget, setResetTarget] = useState<BookWithSessions | null>(null);
  const [resetAllOpen, setResetAllOpen] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);
  const [resettingOne, setResettingOne] = useState(false);

  /** Deshacer un borrado: pide a la papelera del servidor que devuelva todo */
  const undoDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch("/api/books/undo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          toast({
            title: "Ya no se puede deshacer",
            description: "El libro se borró del todo: los archivos salieron del riel.",
            variant: "destructive",
          });
          return;
        }
        const data = await res.json();
        toast({ title: "Libro recuperado", description: `«${data.book?.title}» volvió con todo su progreso.` });
        await onBooksChanged();
      } catch {
        toast({ title: "Error", description: "No se pudo deshacer el borrado", variant: "destructive" });
      }
    },
    [onBooksChanged, toast]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const title = deleteTarget.title;
    const bookId = deleteTarget.id;
    try {
      const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({
        title: "Libro eliminado",
        description: title,
        duration: 10000,
        action: (
          <ToastAction altText="Deshacer el borrado" onClick={() => void undoDelete(bookId)}>
            Deshacer
          </ToastAction>
        ),
      });
      setDeleteTarget(null);
      await onBooksChanged();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el libro", variant: "destructive" });
    }
  }, [deleteTarget, onBooksChanged, toast, undoDelete]);

  const confirmReset = useCallback(async () => {
    if (!resetTarget || resettingOne) return;
    setResettingOne(true);
    try {
      const res = await fetch(`/api/books/${resetTarget.id}/reset`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Lecturas reiniciadas", description: `«${resetTarget.title}» vuelve a la página 1, sin insignia.` });
      setResetTarget(null);
      await onBooksChanged();
    } catch {
      toast({ title: "Error", description: "No se pudo reiniciar el libro", variant: "destructive" });
    } finally {
      setResettingOne(false);
    }
  }, [resetTarget, resettingOne, onBooksChanged, toast]);

  const confirmResetAll = useCallback(async () => {
    setResettingAll(true);
    try {
      const res = await fetch("/api/progress/reset-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      toast({
        title: "Biblioteca reiniciada",
        description: `${data.books} libros en página 1 · insignias y sesiones borradas.`,
      });
      setResetAllOpen(false);
      await onBooksChanged();
    } catch {
      toast({ title: "Error", description: "No se pudo reiniciar el progreso", variant: "destructive" });
    } finally {
      setResettingAll(false);
    }
  }, [onBooksChanged, toast]);

  return {
    deleteTarget,
    setDeleteTarget,
    editTarget,
    setEditTarget,
    resetTarget,
    setResetTarget,
    resetAllOpen,
    setResetAllOpen,
    resettingAll,
    resettingOne,
    confirmDelete,
    confirmReset,
    confirmResetAll,
  };
}
