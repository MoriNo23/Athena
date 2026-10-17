"use client";

import type { OcrLang, OcrPageResult } from "@/lib/ocr";
import { Check, Copy, Eye, EyeOff, Loader2, ScanText, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface OcrOverlayProps {
  ocrActive: {
    status: "idle" | "working" | "error";
    error: string | null;
    progress: number;
    phase: string;
  } | null;
  ocrResult: OcrPageResult | null;
  ocrWorking: boolean;
  pageHasText: boolean | null;
  ocrLang: OcrLang;
  showOcrText: boolean;
  ocrCopied: boolean;
  onStart: () => void;
  onSwitchLang: (lang: OcrLang) => void;
  onCopy: () => void;
  onToggleText: () => void;
  onHide: () => void;
}

/**
 * Capa OCR sobre la página: palabras reconocidas posicionadas, botón lanzador
 * (solo en escaneos), progreso, toolbar (idioma/copy/texto/ocultar) y panel de
 * texto limpio. Presentación pura: toda la lógica vive en useOcrPage.
 */
export function OcrOverlay({
  ocrActive,
  ocrResult,
  ocrWorking,
  pageHasText,
  ocrLang,
  showOcrText,
  ocrCopied,
  onStart,
  onSwitchLang,
  onCopy,
  onToggleText,
  onHide,
}: OcrOverlayProps) {
  const { t } = useI18n();
  return (
    <>
      {/* ---- OCR de páginas escaneadas: palabras reconocidas sobre la imagen ---- */}
      {ocrResult && (
        <div
          className="ocrLayer"
          data-testid="ocr-layer"
          style={{ fontSize: `${ocrResult.width / 100}px` }}
        >
          {ocrResult.words.map((w, i) => {
            const leftPct = (w.x0 / ocrResult.width) * 100;
            const topPct = (w.y0 / ocrResult.height) * 100;
            const wPct = ((w.x1 - w.x0) / ocrResult.width) * 100;
            const hPct = ((w.y1 - w.y0) / ocrResult.height) * 100;
            return (
              <span
                key={i}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${wPct}%`,
                  height: `${hPct}%`,
                  fontSize: `${hPct * 0.8}em`,
                }}
                data-conf={w.conf >= 65 ? "high" : "low"}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      )}

      {/* Botón OCR: solo en páginas sin texto digital (escaneos) */}
      {pageHasText === false && !ocrResult && !ocrWorking && (
        <div className="absolute bottom-3 right-3 z-[4] flex flex-col items-end gap-1.5">
          {ocrActive?.status === "error" && ocrActive.error && (
            <p
              className="max-w-[260px] rounded-md border border-border/60 bg-card/95 px-2.5 py-1.5 text-right text-[11px] leading-snug text-muted-foreground shadow-lg backdrop-blur"
              data-testid="ocr-error"
            >
              {ocrActive.error}
            </p>
          )}
          <button
            onClick={onStart}
            disabled={ocrWorking}
            className="flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-card/95 px-3 text-xs font-semibold shadow-xl backdrop-blur transition-colors hover:border-primary disabled:opacity-60"
            title={t("ocr.launchTip")}
            data-testid="ocr-launch"
          >
            <ScanText className="h-3.5 w-3.5 text-primary" />
            OCR
          </button>
        </div>
      )}

      {/* Progreso del OCR */}
      {ocrWorking && (
        <div
          className="absolute left-1/2 top-3 z-[4] w-60 -translate-x-1/2 rounded-lg border border-border/60 bg-card/95 px-3 py-2 shadow-xl backdrop-blur"
          data-testid="ocr-progress"
        >
          <div className="flex items-center gap-2 text-[11px] font-medium">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
            <span className="min-w-0 flex-1 truncate">{ocrActive?.phase ?? ""}</span>
            <span className="tabular-nums text-muted-foreground">
              {Math.round((ocrActive?.progress ?? 0) * 100)}%
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${Math.max(3, (ocrActive?.progress ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Barra de herramientas de la capa OCR */}
      {ocrResult && !ocrWorking && (
        <div
          className="absolute right-2 top-2 z-[4] flex items-center gap-0.5 rounded-full border border-border/60 bg-card/95 px-1.5 py-1 shadow-xl backdrop-blur"
          data-testid="ocr-toolbar"
        >
          <span
            className="mr-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary tabular-nums"
            title={t("ocr.confidenceTip")}
          >
            OCR {ocrResult.avgConf}%
          </span>
          {(["spa", "eng"] as const).map((l) => (
            <button
              key={l}
              onClick={() => onSwitchLang(l)}
              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase transition-colors ${
                ocrLang === l
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={ocrLang === l}
              title={l === "spa" ? t("ocr.langEspa") : t("ocr.langEng")}
            >
              {l}
            </button>
          ))}
          <button
            onClick={onCopy}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={ocrCopied ? t("ocr.copied") : t("ocr.copyTip")}
            data-testid="ocr-copy"
          >
            {ocrCopied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onToggleText}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${
              showOcrText ? "bg-secondary text-foreground" : ""
            }`}
            title={showOcrText ? t("ocr.hideText") : t("ocr.showText")}
            data-testid="ocr-text-toggle"
          >
            {showOcrText ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onHide}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={t("ocr.hideLayer")}
            data-testid="ocr-hide"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Panel de texto limpio reconocido */}
      {ocrResult && showOcrText && !ocrWorking && (
        <div
          className="absolute left-2 top-11 z-[4] flex max-h-[calc(100%-3.5rem)] w-72 flex-col overflow-hidden rounded-lg border border-border/60 bg-popover/95 shadow-2xl backdrop-blur"
          data-testid="ocr-text"
        >
          <div className="flex-1 overflow-y-auto px-3 py-2.5">
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-popover-foreground">
              {ocrResult.text || t("ocr.noText")}
            </p>
          </div>
          <div className="border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
            {t("ocr.wordsFooter", { n: ocrResult.words.length })}
          </div>
        </div>
      )}
    </>
  );
}
