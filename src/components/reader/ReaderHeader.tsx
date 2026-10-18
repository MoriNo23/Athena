"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SyncProgressPopover } from "@/components/reader/SyncProgressPopover";
import { EpubFontControls } from "@/components/reader/EpubFontControls";
import { ReaderFontPicker } from "@/components/reader/ReaderFontPicker";
import { Tip, ZoomControls } from "@/components/reader/ZoomControls";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BookDTO, ReadingFont, ZoomPresetId } from "@/lib/types";
import {
  ArrowLeft,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Languages,
  Maximize,
  Minimize2,
  PanelRightOpen,
  Settings2,
  Target,
} from "lucide-react";
import type { RefObject } from "react";

/** Regla vertical sutil que separa grupos funcionales de la cabecera */
function VRule() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border/50" aria-hidden />;
}

interface ReaderHeaderProps {
  book: BookDTO;
  pct: number;
  numPages: number;
  pageNum: number;
  goToPage: (target: number, opts?: { silent?: boolean }) => void;
  onBack: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  effectiveScale: number;
  activeZoom: ZoomPresetId | "custom" | null;
  onZoomBy: (factor: number) => void;
  onPreset: (id: ZoomPresetId) => void;
  /** EPUB: el visor es reflowable — los controles de zoom ceden el sitio a la tipografía */
  isEpub?: boolean;
  epubFontScale?: number;
  onEpubFontDelta?: (dir: 1 | -1) => void;
  /** PDF con capa de texto: modo de lectura actual (null = sin toggle) */
  pdfMode?: "page" | "text" | null;
  onPdfModeChange?: (mode: "page" | "text") => void;
  /** EPUB: fuente de lectura elegida (store `reading.font`) */
  readerFont?: ReadingFont;
  onReaderFontChange?: (font: ReadingFont) => void;
  dockVisible: boolean;
  onToggleDock: () => void;
  /** modo cinematográfico abierto (para marcar el botón activo) */
  tpOpen: boolean;
  onToggleTeleprompter: () => void;
  vocabularyCount: number;
  onOpenVocabulary: () => void;
  todayStreak: number;
  pagesToday: number;
  dailyGoal: number;
  sessionMinutes: number;
  /** "terminas el 3 de noviembre" a ritmo real, o null si aún no hay ritmo */
  etaLabel: string | null;
  onOpenSettings: () => void;
  syncOpen: boolean;
  onSyncOpenChange: (open: boolean) => void;
  currentPageRef: RefObject<number>;
  onSilentJump: (page: number) => void;
  onCancelScheduledSave: () => void;
  onFlushSave: (page: number) => void;
}

