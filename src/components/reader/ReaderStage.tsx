"use client";

import { Button } from "@/components/ui/button";
import { DualViewport } from "@/components/reader/DualViewport";
import type { BookDTO } from "@/lib/types";
import { BookOpen, Coffee } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ReactNode } from "react";

interface ReaderStageProps {
  error: string | null;
  onBack: () => void;
  dualActive: boolean;
  book: BookDTO;
  pageNum: number;
  numPages: number;
  /** visor del libro (PdfViewport ya configurado por ReaderView) */
  viewport: ReactNode;
  pauseArmed: boolean;
  pauseDialogOpen: boolean;
  onOpenPause: () => void;
}

/** Escenario del lector: error, vista dual (libro + compañero) o visor único, más el aviso de pausa */
export function ReaderStage({
  error,
  onBack,
  dualActive,
  book,
  pageNum,
  numPages,
  viewport,
  pauseArmed,
  pauseDialogOpen,
  onOpenPause,
}: ReaderStageProps) {
  const { t } = useI18n();
  return (
    <main className="relative min-h-0 min-w-0 flex-1 bg-[var(--stage)]">
      {error ? (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={onBack}>
            {t("stage.back")}
          </Button>
        </div>
      ) : dualActive ? (
        <div className="flex h-full">
          <div className="h-full min-w-0 flex-1">{viewport}</div>
          <div className="h-full min-w-0 flex-1">
            <DualViewport
              companionPath={book.companionPath!}
              mainPage={pageNum}
              mainTotal={numPages}
              companionTotal={book.companionPages!}
            />
          </div>
        </div>
      ) : (
        viewport
      )}

      {/* Aviso sutil de pausa sugerida (espera el corte natural) */}
      {pauseArmed && !pauseDialogOpen && (
        <button
          onClick={onOpenPause}
          className="animate-fade-up absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-4 py-1.5 text-xs font-medium shadow-xl backdrop-blur transition-colors hover:border-primary"
          data-testid="pause-banner"
        >
          <Coffee className="h-3.5 w-3.5 text-primary" />
          {t("stage.pauseBanner")}
        </button>
      )}
    </main>
  );
}
