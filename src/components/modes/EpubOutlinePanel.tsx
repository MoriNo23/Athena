"use client";

import { ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n";
import type { EpubChapter } from "@/lib/epub";

interface EpubOutlinePanelProps {
  chapters: EpubChapter[];
  goToPage: (page: number) => void;
  currentPage: number;
}

/**
 * Esquema del EPUB: los capítulos del spine con su página virtual de inicio.
 * Es el hermano del OutlinePanel del PDF — mismo lenguaje visual, otra fuente
 * de datos (el propio libro en vez del índice interno del PDF).
 */
export function EpubOutlinePanel({ chapters, goToPage, currentPage }: EpubOutlinePanelProps) {
  const { t } = useI18n();
  if (chapters.length === 0) {
    return (
      <div className="grid gap-2 py-8 text-center text-xs text-muted-foreground" data-testid="outline-empty">
        <ListTree className="mx-auto h-6 w-6 opacity-40" />
        <p>{t("outline.epubEmpty")}</p>
        <p className="text-xs text-muted-foreground">
          {t("outline.epubEmptyHint")}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[420px] pr-2" data-testid="outline-list">
      <ul className="grid">
        {chapters.map((ch, i) => {
          const next = chapters[i + 1];
          const isCurrent = currentPage >= ch.page && (!next || currentPage < next.page);
          return (
            <li key={`${ch.title}-${ch.page}`} className="grid">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToPage(ch.page)}
                className={`h-auto justify-start gap-1.5 py-1 pr-2 text-left text-xs font-normal ${isCurrent ? "text-primary" : ""}`}
                title={t("outline.goTo", { n: ch.page })}
                data-testid={`epub-outline-${ch.page}`}
              >
                <span className="truncate">{ch.title}</span>
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">{ch.page}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
