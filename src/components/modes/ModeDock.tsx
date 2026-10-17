"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Layers3,
  ListTree,
  UsersRound,
  Coffee,
  GitBranch,
  Lock,
  BookCopy,
  Settings2,
  PanelRightClose,
} from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { MODE_TOGGLE_META, ModeToggleKey, BookDTO, BookExtras } from "@/lib/types";
import { ModePanelProps } from "@/components/modes/panel-props";
import { XrayPanel } from "@/components/modes/XrayPanel";
import { PausesPanel } from "@/components/modes/PausesPanel";
import { SkeletonPanel } from "@/components/modes/SkeletonPanel";
import { LockedNotesPanel } from "@/components/modes/LockedNotesPanel";
import { DualPanel } from "@/components/modes/DualPanel";
import { OutlinePanel } from "@/components/modes/OutlinePanel";
import { EpubOutlinePanel } from "@/components/modes/EpubOutlinePanel";
import type { EpubChapter } from "@/lib/epub";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** Icono por subfeature (la casa es literatura); la etiqueta de pestaña vive en i18n */
const TOGGLE_UI: Record<ModeToggleKey, { icon: React.ComponentType<{ className?: string }> }> = {
  xray: { icon: UsersRound },
  naturalPauses: { icon: Coffee },
  argumentSkeleton: { icon: GitBranch },
  lockedNotes: { icon: Lock },
  dualRead: { icon: BookCopy },
  outline: { icon: ListTree },
  dictionary: { icon: BookCopy },
};

// dictionary no tiene pestaña propia: su toggle vive en las opciones y el popover
// aparece directamente al seleccionar palabras en el PDF.

interface ModeDockProps extends ModePanelProps {
  book: BookDTO;
  onBookChange?: (book: BookDTO) => void;
  doc: PDFDocumentProxy | null;
  /** EPUB: capítulos del spine con su página virtual (sustituye al outline del PDF) */
  epubChapters?: EpubChapter[];
  sessionSeconds: number;
  onClose: () => void;
}

/**
 * Ajustes de lectura: el panel de la casa literatura. Sin presets que
 * elegir — cada subfeature se enciende o apaga con su interruptor y las
 * activas viven en pestañas. Muchas opciones, cero ceremonia.
 */
export function ModeDock({
  book,
  onBookChange,
  extras,
  onPatch,
  goToPage,
  pageNum,
  numPages,
  doc,
  epubChapters,
  sessionSeconds,
  onClose,
}: ModeDockProps) {
  const modes = useSettings((s) => s.modes);
  const toggleMode = useSettings((s) => s.toggleMode);
  const { t } = useI18n();

  const activeKeys = useMemo(
    () => (Object.keys(MODE_TOGGLE_META) as ModeToggleKey[]).filter((k) => modes.toggles[k] && k !== "dictionary"),
    [modes.toggles]
  );

  const defaultTab = activeKeys[0] ?? "outline";

  return (
    <aside
      className="flex w-[352px] shrink-0 flex-col border-l-2 border-[var(--ink)] bg-card"
      data-dock="modes"
      data-testid="mode-dock"
      aria-label={t("dock.title")}
    >
      {/* Cabecera: opciones + cierre */}
      <div className="border-b-2 border-[var(--ink)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold tracking-wide">{t("dock.title")}</h3>
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("dock.optionsAria")} title={t("dock.optionsTitle")}>
                  <Settings2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-80 p-3" data-testid="mode-options">
                <div className="grid gap-2.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("dock.allOptional")}
                  </p>
                  {(Object.keys(MODE_TOGGLE_META) as ModeToggleKey[]).map((key) => {
                    const meta = MODE_TOGGLE_META[key];
                    return (
                      <div key={key} className="flex items-start justify-between gap-2" data-testid={`mode-toggle-${key}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium leading-tight">{t(`mode.${key}.label`)}</p>
                          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t(`mode.${key}.hint`)}</p>
                        </div>
                        <Switch
                          checked={modes.toggles[key]}
                          onCheckedChange={() => toggleMode(key)}
                          className="mt-0.5 shrink-0"
                          aria-label={t(`mode.${key}.label`)}
                        />
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label={t("dock.closeAria")} title={t("dock.closeTitle")}>
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground" data-testid="mode-tagline">
          {t("dock.tagline")}
        </p>
      </div>

      {/* Pestañas de paneles activos */}
      {activeKeys.length === 0 ? (
        <div className="grid flex-1 place-content-center gap-2 p-8 text-center text-xs text-muted-foreground">
          <Layers3 className="mx-auto h-7 w-7 opacity-40" />
          <p className="font-medium">{t("dock.noneActive")}</p>
          <p>{t("dock.openOptions")}</p>
        </div>
      ) : (
        <TooltipProvider delayDuration={300}>
          <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="border-b border-border/60 px-2 pt-2">
              <TabsList className="h-8 w-full justify-start overflow-x-auto rounded-none bg-transparent p-0">
                {activeKeys.map((key) => {
                  const ui = TOGGLE_UI[key];
                  const Icon = ui.icon;
                  return (
                    <TabsTrigger
                      key={key}
                      value={key}
                      className="gap-1.5 rounded-t-md px-2.5 py-1.5 text-[11px] data-[state=active]:bg-card data-[state=active]:shadow-none"
                      title={t(`mode.${key}.label`)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t(`dock.tab.${key}`)}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {activeKeys.map((key) => (
                <TabsContent key={key} value={key} className="mt-0">
                  {key === "xray" && <XrayPanel extras={extras} onPatch={onPatch} goToPage={goToPage} pageNum={pageNum} numPages={numPages} />}
                  {key === "naturalPauses" && <PausesPanel extras={extras} onPatch={onPatch} goToPage={goToPage} pageNum={pageNum} numPages={numPages} sessionSeconds={sessionSeconds} />}
                  {key === "argumentSkeleton" && <SkeletonPanel extras={extras} onPatch={onPatch} goToPage={goToPage} pageNum={pageNum} numPages={numPages} />}
                  {key === "lockedNotes" && <LockedNotesPanel extras={extras} onPatch={onPatch} goToPage={goToPage} pageNum={pageNum} numPages={numPages} />}
                  {key === "dualRead" && <DualPanel extras={extras} onPatch={onPatch} goToPage={goToPage} pageNum={pageNum} numPages={numPages} book={book} onBookChange={onBookChange} />}
                  {key === "outline" &&
                    (epubChapters ? (
                      <EpubOutlinePanel chapters={epubChapters} goToPage={goToPage} currentPage={pageNum} />
                    ) : (
                      <OutlinePanel doc={doc} goToPage={goToPage} currentPage={pageNum} />
                    ))}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </TooltipProvider>
      )}
    </aside>
  );
}
