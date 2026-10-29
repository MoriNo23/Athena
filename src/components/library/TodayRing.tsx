"use client";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Anillo de «hoy» de la biblioteca (change biblioteca-feedback-hoy): el
 * avance del día SE VE, no se adivina. Tres estados con la misma pieza:
 *  - sin empezar: anillo apagado (hoy todavía no corre en este libro)
 *  - en curso: arco parcial con el par X/Y al lado
 *  - meta cumplida: anillo completo (el arco llega a 360°)
 */
export function TodayRing({
  pages,
  goal,
  size = 22,
  className,
  label,
}: {
  pages: number;
  goal: number;
  size?: number;
  className?: string;
  /** texto accesible; si falta, se genera del par páginas/meta */
  label?: string;
}) {
  const { t } = useI18n();
  const meta = Math.max(1, goal);
  const pct = Math.min(1, Math.max(0, pages / meta));
  const cumplida = pages >= meta;
  const enCurso = pages > 0 && !cumplida;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const aria = label ?? t("card.todayRingAria", { p: pages, g: meta });

  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      role="img"
      aria-label={aria}
      data-testid="today-ring"
      data-state={cumplida ? "done" : enCurso ? "progress" : "empty"}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* fondo del anillo: siempre visible, apagado */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-foreground/15"
        />
        {pages > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            className={cn("transition-[stroke-dasharray] duration-500", cumplida ? "stroke-emerald-500" : "stroke-primary")}
          />
        )}
      </svg>
    </span>
  );
}