/** Cabecera del lector: identidad, navegación, sync, fullscreen, zoom, paneles y hábito */
export function ReaderHeader({
  book,
  pct,
  numPages,
  pageNum,
  goToPage,
  onBack,
  isFullscreen,
  onToggleFullscreen,
  effectiveScale,
  activeZoom,
  onZoomBy,
  onPreset,
  isEpub = false,
  epubFontScale,
  onEpubFontDelta,
  pdfMode = null,
  onPdfModeChange,
  readerFont,
  onReaderFontChange,
  dockVisible,
  onToggleDock,
  tpOpen,
  onToggleTeleprompter,
  vocabularyCount,
  onOpenVocabulary,
  todayStreak,
  pagesToday,
  dailyGoal,
  sessionMinutes,
  etaLabel,
  onOpenSettings,
  syncOpen,
  onSyncOpenChange,
  currentPageRef,
  onSilentJump,
  onCancelScheduledSave,
  onFlushSave,
}: ReaderHeaderProps) {
  const { t } = useI18n();
  return (
    <header data-chrome data-chrome-kind="header" className="flex min-h-14 shrink-0 flex-wrap items-center gap-1 border-b border-border/60 bg-card/40 px-3">
      {/* Identidad: volver + título (uso bajo, tamaño contenido) */}
      <Tip label={t("reader.back")}>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label={t("reader.back")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Tip>
      <div className="mr-2 min-w-0">
        <h2 className="truncate font-display text-sm font-semibold leading-tight">
          {book.title}
        </h2>
        <p className="truncate text-xs text-muted-foreground">
          {book.author || "—"} · {t("reader.readPct", { pct })}
          {etaLabel && <span className="text-foreground/80"> · {etaLabel}</span>}
        </p>
      </div>

      {/* Navegación de lectura: la acción más frecuente, al centro */}
      <div className="mx-auto flex items-center gap-1">
        <Tip label={t("reader.prevPage")}>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(pageNum - 1)} disabled={pageNum <= 1} aria-label={t("reader.prevPage")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Tip>
        <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1">
          <Input
            type="number"
            min={1}
            max={numPages}
            value={pageNum}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isFinite(v)) goToPage(v, { silent: true });
            }}
            // Enter/Escape devuelven el foco al libro: si se queda aquí dentro,
            // los atajos (flechas, zoom, H) quedan «muertos» hasta click en la página
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                e.currentTarget.blur();
                document.querySelector<HTMLElement>('[data-viewport="pdf"]')?.focus({ preventScroll: true });
              }
            }}
            className="h-6 w-14 border-0 bg-transparent p-0 text-center text-sm tabular-nums focus-visible:ring-0"
            aria-label={t("reader.pageNumber")}
          />
          <span className="text-xs text-muted-foreground tabular-nums">{t("reader.ofPages", { n: numPages })}</span>
        </div>
        <Tip label={t("reader.nextPage")}>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(pageNum + 1)} disabled={pageNum >= numPages} aria-label={t("reader.nextPage")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Tip>

        {/* Sincronizar progreso: lo leía en otro lado (papel/otra app) */}
        <SyncProgressPopover
          open={syncOpen}
          onOpenChange={onSyncOpenChange}
          numPages={numPages}
          currentPageRef={currentPageRef}
          onSilentJump={onSilentJump}
          onCancelScheduledSave={onCancelScheduledSave}
          onFlushSave={onFlushSave}
        />
      </div>

      {/* Pantalla completa: la acción de vista más útil — acento, etiqueta y sitio propio */}
      <Tip label={t("reader.fullscreen")}>
        <Button
          variant={isFullscreen ? "secondary" : "outline"}
          size="sm"
          className={cn(
            "h-8 shrink-0 gap-1.5 text-xs font-medium",
            !isFullscreen &&
              // dark:* duplicados: sin ellos, dark:bg-input/30 y dark:hover:bg-input/50
              // del variante outline ganan en el orden de cascada de Tailwind v4
              "border-primary/40 bg-primary/10 text-primary shadow-none hover:border-primary/60 hover:bg-primary/20 dark:border-primary/40 dark:bg-primary/10 dark:hover:border-primary/60 dark:hover:bg-primary/20"
          )}
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? t("reader.exitFullscreen") : t("reader.fullscreen")}
          data-testid="toggle-fullscreen"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          {isFullscreen ? t("reader.exitBtn") : t("reader.fullscreenBtn")}
        </Button>
      </Tip>
      <VRule />

      {/* Modo de lectura del PDF: página tal cual o texto reflowable */}
      {pdfMode && (
        <div
          className="flex shrink-0 items-center rounded-md border border-border/60 bg-background/60 p-0.5"
          role="group"
          aria-label={t("reader.modeAria")}
        >
          <Button
            variant={pdfMode === "page" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onPdfModeChange?.("page")}
            data-testid="reader-mode-page"
          >
            {t("reader.modePage")}
          </Button>
          <Button
            variant={pdfMode === "text" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onPdfModeChange?.("text")}
            data-testid="reader-mode-text"
          >
            {t("reader.modeText")}
          </Button>
        </div>
      )}

      {/* Tipografía (EPUB o texto del PDF) o zoom fino (PDF en modo página) */}
      {isEpub || pdfMode === "text" ? (
        <div className="flex items-center gap-0.5">
          <ReaderFontPicker font={readerFont ?? "literata"} onChange={onReaderFontChange ?? (() => {})} />
          <EpubFontControls fontScale={epubFontScale ?? 1} onDelta={onEpubFontDelta ?? (() => {})} />
        </div>
      ) : (
        <ZoomControls effectiveScale={effectiveScale} activeZoom={activeZoom} onZoomBy={onZoomBy} onPreset={onPreset} />
      )}
      <VRule />

      {/* Paneles: ajustes de lectura + vocabulario */}
      <div className="flex items-center gap-1">
        <Button
          variant={dockVisible ? "secondary" : "ghost"}
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          onClick={onToggleDock}
          aria-label={dockVisible ? t("reader.closeSettings") : t("reader.openSettings")}
          data-testid="toggle-dock"
        >
          <PanelRightOpen className="h-4 w-4" />
          {t("reader.settings")}
        </Button>
        <Button
          variant={tpOpen ? "secondary" : "ghost"}
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          onClick={onToggleTeleprompter}
          aria-label={t("reader.teleprompterAria")}
          data-testid="tp-toggle"
        >
          <BookOpenText className="h-4 w-4" />
          {t("reader.teleprompter")}
        </Button>
        <Tip label={t("reader.vocabTip")}>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 shrink-0"
            onClick={onOpenVocabulary}
            aria-label={t("reader.vocabAria")}
            data-testid="open-vocabulary"
          >
            <Languages className="h-4 w-4" />
            {vocabularyCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground tabular-nums"
                data-testid="vocab-count"
              >
                {vocabularyCount > 99 ? "99+" : vocabularyCount}
              </span>
            )}
          </Button>
        </Tip>
      </div>

      <VRule />

      {/* Hábito: información pasiva, sin competir con las acciones */}
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1" title={t("reader.streakTitle", { n: todayStreak })}>
          <Flame className={`h-3.5 w-3.5 ${todayStreak > 0 ? "text-primary" : ""}`} />
          {todayStreak}
        </span>
        <span className="flex items-center gap-1" title={t("reader.goalTitle")}>
          <Target className="h-3.5 w-3.5" />
          {pagesToday}/{dailyGoal}
        </span>
        <span className="flex items-center gap-1 tabular-nums" title={t("reader.sessionTitle")}>
          <Clock3 className="h-3.5 w-3.5" />
          {sessionMinutes}m
        </span>
      </div>

      <Tip label={t("reader.railSettingsTip")}>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onOpenSettings} aria-label={t("reader.railSettingsAria")}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </Tip>
    </header>
  );
}
