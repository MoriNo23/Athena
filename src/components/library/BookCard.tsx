"use client";

import { useMemo } from "react";
import { BookOpen, FileWarning, Link2, Medal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RailBar } from "@/components/rail/RailBar";
import { TodayRing } from "@/components/library/TodayRing";
import { dayKey, estimateFinishDate, groupSessionsByDay, pickDailyRate, progressPct } from "@/lib/reading";
import { useI18n, formatDate } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { BADGE_TIERS, RailTheme } from "@/lib/types";
import type { BookWithSessions } from "@/hooks/use-library-books";

interface BookCardProps {
  book: BookWithSessions;
  segments: number;
  theme: RailTheme;
  onOpen: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReset: () => void;
  /** disponible si el fichero desapareció de la carpeta: re-vincularlo */
  onRelink?: () => void;
  style?: React.CSSProperties;
}

/** Tarjeta de libro de la biblioteca: portada, mini-riel, ritmo y acciones */
export function BookCard({ book, segments, theme, onOpen, onDelete, onEdit, onReset, onRelink, style }: BookCardProps) {
  const { t, lang } = useI18n();
  const globalGoal = useSettings((s) => s.reading.dailyGoal);
  const pct = progressPct(book);
  // EPUB/PDF de carpeta recién escaneados: páginas desconocidas hasta el primer abrir
  const sinContar = book.totalPages <= 0;
  const done = !sinContar && book.currentPage >= book.totalPages;
  const sinFichero = Boolean(book.fileMissingAt);

  const rate = useMemo(() => pickDailyRate(groupSessionsByDay(book.sessions)), [book.sessions]);
  const eta = useMemo(() => (rate ? estimateFinishDate(book, rate.pages) : null), [book, rate]);
  const tierKey = BADGE_TIERS[book.badge?.tier ?? 1]?.key ?? "bronce";
  const tierLabel = t(`badge.${tierKey}`);

  // Resumen de hoy desde las sesiones que ya viajan en el payload (sin petición extra):
  // sin actividad hoy no se pinta progreso falso.
  const today = useMemo(
    () => groupSessionsByDay(book.sessions).get(dayKey(new Date())) ?? { pages: 0, minutes: 0 },
    [book.sessions]
  );
  const effectiveGoal = book.dailyGoal ?? globalGoal;
  const hasToday = today.pages > 0 || today.minutes > 0;
  // P3: el estado de HOY se nombra, no se adivina (sin empezar / en curso /
  // meta cumplida) — el anillo da el vistazo, la frase da el número.
  const metaHoy = Math.max(1, effectiveGoal);
  const hoyCumplida = today.pages >= metaHoy;
  const hoyEnCurso = today.pages > 0 && !hoyCumplida;

  return (
    <article
      className="brutal brutal-hover group flex gap-5 bg-card p-5 animate-fade-up"
      style={style}
    >
      <button
        className="relative h-40 w-28 shrink-0 overflow-hidden border-2 border-[var(--ink)] shadow-[3px_3px_0_0_var(--ink)] transition-transform group-hover:scale-[1.03]"
        onClick={onOpen}
        aria-label={t("card.open", { title: book.title })}
      >
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={t("card.coverAlt", { title: book.title })} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {done && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/70 to-transparent pb-2">
            <span className="bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground">
              {t("card.finishedTag")}
            </span>
          </div>
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Título sin competencia: en punto grueso la fila de acciones cae
            debajo del título (siempre visibles, 44px); en el escritorio
            revela al volar y ENFOCA visible con teclado (crítica Sam). */}
        <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug">{book.title}</h3>
            <p className="truncate text-sm text-muted-foreground">{book.author || t("card.unknownAuthor")}</p>
            {(book.badge || sinFichero) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {book.badge && (
                  <span className={`badge-chip tier-${tierKey}`} data-testid="card-badge-chip">
                    <Medal className="h-3 w-3" />
                    {tierLabel} · {book.badge.readings} {book.badge.readings === 1 ? t("reading1") : t("readingsN")}
                  </span>
                )}
                {sinFichero && (
                  <span
                    className="badge-chip text-destructive"
                    data-testid="card-sinfile"
                    title={t("card.fileMissingTip")}
                  >
                    <FileWarning className="h-3 w-3" />
                    {t("card.fileMissing")}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-0.5 sm:order-last">
            {sinFichero && onRelink && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-destructive sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                onClick={onRelink}
                aria-label={t("card.relink", { title: book.title })}
                title={t("card.relinkTitle")}
                data-testid="card-relink"
              >
                <Link2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-muted-foreground transition-opacity hover:text-foreground sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              onClick={onEdit}
              aria-label={t("card.edit", { title: book.title })}
              title={t("card.editTitle")}
              data-testid="card-edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-muted-foreground transition-opacity hover:text-foreground sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              onClick={onReset}
              aria-label={t("card.reset", { title: book.title })}
              title={t("card.resetTitle")}
              data-testid="card-reset"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 text-muted-foreground transition-opacity hover:text-destructive sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              onClick={onDelete}
              aria-label={t("card.delete", { title: book.title })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <RailBar
            totalPages={book.totalPages}
            currentPage={book.currentPage}
            settings={{ position: "bottom", segments: Math.min(segments, 14), theme, showLabels: false, celebrate: false }}
            compact
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {sinContar ? t("card.pagesUnknown") : t("card.pages", { cur: book.currentPage, total: book.totalPages })}{" "}
            {!sinContar && <>· <span className="font-medium text-foreground">{pct}%</span></>}
          </span>
          {eta && !done && (
            <span className="italic">{t("card.eta", { date: formatDate(eta, lang) })}</span>
          )}
        </div>

        {(!done || hasToday) && (
          <p
            className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground"
            data-testid="card-today-summary"
          >
            <TodayRing pages={today.pages} goal={metaHoy} />
            <span className={hoyCumplida ? "font-medium text-emerald-600 dark:text-emerald-400" : undefined}>
              {hoyCumplida
                ? t("card.todayGoalMet", { p: today.pages, g: metaHoy })
                : hoyEnCurso
                  ? t("card.todayProgress", { p: today.pages, g: metaHoy, m: today.minutes })
                  : t("card.todayNone", { g: metaHoy })}
            </span>
          </p>
        )}

        <div className="mt-auto pt-3">
          <Button onClick={onOpen} className="w-full gap-2" variant={done ? "secondary" : "default"}>
            <BookOpen className="h-4 w-4" />
            {done ? t("card.reread") : book.currentPage > 1 ? t("card.continue") : t("card.start")}
          </Button>
        </div>
      </div>
    </article>
  );
}
