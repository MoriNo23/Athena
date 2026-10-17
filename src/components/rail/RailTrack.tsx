"use client";

import { cn } from "@/lib/utils";
import type { CSSProperties, RefObject } from "react";

interface RailTrackProps {
  trackRef: RefObject<HTMLDivElement | null>;
  sizeClass: string;
  interactive: boolean;
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
  fillStyle: CSSProperties;
  vertical: boolean;
  shown: number;
  compact: boolean;
  segments: number;
  totalPages: number;
  /** página visible (la del scrub durante el arrastre) */
  displayPage: number;
  pageOfBoundary: (i: number) => number;
  cursorColor: string;
}

/** Pista continua del riel: relleno + muescas de hito + perilla */
export function RailTrack({
  trackRef,
  sizeClass,
  interactive,
  handlers,
  fillStyle,
  vertical,
  shown,
  compact,
  segments,
  totalPages,
  displayPage,
  pageOfBoundary,
  cursorColor,
}: RailTrackProps) {
  return (
    <div
      ref={trackRef}
      className={cn("rail-track w-full", sizeClass, interactive && "cursor-pointer")}
      {...handlers}
    >
      <div
        className="rail-fill"
        style={{
          ...fillStyle,
          ...(vertical
            ? { bottom: 0, left: 0, right: 0, height: `${shown * 100}%` } // anclado abajo: crece hacia arriba
            : { top: 0, bottom: 0, left: 0, width: `${shown * 100}%` }),
          opacity: shown > 0.0005 ? 1 : 0,
        }}
      />
      {!compact &&
        Array.from({ length: segments - 1 }).map((_, i) => {
          const frac = (i + 1) / segments;
          const passed = displayPage >= pageOfBoundary(i + 1);
          return (
            <span
              key={i}
              className="rail-tick"
              style={{
                ...(vertical
                  ? { top: `calc(${(1 - frac) * 100}% - 1px)`, left: 0, right: 0, height: 2 } // espejado: origen abajo
                  : { left: `calc(${frac * 100}% - 1px)`, top: 0, bottom: 0, width: 2 }),
                background: passed ? "oklch(0.98 0.01 250 / 55%)" : "oklch(0.93 0.02 250 / 22%)",
              }}
              aria-hidden
            />
          );
        })}
      {!compact && totalPages > 0 && (
        <span
          className="rail-knob z-10"
          style={{
            width: 14,
            height: 14,
            border: "2px solid oklch(0.16 0.04 258)",
            background: cursorColor,
            ...(vertical
              ? { top: `calc(${(1 - shown) * 100}% - 7px)`, left: "50%", transform: "translateX(-50%)" } // perilla en el borde superior del relleno
              : { left: `calc(${shown * 100}% - 7px)`, top: "50%", transform: "translateY(-50%)" }),
          }}
          aria-hidden
        />
      )}
    </div>
  );
}

/** Etiquetas horizontales: página de cada frontera de hito */
export function RailLabels({
  segments,
  totalPages,
  displayPage,
  pageOfBoundary,
  cursorColor,
}: {
  segments: number;
  totalPages: number;
  displayPage: number;
  pageOfBoundary: (i: number) => number;
  cursorColor: string;
}) {
  return (
    <div className="relative mb-1.5 h-4">
      {Array.from({ length: segments }).map((_, i) => {
        const idx = i + 1;
        const pct = (idx / segments) * 100;
        const passed = displayPage >= pageOfBoundary(idx);
        const isLast = idx === segments;
        return (
          <span
            key={i}
            className="absolute top-0 -translate-x-1/2 text-[10px] leading-none tabular-nums"
            style={{
              left: `${pct}%`,
              color: passed ? cursorColor : "oklch(0.6 0.03 250 / 55%)",
              fontWeight: passed ? 600 : 400,
            }}
          >
            {isLast ? totalPages : pageOfBoundary(idx)}
          </span>
        );
      })}
    </div>
  );
}
