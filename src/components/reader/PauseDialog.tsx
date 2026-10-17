"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { Coffee } from "lucide-react";

interface PauseDialogProps {
  open: boolean;
  pageNum: number;
  pauseMinutes: number;
  draft: string;
  onDraftChange: (value: string) => void;
  /** abrir nunca (solo cerrar): cierre = seguir leyendo */
  onClose: () => void;
  onTake: () => void;
}

/** Diálogo de pausa en corte natural: guarda un recordatorio de dónde ibas */
export function PauseDialog({ open, pageNum, pauseMinutes, draft, onDraftChange, onClose, onTake }: PauseDialogProps) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-md" data-testid="pause-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Coffee className="h-4 w-4 text-primary" /> {t("pause.title")}
          </DialogTitle>
          <DialogDescription>
            {t("pause.desc", { minutes: Math.round(pauseMinutes), page: pageNum })}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={3}
          placeholder={t("pause.recapPh")}
          className="text-xs"
          data-testid="pause-dialog-recap"
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("pause.keepReading")}
          </Button>
          <Button size="sm" onClick={onTake} data-testid="pause-take">
            {t("pause.take")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
