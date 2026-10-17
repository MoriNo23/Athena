"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { BADGE_TIERS, type BookDTO } from "@/lib/types";
import { useI18n, type Translator } from "@/lib/i18n";

interface FinishResponse {
  badge: { tier: number; readings: number; earnedAt: string } | null;
  first: boolean;
  reason?: string;
}

/** Tostadas de insignia: primera lectura vs. relectura que sube el tier */
function badgeToast(
  data: FinishResponse & { badge: NonNullable<FinishResponse["badge"]> },
  bookTitle: string,
  toast: ReturnType<typeof useToast>["toast"],
  onBookChange?: (book: BookDTO) => void,
  bookRef?: { current: BookDTO },
  t?: Translator
) {
  const tr = t ?? ((key: string) => key);
  const meta = BADGE_TIERS[data.badge.tier] ?? BADGE_TIERS[1];
  const tierLabel = tr(`badge.${meta.key}`);
  if (data.first) {
    toast({
      title: tr("fb.earnedTitle", { tier: tierLabel }),
      description: tr("fb.earnedBody", { title: bookTitle }),
      duration: 9000,
    });
  } else {
    toast({
      title: tr("fb.upgradedTitle", { tier: tierLabel }),
      description: tr("fb.upgradedBody", { n: data.badge.readings, title: bookTitle }),
      duration: 9000,
    });
  }
  onBookChange?.({
    ...(bookRef?.current ?? ({} as BookDTO)),
    finishedAt: new Date().toISOString(),
    readCount: data.badge.readings,
    badge: { tier: data.badge.tier, readings: data.badge.readings, earnedAt: data.badge.earnedAt },
  });
}

/**
 * Insignia: registro de lectura completada. Los saltos silenciosos (riel, sync,
 * peek) no cuentan: llegar a la última página debe ser navegando de verdad.
 * El cliente solo amortigua ráfagas (< 4 s); la ventana anti-duplicados
 * (< 2 min) la aplica el servidor.
 */
export function useFinishBadge(opts: {
  bookId: string;
  bookTitle: string;
  bookRef: { current: BookDTO };
  onBookChange?: (book: BookDTO) => void;
}) {
  const { bookId, bookTitle, bookRef, onBookChange } = opts;
  const { toast } = useToast();
  const { t } = useI18n();
  const lastFinishCallRef = useRef(0);

  const registerFinish = useCallback(async () => {
    const now = Date.now();
    if (now - lastFinishCallRef.current < 4000) return;
    lastFinishCallRef.current = now;
    try {
      const res = await fetch(`/api/books/${bookId}/finish`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as FinishResponse;
      if (data.reason === "missing-metadata") {
        toast({
          title: t("fb.pendingTitle"),
          description: t("fb.pendingBody"),
          duration: 10000,
        });
        return;
      }
      // "recent": lectura ya registrada hace menos de 2 min (recarga, doble
      // remontaje) — se ignora en silencio, sin tostada ni cambio de estado.
      if (!data.badge || data.reason === "recent") return;
      badgeToast(data as FinishResponse & { badge: NonNullable<FinishResponse["badge"]> }, bookTitle, toast, onBookChange, bookRef, t);
    } catch {
      // sin conexión: no interrumpe la lectura
    }
  }, [bookId, bookTitle, onBookChange, bookRef, toast, t]);

  return { registerFinish };
}
