"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { searchCover, uploadCover, type CoverHit } from "@/lib/cover-search";
import { useI18n } from "@/lib/i18n";

type CoverSource = "openlibrary" | "googlebooks";

function sourceLabel(source: CoverSource): string {
  return source === "openlibrary" ? "Open Library" : "Google Books";
}

/**
 * Portada del libro: búsqueda automática en APIs gratuitas (solo con título +
 * autor) y subida manual de imagen. Aplica al instante vía /api/books/[id]/cover
 * y avisa con tostadas; los estados searching/importing bloquean el diálogo.
 */
export function useCoverManager(opts: {
  open: boolean;
  book: { id: string; title: string; author: string | null; coverPath: string | null } | null;
  title: string;
  author: string;
  onSaved: (book: { id: string; title: string; author: string | null; coverPath: string | null }) => void;
}) {
  const { open, book, title, author, onSaved } = opts;
  const { toast } = useToast();
  const { t } = useI18n();
  const [cover, setCover] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // al abrir el diálogo, la portada parte de la actual del libro
  useEffect(() => {
    if (!open || !book) return;
    setCover(book.coverPath);
    setSearching(false);
    setImporting(false);
  }, [open, book]);

  /** Sube/aplica el hit encontrado y avisa; devuelve si la portada quedó aplicada */
  const applyHit = useCallback(
    async (hit: CoverHit, meta: { title: string; author: string }): Promise<boolean> => {
      if (!book || !hit) return false;
      const up = await uploadCover(book.id, hit);
      if (!up.ok || !up.coverPath) {
        toast({
          title: t("cover.applyFailTitle"),
          description: up.error ?? t("edit.tryAgain"),
          variant: "destructive",
        });
        return false;
      }
      setCover(up.coverPath);
      onSaved({ id: book.id, title: meta.title, author: meta.author || null, coverPath: up.coverPath });
      const src = sourceLabel(hit.source);
      toast({
        title: t("cover.updatedTitle"),
        description: hit.downloaded
          ? t("cover.downloadedBody", { src })
          : t("cover.linkedBody", { src }),
      });
      return true;
    },
    [book, onSaved, toast, t]
  );

  /** Busca la portada en la API y la aplica al libro; silent = sin tostadas de aviso */
  const runCoverSearch = useCallback(
    async (silent = false): Promise<boolean> => {
      if (!book) return false;
      const meta = { title: title.trim(), author: author.trim() };
      if (!meta.title || !meta.author) {
        if (!silent) {
          toast({
            title: t("cover.missingTitle"),
            description: t("cover.missingBody"),
          });
        }
        return false;
      }
      setSearching(true);
      try {
        const hit = await searchCover(meta.title, meta.author);
        if (!hit) {
          if (!silent) {
            toast({
              title: t("cover.noResultsTitle"),
              description: t("cover.noResultsBody"),
            });
          }
          return false;
        }
        return await applyHit(hit, meta);
      } catch {
        if (!silent) {
          toast({
            title: t("cover.searchFailTitle"),
            description: t("cover.searchFailBody"),
          });
        }
        return false;
      } finally {
        setSearching(false);
      }
    },
    [book, title, author, applyHit, toast, t]
  );

  /** Portada manual: sube la imagen elegida y la aplica al instante */
  const onPickFile = useCallback(
    async (file: File | undefined | null) => {
      if (!book || !file) return;
      if (!file.type.startsWith("image/")) {
        toast({ title: t("cover.notImage"), variant: "destructive" });
        return;
      }
      setImporting(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/books/${book.id}/cover`, { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t("cover.uploadError"));
        setCover(data.book.coverPath);
        onSaved({ id: book.id, title: title.trim() || book.title, author: author.trim() || null, coverPath: data.book.coverPath });
        toast({ title: t("cover.appliedTitle"), description: t("cover.appliedBody") });
      } catch (e) {
        toast({
          title: t("cover.imageFailTitle"),
          description: e instanceof Error ? e.message : t("edit.tryAgain"),
          variant: "destructive",
        });
      } finally {
        setImporting(false);
      }
    },
    [book, title, author, onSaved, toast]
  );

  return { cover, searching, importing, fileRef, runCoverSearch, onPickFile };
}
