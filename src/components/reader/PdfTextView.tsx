"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { reflowFilterCss, useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import type { PdfTextIndex } from "@/lib/pdf-text";
import { TextBlocks } from "@/components/reader/TextBlocks";
import { useTheme } from "next-themes";
import { animarGiroPagina } from "@/lib/utils";

interface PdfTextViewProps {
  /** índice del texto ya extraído (null mientras no hay nada paginable) */
  index: PdfTextIndex | null;
  /** página virtual actual (1-based, mismo contrato que el EPUB) */
  virtualPage: number;
  /** página real pedida por el riel que aún no se puede mostrar (espera con indicador) */
  waitingReal: number | null;
  /** aviso de página real sin texto extraíble (el flujo sigue en la siguiente) */
  notice?: string | null;
  /** páginas reales extraídas */
  ready: number;
  /** páginas reales del libro */
  total: number;
  /** multiplicador global de tamaño de letra del lector (A−/A+) */
  fontScale: number;
  /** Ctrl+rueda y teclas +/− ajustan la letra en vez del zoom */
  onFontDelta: (dir: 1 | -1) => void;
}

/**
 * Modo texto del PDF: la página real extraída se reflowa a páginas virtuales
 * (~320 palabras) con la misma superficie que el EPUB (tokens, fuente, filtros
 * anti-fatiga). Reutiliza data-viewport="pdf" para atajos, salto de ↑/↓,
 * rueda y selección de palabras del diccionario.
 */
export function PdfTextView({
  index,
  virtualPage,
  waitingReal,
  notice,
  ready,
  total,
  fontScale,
  onFontDelta,
}: PdfTextViewProps) {
  const filters = useSettings((s) => s.filters);
  const wheelBoost = useSettings((s) => s.reading.wheelBoost);
  const { t } = useI18n();
  const cssFilter = reflowFilterCss(filters);
  const warmth = filters.warmth;
  const { resolvedTheme } = useTheme();
  const oscuro = resolvedTheme !== "light";
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Foco inicial del visor (mismo contrato que PdfViewport/EpubViewport) ----
  useEffect(() => {
    if (waitingReal !== null || !index) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    containerRef.current?.focus({ preventScroll: true });
  }, [index, waitingReal]);

  // ---- Cambio de página virtual: volver al inicio del texto ----

  // ---- Cambio de página virtual: fundido corto (mismo contrato que EPUB) ----
  const pageRef = useRef<HTMLDivElement>(null);
  const primeraPaginaRef = useRef(false);
  const giroPrevioRef = useRef<number | null>(null);
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const previo = giroPrevioRef.current;
    giroPrevioRef.current = virtualPage;
    if (!primeraPaginaRef.current) {
      primeraPaginaRef.current = true;
      return;
    }
    const direccion: 1 | -1 = previo !== null && virtualPage < previo ? -1 : 1;
    animarGiroPagina(el, oscuro, direccion);
  }, [virtualPage, oscuro]);
  const prevPageRef = useRef<number | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    const prev = prevPageRef.current;
    prevPageRef.current = virtualPage;
    if (!el || prev === null || prev === virtualPage) return;
    // Reset INSTANTÁNEO: el desliz de entrada es el único movimiento del giro;
    // la subida suave competía con él (dos movimientos a la vez).
    el.scrollTop = 0;
  }, [virtualPage]);

  // ---- Rueda: Ctrl = tamaño de letra; boost configurable para el resto ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // en el texto reflowable, «zoom» es tamaño de letra
        e.preventDefault();
        onFontDelta(e.deltaY < 0 ? 1 : -1);
        return;
      }
      if (wheelBoost === 1) return;
      e.preventDefault();
      el.scrollTop += e.deltaY * wheelBoost;
      el.scrollLeft += e.deltaX * wheelBoost;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [wheelBoost, onFontDelta]);

  const page = index ? index.pages[Math.min(virtualPage, index.pages.length) - 1] : null;
  const waiting = waitingReal !== null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-auto"
      onScroll={(e) => e.stopPropagation()}
      data-viewport="pdf"
      data-viewport-kind="pdf-text"
      tabIndex={0}
      aria-label={t("epub.viewport")}
      data-testid="pdf-text-viewport"
    >
      {waiting || !page ? (
        <div
          className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"
          data-testid={waiting ? "pdf-text-waiting" : "pdf-text-loading"}
        >
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm">
            {waiting ? t("reader.textWaitingPage", { n: waitingReal }) : t("reader.textPreparing")}
          </p>
          {total > 0 && (
            <p className="text-xs tabular-nums" data-testid="pdf-text-waiting-progress">
              {t("reader.textProgress", { done: ready, total })}
            </p>
          )}
        </div>
      ) : (
        <div className="relative h-full w-full">
          {/* misma superficie de lectura que el EPUB: filtros + tinte cálido */}
          <div
            ref={pageRef}
            className="epub-page relative"
            style={{
              filter: cssFilter === "none" ? undefined : cssFilter,
              ["--tp-font-scale" as string]: fontScale,
            }}
            data-testid="pdf-text-page"
            data-page={page.realPage}
          >
            <div className="epubLayer" aria-label={t("epub.page", { n: page.realPage })}>
              <TextBlocks blocks={page.blocks} />
            </div>

            {warmth > 0 && (
              <div
                className="pointer-events-none absolute inset-0 z-[3]"
                style={{
                  background: "rgb(255 158 61)",
                  mixBlendMode: "multiply",
                  opacity: (warmth / 100) * 0.55,
                }}
                aria-hidden
              />
            )}
          </div>
        </div>
      )}

      {/* Página real sin texto: el flujo ya está en la siguiente con contenido */}
      {!waiting && page && notice && (
        <div
          className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-4"
          aria-live="polite"
          data-testid="pdf-text-empty-notice"
        >
          <span className="rounded-full border border-border/60 bg-card/95 px-3 py-1 text-center text-[11px] text-muted-foreground shadow-lg backdrop-blur">
            {notice}
          </span>
        </div>
      )}

      {/* La preparación sigue en segundo plano mientras se lee: aviso discreto */}
      {!waiting && page && !(ready >= total && total > 0) && (
        <div
          className="pointer-events-none sticky bottom-2 z-10 mx-auto flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-card/90 px-3 py-1 text-[10px] text-muted-foreground shadow-lg backdrop-blur"
          data-testid="pdf-text-progress"
        >
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          {t("reader.textProgress", { done: ready, total })}
        </div>
      )}
    </div>
  );
}
