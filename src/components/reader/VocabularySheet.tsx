"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { BookOpen, Languages, Trash2 } from "lucide-react";

/** Vocabulario global: palabras guardadas desde el popover del diccionario */
export function VocabularySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const vocabulary = useSettings((s) => s.vocabulary);
  const removeVocab = useSettings((s) => s.removeVocab);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display text-xl">
            <Languages className="h-5 w-5 text-primary" /> {t("vocab.title")}
          </SheetTitle>
          <SheetDescription>
            {t("vocab.desc")}{vocabulary.length > 0 ? ` ${t("vocab.count", { n: vocabulary.length })}` : ""}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 px-4 pb-6">
          {vocabulary.length === 0 ? (
            <div className="grid gap-2 py-12 text-center text-sm text-muted-foreground">
              <Languages className="mx-auto h-8 w-8 opacity-40" />
              <p className="font-medium">{t("vocab.emptyTitle")}</p>
              <p className="text-xs">{t("vocab.emptyBody")}</p>
            </div>
          ) : (
            <ul className="grid gap-2">
              {vocabulary.map((v) => (
                <li
                  key={v.id}
                  className="group grid gap-1 rounded-lg border border-border/50 bg-card/50 p-3"
                  data-testid="vocab-entry"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium">{v.word}</span>
                      <span className="ml-1.5 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase text-primary-on-tint">
                        {v.lang}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                      onClick={() => removeVocab(v.id)}
                      aria-label={t("vocab.delete", { word: v.word })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {v.short && <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{v.short}</p>}
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                    <BookOpen className="h-3 w-3" /> {t("vocab.entryMeta", { book: v.bookTitle, n: v.page })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
