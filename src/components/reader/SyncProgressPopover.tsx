"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { MapPin } from "lucide-react";
import type { RefObject } from "react";

interface SyncProgressPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numPages: number;
  /** página actual viva: precarga el borrador al abrir */
  currentPageRef: RefObject<number>;
  onSilentJump: (page: number) => void;
  onCancelScheduledSave: () => void;
  onFlushSave: (page: number) => void;
}

/**
 * Sincronizar progreso: lo leías en otro lado (papel, otra app, otro
 * dispositivo). Salto silencioso: no cuenta páginas leídas ni celebra hitos
 * retroactivos; alinea el riel con la página marcada.
 */
export function SyncProgressPopover({
  open,
  onOpenChange,
  numPages,
  currentPageRef,
  onSilentJump,
  onCancelScheduledSave,
  onFlushSave,
}: SyncProgressPopoverProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [syncDraft, setSyncDraft] = useState("");

  const syncProgress = () => {
    const v = parseInt(syncDraft, 10);
    if (!Number.isFinite(v)) return;
    const target = Math.min(Math.max(1, Math.round(v)), numPages);
    onCancelScheduledSave();
    onSilentJump(target);
    onFlushSave(target);
    onOpenChange(false);
    toast({
      title: t("sync.doneTitle"),
      description: t("sync.doneBody", { page: target, total: numPages }),
      duration: 5000,
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setSyncDraft(String(currentPageRef.current));
      }}
    >
      <Tooltip delayDuration={280}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("sync.openAria")}
              data-testid="sync-open"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {t("sync.tip")}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="center" className="w-72" data-testid="sync-popover">
        <div className="grid gap-2.5">
          <div>
            <p className="text-sm font-medium">{t("sync.title")}</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {t("sync.body")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={numPages}
              value={syncDraft}
              onChange={(e) => setSyncDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") syncProgress();
              }}
              className="h-8 w-24 text-center tabular-nums"
              aria-label={t("sync.inputAria")}
              data-testid="sync-input"
            />
            <span className="text-xs text-muted-foreground tabular-nums">{t("reader.ofPages", { n: numPages })}</span>
            <Button size="sm" className="ml-auto" onClick={syncProgress} data-testid="sync-apply">
              {t("sync.apply")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
