"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Languages,
  Maximize,
  Minimize2,
  MoreHorizontal,
  PanelRightOpen,
  Settings2,
  Target,
} from "lucide-react";
import { useState, type RefObject } from "react";

interface ReaderHeaderProps {
  book: BookDTO;
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

/** Cabecera del lector: identidad, navegación, sync, fullscreen, zoom y hábito.
    Dos filas fijas en todos los anchos — identidad arriba, lectura abajo — sin
    la fila huérfana del wrap frágil (crítica 1440 y sociedad 390: hasta 8 filas).
    Lo de baja frecuencia (vocabulario, ajustes del riel, y en móvil el modo
    Página/Texto) vive tras el solo menú «⋯». Los toques dan el área táctil de
    44 px con .tap-44 sin agrandar el dibujo (32–36px: spec de Components). */
export function ReaderHeader({
  book,
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
  /** borrador de "ir a página": solo comitea en Enter/blur, no por tecla */
  const [draftPagina, setDraftPagina] = useState<string | null>(null);
  return (
    <header data-chrome data-chrome-kind="header" className="flex min-h-14 shrink-0 flex-col border-b border-border/60 bg-card/40 px-3 py-1.5">
      {/* Fila 1 — identidad: volver, título, (escritorio: telemetría), vista y «⋯» */}
      <div className="flex items-center gap-1">
        <Tip label={t("reader.back")}>
          <Button
            variant="ghost"
            size="icon"
            className="tap-44 h-8 w-8 shrink-0"
            onClick={onBack}
            aria-label={t("reader.back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Tip>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm font-semibold leading-tight">
            {book.title}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {book.author || "—"}
            {etaLabel && <span className="text-foreground/80"> · {etaLabel}</span>}
          </p>
        </div>

        {/* Hábito: telemetría pasiva, solo donde hay sitio. En el móvil el riel
            de la biblioteca y el dock ya lo cuentan. */}
        <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1" title={t("reader.streakTitle", { n: todayStreak })}>
            <Flame className={`h-3.5 w-3.5 ${todayStreak > 0 ? "text-primary" : ""}`} />
            {todayStreak}
          </span>
          <span className="flex items-center gap-1" title={t("reader.goalBookTitle")}>
            <Target className="h-3.5 w-3.5" />
            {pagesToday}/{dailyGoal}
          </span>
          <span className="flex items-center gap-1 tabular-nums" title={t("reader.sessionTitle")}>
            <Clock3 className="h-3.5 w-3.5" />
            {sessionMinutes}m
          </span>
        </div>

        {/* Pantalla completa: la acción de vista más útil — acento, etiqueta y sitio propio */}
        <Tip label={t("reader.fullscreen")}>
          <Button
            variant={isFullscreen ? "secondary" : "outline"}
            size="sm"
            className={cn(
              "tap-44 h-8 shrink-0 gap-1.5 text-xs font-medium",
              !isFullscreen &&
                // dark:* duplicados: sin ellos, dark:bg-input/30 y dark:hover:bg-input/50
                // del variante outline ganan en el orden de cascada de Tailwind v4.
                // El texto usa la pareja «azul sobre tinte» (--primary-on-tint):
                // el azul global no llega a AA sobre el tinte (hallazgo low-contrast).
                "border-primary/40 bg-primary/10 text-primary-on-tint shadow-none hover:border-primary/60 hover:bg-primary/20 dark:border-primary/40 dark:bg-primary/10 dark:hover:border-primary/60 dark:hover:bg-primary/20"
            )}
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? t("reader.exitFullscreen") : t("reader.fullscreen")}
            data-testid="toggle-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {isFullscreen ? t("reader.exitBtn") : t("reader.fullscreenBtn")}
            </span>
          </Button>
        </Tip>

        {/* Poco frecuente: vocabulario, ajustes del riel y — en móvil — el modo
            Página/Texto del PDF (la fila de lectura ya no da para más) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="tap-44 h-8 w-8 shrink-0"
              aria-label={t("reader.moreAria")}
              data-testid="reader-more"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {pdfMode && (
              <>
                <DropdownMenuSeparator className="sm:hidden" />
                <DropdownMenuLabel className="sm:hidden">{t("reader.modeAria")}</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onPdfModeChange?.("page")}
                  className="gap-2 sm:hidden"
                  data-testid="reader-mode-page-menu"
                >
                  {t("reader.modePage")}
                  {pdfMode === "page" && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onPdfModeChange?.("text")}
                  className="gap-2 sm:hidden"
                  data-testid="reader-mode-text-menu"
                >
                  {t("reader.modeText")}
                  {pdfMode === "text" && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator className={cn(pdfMode && "sm:hidden")} />
            <DropdownMenuItem onClick={onOpenVocabulary} className="gap-2" data-testid="open-vocabulary">
              <Languages className="h-4 w-4" />
              {t("vocab.title")}
              {vocabularyCount > 0 && (
                <span className="ml-auto tabular-nums text-muted-foreground" data-testid="vocab-count">
                  {vocabularyCount > 99 ? "99+" : vocabularyCount}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSettings} className="gap-2" data-testid="open-rail-settings">
              <Settings2 className="h-4 w-4" />
              {t("reader.railSettingsTip")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Fila 2 — lectura: navegar (izquierda) + vista y modos (derecha) */}
      <div className="mt-1 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <Tip label={t("reader.prevPage")}>
            <Button
              variant="outline"
              size="icon"
              className="tap-44 h-8 w-8"
              onClick={() => goToPage(pageNum - 1)}
              disabled={pageNum <= 1}
              aria-label={t("reader.prevPage")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Tip>
          <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1">
            <Input
              type="number"
              min={1}
              max={numPages}
              // borrador local: mientras se teclea SOLO se edita el texto; el
              // salto se comitea en Enter/blur (teclear "152" no pasa por 1 y 15)
              value={draftPagina ?? pageNum}
              onChange={(e) => setDraftPagina(e.target.value)}
              onBlur={() => {
                const v = parseInt(draftPagina ?? "", 10);
                if (Number.isFinite(v)) goToPage(v, { silent: true });
                setDraftPagina(null);
              }}
              // Enter/Escape devuelven el foco al libro: si se queda aquí dentro,
              // los atajos (flechas, zoom, H) quedan «muertos» hasta click en la página
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  const v = parseInt(draftPagina ?? "", 10);
                  if (Number.isFinite(v)) goToPage(v, { silent: true });
                  setDraftPagina(null);
                  e.currentTarget.blur();
                  document.querySelector<HTMLElement>('[data-viewport="pdf"]')?.focus({ preventScroll: true });
                }
              }}
              className="h-6 w-14 border-0 bg-transparent p-0 text-center text-sm tabular-nums focus-visible:ring-0"
              aria-label={t("reader.pageNumber")}
            />
            <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
              {t("reader.ofPages", { n: numPages })}
            </span>
          </div>
          <Tip label={t("reader.nextPage")}>
            <Button
              variant="outline"
              size="icon"
              className="tap-44 h-8 w-8"
              onClick={() => goToPage(pageNum + 1)}
              disabled={pageNum >= numPages}
              aria-label={t("reader.nextPage")}
            >
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

        <div className="flex items-center gap-1">
          {/* Modo de lectura del PDF: página tal cual o texto reflowable.
              Solo escritorio: en móvil lo lleva el menú «⋯» de arriba. */}
          {pdfMode && (
            <div
              className="hidden shrink-0 items-center rounded-md border border-border/60 bg-background/60 p-0.5 sm:flex"
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

          {/* Paneles: modos de lectura + teleprompter (icono en móvil) */}
          <Button
            variant={dockVisible ? "secondary" : "ghost"}
            size="sm"
            className="tap-44 h-8 shrink-0 gap-1.5 text-xs"
            onClick={onToggleDock}
            aria-label={dockVisible ? t("reader.closeSettings") : t("reader.openSettings")}
            data-testid="toggle-dock"
          >
            <PanelRightOpen className="h-4 w-4" />
            <span className="hidden sm:inline">{t("reader.settings")}</span>
          </Button>
          <Button
            variant={tpOpen ? "secondary" : "ghost"}
            size="sm"
            className="tap-44 h-8 shrink-0 gap-1.5 text-xs"
            onClick={onToggleTeleprompter}
            aria-label={t("reader.teleprompterAria")}
            data-testid="tp-toggle"
          >
            <BookOpenText className="h-4 w-4" />
            <span className="hidden sm:inline">{t("reader.teleprompter")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
