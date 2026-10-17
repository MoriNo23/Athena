"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCoverManager } from "@/hooks/use-cover-manager";
import { useI18n } from "@/lib/i18n";
import { BadgeCheck, BookOpen, ImagePlus, Loader2, Search, Sparkles } from "lucide-react";

interface EditBookDialogProps {
  book: {
    id: string;
    title: string;
    author: string | null;
    coverPath: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** devuelve el libro actualizado (ficha y/o portada) para refrescar la biblioteca */
  onSaved: (book: { id: string; title: string; author: string | null; coverPath: string | null }) => void;
}

/** Portada actual del libro (o marcador si no tiene) */
function CoverPreview({ cover }: { cover: string | null }) {
  const { t } = useI18n();
  return (
    <div className="flex h-36 w-24 shrink-0 items-center justify-center overflow-hidden border-2 border-[var(--ink)] bg-secondary shadow-[3px_3px_0_0_var(--ink)]">
      {cover ? (
        <img src={cover} alt={t("edit.coverAlt")} className="h-full w-full object-cover" data-testid="edit-cover-preview" />
      ) : (
        <BookOpen className="h-7 w-7 text-muted-foreground" />
      )}
    </div>
  );
}

/** Aviso de validez para insignias según título + autor */
function EligibilityBadge({ metaValid }: { metaValid: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
        metaValid ? "border-primary/30 bg-primary/8 text-foreground" : "border-border/60 text-muted-foreground"
      }`}
      data-testid="edit-eligibility"
    >
      {metaValid ? (
        <>
          <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
          <span>
            {t("edit.eligibleOk")}
          </span>
        </>
      ) : (
        <>
          <BookOpen className="h-4 w-4 shrink-0" />
          <span>{t("edit.eligibleNo")}</span>
        </>
      )}
    </div>
  );
}

/**
 * Personalización del libro: título y autor a mano (validez de la insignia)
 * y portada real buscada en APIs gratuitas — solo cuando hay título + autor.
 */
export function EditBookDialog({ book, open, onOpenChange, onSaved }: EditBookDialogProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);
  // evita re-buscar la portada en cada guardado si la ficha no cambió
  const metaSnapshot = useRef<{ title: string; author: string }>({ title: "", author: "" });

  useEffect(() => {
    if (!open || !book) return;
    setTitle(book.title);
    setAuthor(book.author ?? "");
    metaSnapshot.current = { title: book.title, author: book.author ?? "" };
    setSaving(false);
  }, [open, book]);

  const { cover, searching, importing, fileRef, runCoverSearch, onPickFile } = useCoverManager({
    open,
    book,
    title,
    author,
    onSaved,
  });

  const metaValid = !!title.trim() && !!author.trim();
  const busy = saving || searching || importing;

  const save = async () => {
    if (!book) return;
    const trimmed = title.trim();
    if (!trimmed) {
      toast({ title: t("edit.titleRequired"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const changedMeta =
        trimmed !== metaSnapshot.current.title || author.trim() !== metaSnapshot.current.author;
      const res = await fetch(`/api/books/${book.id}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, author: author.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("edit.errorSaving"));
      onSaved({
        id: book.id,
        title: data.book.title as string,
        author: (data.book.author ?? null) as string | null,
        coverPath: cover,
      });
      toast({ title: t("edit.savedToast"), description: metaValid ? t("edit.savedOk") : t("edit.savedNo") });

      // Portada automática: solo si el usuario especificó título + autor y la ficha cambió
      if (changedMeta && metaValid) {
        await runCoverSearch(false);
      }
      onOpenChange(false);
    } catch (e) {
      toast({
        title: t("edit.saveError"),
        description: e instanceof Error ? e.message : t("edit.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md" data-testid="edit-book-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("edit.title")}</DialogTitle>
          <DialogDescription>
            {t("edit.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="flex gap-4">
            <CoverPreview cover={cover} />
            <div className="grid flex-1 content-center gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-title">{t("lib.title")}</Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("lib.titlePlaceholder")}
                  data-testid="edit-title"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-author">{t("edit.author")}</Label>
                <Input
                  id="edit-author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder={t("lib.authorPlaceholder")}
                  data-testid="edit-author"
                />
              </div>
            </div>
          </div>

          <EligibilityBadge metaValid={metaValid} />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => void runCoverSearch(false)}
              disabled={busy}
              data-testid="edit-search-cover"
            >
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
              {searching ? t("edit.searching") : t("edit.searchCover")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              data-testid="edit-upload-cover"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {t("edit.uploadImage")}
            </Button>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
              <Search className="h-3 w-3" /> Open Library · Google Books
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void onPickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={busy || !title.trim()} className="gap-2" data-testid="edit-save">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
