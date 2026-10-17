"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookCopy, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { ModePanelProps } from "@/components/modes/panel-props";
import { probePdf } from "@/lib/pdf-client";
import type { BookDTO } from "@/lib/types";

interface DualPanelProps extends ModePanelProps {
  book: BookDTO;
  /** sincroniza el libro con la raíz (companionPath) */
  onBookChange?: (book: BookDTO) => void;
}

/** Dos traducciones a la vez: sube el PDF compañero y se alinea por progreso */
export function DualPanel({ book, onBookChange, numPages }: DualPanelProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const hasCompanion = !!book.companionPath;

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const probe = await probePdf(file);
      const form = new FormData();
      form.append("file", file);
      form.append("pages", String(probe.numPages));
      const res = await fetch(`/api/books/${book.id}/companion`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.book) throw new Error(data.error ?? "error");
      onBookChange?.({ ...book, companionPath: data.book.companionPath, companionPages: data.book.companionPages });
      toast({
        title: t("dual.syncedTitle"),
        description: t("dual.syncedBody", { name: file.name, n: probe.numPages, m: numPages }),
        duration: 4500,
      });
    } catch (e) {
      console.error(e);
      toast({ title: t("dual.uploadFail"), description: e instanceof Error ? e.message : undefined, duration: 4000 });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeCompanion = async () => {
    try {
      const res = await fetch(`/api/books/${book.id}/companion`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "error");
      onBookChange?.({ ...book, companionPath: null, companionPages: null });
      toast({ title: t("dual.removed"), duration: 2500 });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="grid gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("dual.hint")}
      </p>

      {!hasCompanion ? (
        <div className="grid gap-2 rounded-lg border border-dashed border-border/50 bg-card/30 p-4 text-center" data-testid="dual-upload-zone">
          <BookCopy className="mx-auto h-6 w-6 text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground">
            {t("dual.uploadHint")}
          </p>
          <Input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
            aria-label={t("dual.fileAria")}
          />
          <Button
            size="sm"
            variant="outline"
            className="mx-auto h-7 gap-1.5 text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookCopy className="h-3.5 w-3.5" />}
            {uploading ? t("lib.uploading") : t("dual.choose")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-2 rounded-lg border border-border/50 bg-card/40 p-3" data-testid="dual-active">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{t("dual.activeTitle")}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("dual.activeInfo", { n: book.companionPages ?? 0, m: numPages })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={removeCompanion}
              aria-label={t("dual.removeAria")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            {t("dual.howHint")}
          </p>
        </div>
      )}
    </div>
  );
}
