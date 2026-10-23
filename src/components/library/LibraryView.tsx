"use client";

import { useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { HeroMenu } from "@/components/library/HeroMenu";
import { BadgeShelf } from "@/components/library/BadgeShelf";
import { EditBookDialog } from "@/components/library/EditBookDialog";
import { BookCard } from "@/components/library/BookCard";
import { LibraryConfirmDialogs } from "@/components/library/LibraryConfirmDialogs";
import { LockGate } from "@/components/library/LockGate";
import { useLibraryBooks } from "@/hooks/use-library-books";
import { useBookUpload } from "@/hooks/use-book-upload";
import { useBookActions } from "@/hooks/use-book-actions";
import { formatMinutes } from "@/lib/reading";
import {
  Clock3,
  Flame,
  Loader2,
  Plus,
  Target,
  Trophy,
  UploadCloud,
} from "lucide-react";
import type { BookDTO } from "@/lib/types";

export type { BookWithSessions } from "@/hooks/use-library-books";
import type { BookWithSessions } from "@/hooks/use-library-books";

/** Sello de Atena: columna dórica geométrica en marco cuadrado.
    Minimalista y brutalista — piedra, no caricatura. */
function AtenaSeal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      {/* marco del sello */}
      <rect x="6" y="6" width="52" height="52" stroke="currentColor" strokeWidth="2.6" />
      {/* capitel: ábaco + equino */}
      <rect x="21" y="15" width="22" height="3.6" stroke="currentColor" strokeWidth="2.2" />
      <line x1="24" y1="22.5" x2="40" y2="22.5" stroke="currentColor" strokeWidth="2.2" />
      {/* fuste con tres estrías */}
      <line x1="26.5" y1="22.5" x2="26.5" y2="41.5" stroke="currentColor" strokeWidth="2.2" />
      <line x1="32" y1="22.5" x2="32" y2="41.5" stroke="currentColor" strokeWidth="2.2" />
      <line x1="37.5" y1="22.5" x2="37.5" y2="41.5" stroke="currentColor" strokeWidth="2.2" />
      {/* basa y estilóbato */}
      <line x1="24" y1="45.5" x2="40" y2="45.5" stroke="currentColor" strokeWidth="2.2" />
      <line x1="18" y1="50.5" x2="46" y2="50.5" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

interface LibraryViewProps {
  /** abre el lector: las tarjetas siempre pasan el libro CON sus sesiones */
  onOpen: (book: BookWithSessions) => void;
}

export function LibraryView({ onOpen }: LibraryViewProps) {
  const rail = useSettings((s) => s.rail);
  const dailyGoal = useSettings((s) => s.reading.dailyGoal);
  const { t } = useI18n();

  const { books, fetchBooks, updateBook, stats, locked } = useLibraryBooks();

  // Carga inicial de la biblioteca
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const {
    dragOver,
    setDragOver,
    probing,
    uploading,
    uploadPct,
    uploadPhase,
    pendingFile,
    setPendingFile,
    formTitle,
    setFormTitle,
    formAuthor,
    setFormAuthor,
    fileInputRef,
    startUploadFlow,
    confirmUpload,
  } = useBookUpload({ onUploaded: fetchBooks });
  const {
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
  } = useBookActions({ onBooksChanged: fetchBooks });

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-8">
      {/* ---- Hero de Atenea ---- */}
      {/* Móvil: identidad a todo lo ancho (sello menor, subtítulo a 2 líneas)
          y las acciones vuelan a su propia fila; en el hero ya no hay icono
          destructivo a 24px de la CTA principal (vive en el menú «⋯»). */}
      <header className="atena-hero mb-8 animate-fade-up px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-56 flex-1 items-center gap-4 sm:gap-5">
            <AtenaSeal className="seal-glow h-12 w-12 shrink-0 text-primary sm:h-16 sm:w-16" />
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Atena</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground line-clamp-2 sm:line-clamp-none">
                {t("lib.heroSubtitle")}
              </p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button size="lg" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <Plus className="h-5 w-5" /> {t("lib.addBook")}
            </Button>
            <HeroMenu onResetAll={() => setResetAllOpen(true)} />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf,application/epub+zip,.epub"
          className="hidden"
          onChange={(e) => {
            void startUploadFlow(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>

      {/* ---- Franja de hábitos ---- */}
      {/* 2×2 en pantallas angostas: las etiquetas largas («Libros terminados»)
           no caben en un cuarto de 390px y desbordaban la tarjeta */}
      <section className="mb-8 grid grid-cols-2 gap-4 animate-fade-up sm:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <StatCard icon={<Flame className="h-4.5 w-4.5 text-primary" />} label={t("lib.streak")} value={`${stats.streak} ${stats.streak === 1 ? t("lib.day1") : t("dayN")}`} hint={stats.streak > 1 ? t("lib.streakKeep") : t("lib.streakStart")} />
        <StatCard icon={<Target className="h-4.5 w-4.5 text-primary" />} label={t("lib.dailyGoal")} value={`${stats.pagesToday}/${dailyGoal} ${t("lib.pagesShort")}`} hint={stats.pagesToday >= dailyGoal ? t("lib.goalDone") : t("lib.goalLeft", { n: Math.max(0, dailyGoal - stats.pagesToday) })} />
        <StatCard icon={<Clock3 className="h-4.5 w-4.5 text-primary" />} label={t("lib.timeToday")} value={formatMinutes(stats.minutesToday)} hint={t("lib.timeHint")} />
        <StatCard icon={<Trophy className="h-4.5 w-4.5 text-primary" />} label={t("lib.finished")} value={String(stats.finished)} hint={t("lib.finishedHint", { n: books?.length ?? 0 })} />
      </section>

      {/* ---- Insignias (colección) ---- */}
      {books !== null && books.length > 0 && <BadgeShelf books={books} onOpen={onOpen} />}

      {/* ---- Zona de subida ---- */}
      <section
        className={`brutal-flat mb-8 border-dashed p-6 text-center transition-all animate-fade-up ${
          dragOver ? "border-primary bg-primary/8 scale-[1.01]" : "border-[var(--ink)]/45"
        }`}
        style={{ animationDelay: "120ms" }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void startUploadFlow(e.dataTransfer.files?.[0]);
        }}
      >
        {probing ? (
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("lib.analyzing")}
          </div>
        ) : (
          <>
            <UploadCloud className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("lib.dropPre")}<span className="text-foreground font-medium">{t("lib.dropFormats")}</span>{t("lib.dropMid")}{" "}
              <button className="text-primary underline-offset-4 hover:underline" onClick={() => fileInputRef.current?.click()}>
                {t("lib.dropChoose")}
              </button>{" "}
              {t("lib.dropPost")}
            </p>
          </>
        )}
      </section>

      {/* ---- Biblioteca ---- */}
      <section>
        {locked ? (
          <LockGate onUnlocked={fetchBooks} />
        ) : books === null ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="brutal-flat bg-card/40 px-6 py-14 text-center animate-fade-up">
            <h2 className="font-display text-2xl font-medium">{t("lib.emptyTitle")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("lib.emptyBody")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {books.map((book, idx) => (
              <BookCard
                key={book.id}
                book={book}
                segments={book.milestones ?? rail.segments}
                theme={rail.theme}
                onOpen={() => onOpen(book)}
                onDelete={() => setDeleteTarget(book)}
                onEdit={() => setEditTarget(book)}
                onReset={() => setResetTarget(book)}
                style={{ animationDelay: `${140 + idx * 50}ms` }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---- Diálogo de subida ---- */}
      <Dialog open={!!pendingFile} onOpenChange={(open) => !open && !uploading && setPendingFile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{t("lib.newBook")}</DialogTitle>
            <DialogDescription>
              {pendingFile ? t("lib.pagesDetected", { n: pendingFile.numPages }) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex gap-4">
              {pendingFile?.cover && (
                <img
                  src={pendingFile.cover}
                  alt={t("lib.coverGenerated")}
                  className="h-36 w-auto border-2 border-[var(--ink)] shadow-[3px_3px_0_0_var(--ink)]"
                />
              )}
              <div className="grid flex-1 content-center gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="book-title">{t("lib.title")}</Label>
                  <Input id="book-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder={t("lib.titlePlaceholder")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="book-author">{t("lib.authorOptional")}</Label>
                  <Input id="book-author" value={formAuthor} onChange={(e) => setFormAuthor(e.target.value)} placeholder={t("lib.authorPlaceholder")} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <div className="w-full">
              {uploading && (
                <div className="mb-3 grid gap-1.5" data-testid="upload-progress">
                  <Progress value={uploadPct} role="progressbar" aria-label={t("lib.uploadAria")} />
                  <p className="text-xs text-muted-foreground">
                    {uploadPhase === "saving"
                      ? t("lib.savingToRail")
                      : t("lib.uploadingPct", { pct: uploadPct })}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPendingFile(null)} disabled={uploading}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={() => void confirmUpload()} disabled={uploading || !formTitle.trim()} className="gap-2">
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {uploading ? t("lib.uploading") : t("lib.addToRail")}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Edición de ficha (título/autor/portada real/meta propia) ---- */}
      <EditBookDialog
        book={editTarget}
        defaultGoal={dailyGoal}
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        onSaved={(saved) =>
          updateBook({
            id: saved.id,
            title: saved.title,
            author: saved.author,
            coverPath: saved.coverPath,
            ...(saved.dailyGoal !== undefined ? { dailyGoal: saved.dailyGoal } : {}),
          })
        }
      />

      {/* ---- Confirmaciones destructivas ---- */}
      <LibraryConfirmDialogs
        deleteTarget={deleteTarget}
        onClearDelete={() => setDeleteTarget(null)}
        onConfirmDelete={() => void confirmDelete()}
        resetTarget={resetTarget}
        onClearReset={() => setResetTarget(null)}
        onConfirmReset={() => void confirmReset()}
        resettingOne={resettingOne}
        resetAllOpen={resetAllOpen}
        onResetAllOpenChange={setResetAllOpen}
        onConfirmResetAll={() => void confirmResetAll()}
        resettingAll={resettingAll}
      />
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="brutal bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span className="min-w-0 leading-snug">{label}</span>
      </div>
      <div className="font-display text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
