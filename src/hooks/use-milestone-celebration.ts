"use client";

import { useCallback, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import { useI18n, type Translator } from "@/lib/i18n";
import { milestonePages } from "@/lib/reading";

/** Confeti dorado de la app: grande al terminar el libro, corto en hitos */
export function fireConfetti(big = false) {
  const colors = ["#e0a94e", "#f2d49b", "#b58a3a", "#ffffff", "#8fbf9f"];
  confetti({
    particleCount: big ? 160 : 60,
    spread: big ? 100 : 60,
    startVelocity: big ? 45 : 32,
    origin: { y: 0.25 },
    colors,
    disableForReducedMotion: true,
  });
}

/** Tostada + confeti del hito alcanzado (última página = libro terminado) */
function celebrateMilestone(opts: {
  finished: boolean;
  page: number;
  numPages: number;
  segments: number;
  passedNow: number;
  bookTitle: string;
  toast: ReturnType<typeof useToast>["toast"];
  t: Translator;
}) {
  const { finished, page, numPages, segments, passedNow, bookTitle, t } = opts;
  if (finished) {
    fireConfetti(true);
    opts.toast({
      title: t("mile.finishedTitle"),
      description: t("mile.finishedBody", { title: bookTitle }),
      duration: 8000,
    });
    return;
  }
  fireConfetti(false);
  opts.toast({
    title: t("mile.milestoneTitle", { n: passedNow, m: segments }),
    description: t("mile.milestoneBody", { pct: Math.round((page / numPages) * 100), page }),
    duration: 5000,
  });
}

/**
 * Hitos del riel (individuales de este libro): alinea la marca máxima sin
 * celebrar nada retroactivo y celebra SOLO los hitos nuevos alcanzados
 * navegando de verdad (los saltos silenciosos solo alinean).
 */
export function useMilestoneCelebration(opts: {
  bookTotalPages: number;
  bookCurrentPage: number;
  numPages: number;
  segments: number;
  celebrate: boolean;
  bookTitle: string;
  onFinish: () => void;
}) {
  const { bookTotalPages, bookCurrentPage, numPages, segments, celebrate, bookTitle, onFinish } = opts;
  const { toast } = useToast();
  const { t } = useI18n();
  const maxHitRef = useRef(0);

  // Inicializar hito máximo alcanzado (no celebrar hitos ya pasados)
  useEffect(() => {
    const bounds = milestonePages(bookTotalPages, segments);
    maxHitRef.current = bounds.filter((b) => bookCurrentPage >= b).length;
  }, [bookTotalPages, bookCurrentPage, segments]);

  const commit = useCallback(
    (page: number, silent: boolean) => {
      const bounds = milestonePages(numPages, segments);
      const passedNow = bounds.filter((b) => page >= b).length;
      if (silent) {
        // alinear la marca de hitos sin celebrar nada retroactivo
        maxHitRef.current = passedNow;
        return;
      }
      // última página navegando de verdad = lectura completada (insignia)
      if (page >= numPages) onFinish();
      if (passedNow > maxHitRef.current) {
        maxHitRef.current = passedNow;
        if (celebrate) {
          celebrateMilestone({
            finished: page >= numPages,
            page,
            numPages,
            segments,
            passedNow,
            bookTitle,
            toast,
            t,
          });
        }
      }
    },
    [numPages, segments, celebrate, bookTitle, onFinish, toast, t]
  );

  return { commit };
}
