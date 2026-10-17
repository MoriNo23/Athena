"use client";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/reader/ZoomControls";
import { useI18n } from "@/lib/i18n";
import { clampVnFontScale, VN_FONT_MAX, VN_FONT_MIN, VN_FONT_STEP } from "@/lib/types";

interface EpubFontControlsProps {
  /** multiplicador global de tamaño de letra del lector */
  fontScale: number;
  /** paso de tamaño (±1 = ±VN_FONT_STEP) */
  onDelta: (dir: 1 | -1) => void;
}

/**
 * Tipografía del EPUB: en un libro reflowable el «zoom» es el tamaño de la
 * letra. Mismo multiplicador global que el modo novela (A−/A+), así la casa
 * tiene UNA preferencia de lectura, no dos.
 */
export function EpubFontControls({ fontScale, onDelta }: EpubFontControlsProps) {
  const { t } = useI18n();
  const scale = clampVnFontScale(fontScale);
  return (
    <div className="flex items-center gap-0.5" data-testid="epub-font-group">
      <Tip label={t("epub.fontMinusTip")}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 font-display"
          onClick={() => onDelta(-1)}
          disabled={scale <= VN_FONT_MIN}
          aria-label={t("epub.fontMinusAria")}
          data-testid="epub-font-minus"
        >
          <span aria-hidden>A−</span>
        </Button>
      </Tip>
      <span className="min-w-[3.25rem] px-1 text-center text-xs tabular-nums text-muted-foreground" data-testid="epub-font-scale">
        {Math.round(scale * 100)}%
      </span>
      <Tip label={t("epub.fontPlusTip")}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 font-display"
          onClick={() => onDelta(1)}
          disabled={scale >= VN_FONT_MAX}
          aria-label={t("epub.fontPlusAria")}
          data-testid="epub-font-plus"
        >
          <span aria-hidden>A+</span>
        </Button>
      </Tip>
      <span className="sr-only">{t("epub.fontStepSr", { pct: Math.round(VN_FONT_STEP * 100) })}</span>
    </div>
  );
}
