"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ZOOM_TARGETS } from "@/hooks/use-zoom-preset";
import { useI18n } from "@/lib/i18n";
import { Check, Minus, Plus, ZoomIn } from "lucide-react";
import type { ZoomPresetId } from "@/lib/types";

interface ZoomControlsProps {
  effectiveScale: number;
  activeZoom: ZoomPresetId | "custom" | null;
  onZoomBy: (factor: number) => void;
  onPreset: (id: ZoomPresetId) => void;
}

/** Zoom fino: − / estado + menú de predefinidos, todos relativos al visor.
    El disparador muestra el MODO activo («Óptima», «Página»): su % es derivada
    del visor (cambia con el tamaño de ventana sin acción alguna) y ahí nunca
    conectó con el preset puesto — P1 #3, «el texto manda». */
export function ZoomControls({ effectiveScale, activeZoom, onZoomBy, onPreset }: ZoomControlsProps) {
  const { t } = useI18n();
  const named = activeZoom === "optimal" || activeZoom === "page";
  return (
    <div className="flex items-center gap-0.5">
        {/* ±: escritorio. En punto grueso la casa es la pinza del visor
            (onZoomGesture): el disparador basta y los 44 px no separan filas. */}
        <Tip label={t("zoom.minusTip")}>
          <Button variant="ghost" size="icon" className="tap-44 hidden h-8 w-8 sm:inline-flex" onClick={() => onZoomBy(1 / 1.12)} aria-label={t("zoom.minusAria")}>
            <Minus className="h-4 w-4" />
          </Button>
        </Tip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="tap-44 h-8 gap-1.5 px-2 text-xs"
              title={t("zoom.presetsTitle")}
              data-testid="zoom-menu"
            >
              <ZoomIn className="h-3.5 w-3.5" />
              {(named && activeZoom) ? <span className="hidden sm:inline">{t(`zoom.${activeZoom}Short`)}</span> : <span className="tabular-nums">{Math.round(effectiveScale * 100)}%</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-72">
            {ZOOM_TARGETS.map((z) => (
              <DropdownMenuItem
                key={z.id}
                onClick={() => onPreset(z.id)}
                className="items-start gap-2 py-2"
                data-testid={`zoom-${z.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    {t(`zoom.${z.id}`)}
                    {activeZoom === z.id ? t("zoom.activeSuffix") : ""}
                  </p>
                  <p className="text-[11px] leading-snug text-muted-foreground">{t(`zoom.${z.id}Hint`)}</p>
                </div>
                {activeZoom === z.id && <Check className="mt-0.5 h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
              {t("zoom.manualHint")}
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tip label={t("zoom.plusTip")}>
          <Button variant="ghost" size="icon" className="tap-44 hidden h-8 w-8 sm:inline-flex" onClick={() => onZoomBy(1.12)} aria-label={t("zoom.plusAria")}>
            <Plus className="h-4 w-4" />
          </Button>
        </Tip>
      </div>
  );
}

/** Tooltip de cabecera: etiqueta + atajo, aparición rápida y con estilo de la app */
export function Tip({ label, children }: { label: React.ReactNode; children: React.ReactElement }) {
  return (
    <Tooltip delayDuration={280}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
