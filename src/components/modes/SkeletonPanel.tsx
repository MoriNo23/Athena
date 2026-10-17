"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ModePanelProps } from "@/components/modes/panel-props";
import { useI18n, localeOf } from "@/lib/i18n";
import { ScrollText, Wand2 } from "lucide-react";

/**
 * Esqueleto argumental + predicción: antes de llegar a la conclusión escribes
 * qué crees que va a defender el autor; al terminar, tu predicción queda al lado
 * de la conclusión real, sin juzgar cuál tiene razón.
 */
export function SkeletonPanel({ extras, onPatch, pageNum, numPages }: ModePanelProps) {
  const { t, lang } = useI18n();
  const prediction = extras.prediction;
  const conclusion = extras.conclusion;
  const [predDraft, setPredDraft] = useState(prediction?.text ?? "");
  const [conclDraft, setConclDraft] = useState(conclusion?.text ?? "");

  const finished = pageNum >= numPages;
  const nearEnd = pageNum / numPages >= 0.75;

  const savePrediction = () => {
    if (!predDraft.trim()) return;
    onPatch({ prediction: { text: predDraft.trim(), savedAt: new Date().toISOString() } });
  };

  const saveConclusion = () => {
    if (!conclDraft.trim()) return;
    onPatch({ conclusion: { text: conclDraft.trim(), savedAt: new Date().toISOString() } });
  };

  const bothDone = !!prediction?.text && !!conclusion?.text;

  return (
    <div className="grid gap-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("skel.hint")}
      </p>

      {/* --- Predicción --- */}
      <div className="grid gap-2 rounded-lg border border-border/50 bg-card/40 p-3" data-testid="prediction-box">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="prediction-input" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Wand2 className="h-3.5 w-3.5 text-primary" /> {t("skel.predLabel")}
          </label>
          {prediction?.text && <Badge variant="secondary" className="text-[10px]">{t("skel.saved")}</Badge>}
        </div>
        <Textarea
          id="prediction-input"
          value={predDraft}
          onChange={(e) => setPredDraft(e.target.value)}
          rows={3}
          placeholder={t("skel.predPh")}
          className="text-xs"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {prediction?.savedAt
              ? t("skel.savedOn", { date: new Date(prediction.savedAt).toLocaleDateString(localeOf(lang)) })
              : nearEnd
                ? t("skel.nearEnd")
                : t("skel.anytime")}
          </span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={savePrediction} disabled={!predDraft.trim() || predDraft.trim() === prediction?.text}>
            {t("skel.savePred")}
          </Button>
        </div>
      </div>

      {/* --- Comparación al terminar --- */}
      {bothDone ? (
        <div className="grid gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3" data-testid="prediction-compare">
          <div className="grid gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{t("skel.yourPred")}</p>
            <p className="text-xs leading-relaxed text-foreground/90">{prediction?.text}</p>
          </div>
          <div className="border-t border-border/40 pt-2">
            <div className="grid gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">{t("skel.authorConcl")}</p>
              <p className="text-xs leading-relaxed text-foreground/90">{conclusion?.text}</p>
            </div>
          </div>
          <p className="text-[11px] italic text-muted-foreground">
            {t("skel.noJudge")}
          </p>
        </div>
      ) : (
        <div className="grid gap-2 rounded-lg border border-border/50 bg-card/40 p-3" data-testid="conclusion-box">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="conclusion-input" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ScrollText className="h-3.5 w-3.5 text-primary" /> {t("skel.conclLabel")}
            </label>
            {!finished && !conclusion?.text && (
              <span className="text-[10px] text-muted-foreground/70">{t("skel.readPct", { n: Math.round((pageNum / numPages) * 100) })}</span>
            )}
          </div>
          {conclusion?.text ? (
            <p className="text-xs leading-relaxed text-foreground/90">{conclusion.text}</p>
          ) : (
            <>
              <Textarea
                id="conclusion-input"
                value={conclDraft}
                onChange={(e) => setConclDraft(e.target.value)}
                rows={3}
                placeholder={finished ? t("skel.conclPhDone") : t("skel.conclPh")}
                className="text-xs"
              />
              <Button size="sm" variant="outline" className="h-7 w-fit text-xs" onClick={saveConclusion} disabled={!conclDraft.trim()}>
                {t("skel.saveConcl")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
