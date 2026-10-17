"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { ModePanelProps } from "@/components/modes/panel-props";
import { Coffee, Timer } from "lucide-react";

/**
 * Pausas en cortes naturales: nunca un temporizador que te corta. La app espera
 * a que termines la página y recién ahí sugiere la pausa, con el recordatorio de
 * lo que saben tus personajes hasta ahí.
 */
export function PausesPanel({
  extras,
  onPatch,
  sessionSeconds,
}: ModePanelProps & { sessionSeconds: number }) {
  const { t } = useI18n();
  const pauseMinutes = useSettings((s) => s.modes.pauseMinutes);
  const setPauseMinutes = useSettings((s) => s.setPauseMinutes);
  const recap = extras.pause?.recap ?? "";
  const pausesTaken = extras.pause?.pausesTaken ?? 0;
  const [draft, setDraft] = useState(recap);

  const saveRecap = () => {
    if (draft !== recap) onPatch({ pause: { recap: draft, pausesTaken } });
  };

  const remaining = Math.max(0, pauseMinutes * 60 - sessionSeconds);
  const armed = remaining === 0;
  const progress = Math.min(100, (sessionSeconds / (pauseMinutes * 60)) * 100);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Timer className="h-3.5 w-3.5" /> {t("pausep.target")}
          </label>
          <span className="tabular-nums text-sm font-medium text-primary" data-testid="pause-minutes">
            {pauseMinutes} min
          </span>
        </div>
        <Slider
          value={[pauseMinutes]}
          min={10}
          max={90}
          step={5}
          onValueChange={([v]) => setPauseMinutes(v)}
          aria-label={t("pausep.targetAria")}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("pausep.targetHint", { n: pauseMinutes })}
        </p>
      </div>

      <div className="grid gap-1.5 rounded-lg border border-border/50 bg-card/40 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Coffee className="h-3.5 w-3.5" /> {t("pausep.current")}
          </span>
          <span className="tabular-nums font-medium" data-testid="pause-remaining">
            {armed ? t("pausep.waiting") : t("pausep.remaining", { n: Math.ceil(remaining / 60) })}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000"
            style={{ width: `${progress}%` }}
            data-testid="pause-progress"
          />
        </div>
        {pausesTaken > 0 && (
          <p className="text-[11px] text-muted-foreground/80">{t("pausep.taken", { n: pausesTaken })}</p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="pause-recap" className="text-xs font-medium text-muted-foreground">
          {t("pausep.recapLabel")}
        </label>
        <Textarea
          id="pause-recap"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveRecap}
          rows={4}
          placeholder={t("pausep.recapPh")}
          className="text-xs"
          data-testid="pause-recap"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-fit gap-1 text-xs text-muted-foreground"
          onClick={saveRecap}
          disabled={draft === recap}
        >
          {t("pausep.save")}
        </Button>
      </div>
    </div>
  );
}
