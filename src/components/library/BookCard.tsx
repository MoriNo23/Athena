"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { RailBar } from "@/components/rail/RailBar";
import { estimateFinishDate, groupSessionsByDay, pickDailyRate, progressPct } from "@/lib/reading";
import { useI18n, formatDate } from "@/lib/i18n";
import { BADGE_TIERS, RailTheme } from "@/lib/types";
import type { BookWithSessions } from "@/hooks/use-library-books";
import { BookOpen, Medal, Pencil, RotateCcw, Trash2 } from "lucide-react";

interface BookCardProps {
  book: BookWithSessions;
  segments: number;
  theme: RailTheme;
  onOpen: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReset: () => void;
  style?: React.CSSProperties;
}

/** Tarjeta de libro de la biblioteca: portada, mini-riel, ritmo y acciones */
export function BookCard({ book, segments, theme, onOpen, onDelete, onEdit, onReset, style }: BookCardProps) {
  const { t, lang } = useI18n();
  const pct = progressPct(book);
  const done = book.currentPage >= book.totalPages;

  const rate = useMemo(() => pickDailyRate(groupSessionsByDay(book.sessions)), [book.sessions]);
  const eta = useMemo(() => (rate ? estimateFinishDate(book, rate.pages) : null), [book, rate]);
  const tierKey = BADGE_TIERS[book.badge?.tier ?? 1]?.key ?? "bronce";
  const tierLabel = t(`badge.${tierKey}`);

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
        {book.coverPath ? (
          <img src={book.coverPath} alt={t("card.coverAlt", { title: book.title })} className="h-full w-full object-cover" />
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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold leading-snug">{book.title}</h3>
            <p className="truncate text-sm text-muted-foreground">{book.author || t("card.unknownAuthor")}</p>
            {book.badge && (
              <span className={`badge-chip tier-${tierKey} mt-1.5`} data-testid="card-badge-chip">
                <Medal className="h-3 w-3" />
                {tierLabel} · {book.badge.readings} {book.badge.readings === 1 ? t("reading1") : t("readingsN")}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
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
              className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
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
              className="h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
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
            {t("card.pages", { cur: book.currentPage, total: book.totalPages })} · <span className="font-medium text-foreground">{pct}%</span>
          </span>
          {eta && !done && (
            <span className="italic">{t("card.eta", { date: formatDate(eta, lang) })}</span>
          )}
        </div>

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
