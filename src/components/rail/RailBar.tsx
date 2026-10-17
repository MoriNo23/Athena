"use client";

import { useRailScrub } from "@/hooks/use-rail-scrub";
import { RailLabels, RailTrack } from "@/components/rail/RailTrack";
import { RailSettings, RAIL_THEMES } from "@/lib/types";
import { Milestone } from "lucide-react";
import { cn } from "@/lib/utils";

interface RailBarProps {
  totalPages: number;
  currentPage: number;
  settings: RailSettings;
  /** variante compacta para tarjetas de biblioteca */
  compact?: boolean;
  /** salto silencioso de página al hacer clic o arrastrar sobre el riel */
  onSeek?: (page: number) => void;
}

// Tema dinámico: el relleno es la rampa completa ámbar (55) → verde (150)
const hueAt = (p: number) => 55 + (150 - 55) * Math.min(1, Math.max(0, p));

export function RailBar({
  totalPages,
  currentPage,
  settings,
  compact = false,
  onSeek,
}: RailBarProps) {
  const theme = RAIL_THEMES[settings.theme] ?? RAIL_THEMES.amber;
  const isDynamic = settings.theme === "dynamic";
  const segments = Math.max(2, Math.min(40, settings.segments));
  // Semántica «páginas leídas»: pág. 1 = 0 % (riel vacío tras reiniciar) y
  // la última página = 100 % (libro terminado).
  const done = totalPages > 0 && currentPage >= totalPages;
  const progress = totalPages > 0 ? (done ? 1 : Math.min(1, Math.max(0, (currentPage - 1) / totalPages))) : 0;
  const vertical = settings.position === "left" || settings.position === "right";

  // ---------- Scrub: presionar y arrastrar sobre el riel para saltar ----------
  const { trackRef, scrubbing, scrubPage, handlers } = useRailScrub({
    totalPages,
    vertical,
    compact,
    onSeek,
  });

  // Mientras se arrastra, riel y perilla siguen el dedo (sin transición)
  const shown =
    scrubPage != null
      ? scrubPage >= totalPages
        ? 1
        : Math.min(1, Math.max(0, (scrubPage - 1) / Math.max(1, totalPages)))
      : progress;

  const cursorColor = isDynamic
    ? `oklch(0.82 0.15 ${hueAt(shown).toFixed(1)})`
    : theme.cursor;
  const fillStyle = isDynamic
    ? {
        // vertical 0deg = ámbar abajo (origen) → color actual arriba (borde que sube)
        background: `linear-gradient(${vertical ? "0deg" : "90deg"}, oklch(0.72 0.14 55), oklch(0.78 0.15 ${hueAt(shown).toFixed(1)}))`,
      }
    : { background: vertical ? theme.fillV : theme.fill };

  const pageOfBoundary = (i: number) =>
    Math.max(1, Math.min(totalPages, Math.round((i * totalPages) / segments)));

  // Página visible (la del scrub durante el arrastre): ilumina muescas/etiquetas
  // con la misma regla con la que se celebran los hitos (currentPage >= frontera)
  const displayPage = scrubbing ? Math.max(1, scrubPage ?? 1) : currentPage;

  const trackNode = (
    <RailTrack
      trackRef={trackRef}
      sizeClass={vertical ? (compact ? "w-1.5 h-full" : "w-2.5 h-full") : compact ? "h-1.5" : "h-2.5"}
      interactive={!!onSeek && !compact}
      handlers={handlers}
      fillStyle={fillStyle}
      vertical={vertical}
      shown={shown}
      compact={compact}
      segments={segments}
      totalPages={totalPages}
      displayPage={displayPage}
      pageOfBoundary={pageOfBoundary}
      cursorColor={cursorColor}
    />
  );

  const milestoneIcon = (className: string) => (
    <Milestone
      className={cn("h-4 w-4 shrink-0", progress >= 0.999 ? "text-primary" : "text-muted-foreground/50", className)}
      aria-hidden
    />
  );

  // ---------- Riel horizontal ----------
  if (!vertical) {
    return (
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalPages}
        aria-valuenow={currentPage}
        aria-label={`Progreso: página ${currentPage} de ${totalPages}`}
        className={cn("rail-main relative select-none", !scrubbing && "rail-anim")}
      >
        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            {settings.showLabels && !compact && (
              <RailLabels
                segments={segments}
                totalPages={totalPages}
                displayPage={displayPage}
                pageOfBoundary={pageOfBoundary}
                cursorColor={cursorColor}
              />
            )}
            {trackNode}
          </div>
          {/* Meta: el final del libro */}
          {!compact && milestoneIcon("")}
        </div>
      </div>
    );
  }

  // ---------- Riel vertical (left / right) ----------
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalPages}
      aria-valuenow={currentPage}
      aria-label={`Progreso: página ${currentPage} de ${totalPages}`}
      className={cn("rail-main rail-vertical relative h-full select-none", !scrubbing && "rail-anim")}
    >
      <div className="flex h-full flex-col items-center gap-2">
        {/* Meta arriba: con el llenado de abajo hacia arriba, el final del libro queda arriba */}
        {!compact && milestoneIcon("")}
        <div className="flex min-h-0 w-full flex-1 justify-center">{trackNode}</div>
      </div>
    </div>
  );
}
