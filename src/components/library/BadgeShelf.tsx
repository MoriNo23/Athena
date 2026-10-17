"use client";

import { useMemo } from "react";
import { Medal, Trophy } from "lucide-react";
import { BookDTO, BADGE_TIERS } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface BadgeShelfProps {
  books: BookDTO[];
  onOpen: (book: BookDTO) => void;
}


/**
 * Estantería de la colección: un medallón por libro terminado.
 * La portada real del libro es el rostro de la insignia; el marco y el brillo
 * muestran su tier (Bronce → Plata → Oro → Diamante) según las relecturas.
 */
export function BadgeShelf({ books, onOpen }: BadgeShelfProps) {
  const { t } = useI18n();
  const badges = useMemo(
    () =>
      books
        .filter((b) => b.badge)
        .sort((a, b) => b.badge!.tier - a.badge!.tier || b.badge!.readings - a.badge!.readings),
    [books]
  );

  const summary = useMemo(() => {
    if (badges.length === 0) return null;
    const top = badges[0].badge!.tier;
    return `${badges.length} ${badges.length === 1 ? t("shelf.badge1") : t("shelf.badgesN")}${
      top >= 3 ? t("shelf.goldOrBetter", { n: badges.filter((b) => b.badge!.tier >= 3).length }) : ""
    }`;
  }, [badges, t]);

  return (
    <section className="mb-8 animate-fade-up" style={{ animationDelay: "90ms" }} data-testid="badge-shelf">
      <div className="mb-3 flex items-baseline gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
          <Trophy className="h-4 w-4 text-primary" />
        </div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{t("shelf.title")}</h2>
        <span className="text-xs text-muted-foreground">
          {summary ?? t("shelf.emptySummary")}
        </span>
      </div>

      {badges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-5 py-6 text-sm leading-relaxed text-muted-foreground">
          {t("shelf.emptyBody")}
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 rounded-xl border border-border/60 bg-card/40 p-5">
          {badges.map((b) => {
            const tier = b.badge!.tier;
            const meta = BADGE_TIERS[tier] ?? BADGE_TIERS[1];
            const tierLabel = t(`badge.${meta.key}`);
            const nextTier =
              tier === 1 ? t("shelf.nextBronce") : tier === 2 ? t("shelf.nextPlata") : tier === 3 ? t("shelf.nextOro") : t("shelf.maxTier");
            return (
              <button
                key={b.badge ? b.id : b.id}
                onClick={() => onOpen(b)}
                className="group flex w-28 flex-col items-center gap-2 rounded-lg p-2 text-center transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={t("shelf.open", { title: b.title, tier: tierLabel })}
                data-testid="badge-item"
              >
                <div className={`badge-frame tier-${meta.key} h-20 w-20 transition-transform group-hover:scale-105`}>
                  {b.coverPath ? (
                    <img src={b.coverPath} alt={t("shelf.badgeAlt", { title: b.title })} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-secondary">
                      <Medal className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium" title={b.title}>
                    {b.title}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {tierLabel} · {b.badge!.readings} {b.badge!.readings === 1 ? t("reading1") : t("readingsN")}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">{nextTier}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
