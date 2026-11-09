"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";

/**
 * Apartado para CONSULTAR las teclas de acceso — existe en Android y en
 * escritorio (el menú «⋯» de la biblioteca y el menú del lector lo abren).
 * El recordatorio fantasma (ShortcutGhost) solo aparece con entrada de
 * escritorio; esta hoja es la fuente de verdad para todas las plataformas.
 */
export function ShortcutsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const toggleKey = useSettings((s) => s.immersion.toggleKey);

  const lector: Array<[string, string]> = [
    ["←/→", t("ghost.reader.pages")],
    ["↑/↓", t("ghost.reader.scroll")],
    ["+/−", t("ghost.reader.zoom")],
    ["F", t("ghost.reader.fitPage")],
    ["O", t("ghost.reader.fitOptimal")],
    ["M", t("ghost.reader.fullscreen")],
  ];
  if (toggleKey) lector.push([toggleKey.toUpperCase(), t("ghost.reader.hideUi")]);

  const teleprompter: Array<[string, string]> = [
    ["→", t("ghost.tp.next")],
    ["←", t("ghost.tp.rewind")],
    ["Shift+→/←", t("ghost.tp.page")],
    ["↑", t("ghost.tp.up")],
    [t("config.keySpace"), t("ghost.tp.pause")],
    ["−/+", t("ghost.tp.font")],
    ["A", t("ghost.tp.settings")],
    ["M", t("ghost.tp.fullscreen")],
    ["Esc", t("ghost.tp.exit")],
  ];

  const fila = ([keys, accion]: [string, string]) => (
    <div key={keys} className="flex items-center justify-between gap-4 border-b border-border/40 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{accion}</span>
      <kbd className="shrink-0 rounded-none border border-border bg-card px-2 py-0.5 font-mono text-xs font-medium text-foreground shadow-[2px_2px_0_0_var(--ink)]">
        {keys}
      </kbd>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-6" data-testid="shortcuts-sheet">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-xl font-medium">{t("shortcuts.title")}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 max-h-[60vh] overflow-y-auto pr-1">
          <p className="pb-1 text-xs leading-relaxed text-muted-foreground">{t("shortcuts.note")}</p>

          <h3 className="mt-3 font-display text-sm font-medium uppercase tracking-wide text-primary">
            {t("shortcuts.reader")}
          </h3>
          <div className="mt-1">{lector.map(fila)}</div>

          <h3 className="mt-5 font-display text-sm font-medium uppercase tracking-wide text-primary">
            {t("shortcuts.teleprompter")}
          </h3>
          <div className="mt-1">{teleprompter.map(fila)}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
