"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { reflowFilterCss, useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import type { EpubPage } from "@/lib/epub";
import { TextBlocks } from "@/components/reader/TextBlocks";
import { useTheme } from "next-themes";
import { animarGiroPagina } from "@/lib/utils";

interface EpubViewportProps {
  /** páginas virtuales ya parseadas (null = cargando) */
  pages: EpubPage[] | null;
  pageNum: number;
  /** multiplicador global de tamaño de letra del lector (A−/A+) */
  fontScale: number;
  /** Ctrl+rueda y teclas +/− ajustan la letra en vez del zoom */
  onFontDelta: (dir: 1 | -1) => void;
}

/**
 * Visor de EPUB: la página virtual como texto serif sobre el fondo del tema,
 * con los mismos filtros anti-fatiga (papel/sepia/noche + tinte cálido) que
 * el visor de PDF. Reutiliza data-viewport="pdf" para que los atajos, el
 * salto de ↑/↓ y el cierre del diccionario al hacer scroll funcionen igual.
 */
export function EpubViewport({ pages, pageNum, fontScale, onFontDelta }: EpubViewportProps) {
  const filters = useSettings((s) => s.filters);
  const wheelBoost = useSettings((s) => s.reading.wheelBoost);
  const { t } = useI18n();
  const cssFilter = reflowFilterCss(filters);
  const warmth = filters.warmth;
  const { resolvedTheme } = useTheme();
  const oscuro = resolvedTheme !== "light";
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Foco inicial del visor (mismo contrato que PdfViewport) ----
  useEffect(() => {
    if (!pages) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    containerRef.current?.focus({ preventScroll: true });
  }, [pages]);

  // ---- Cambio de página: volver al inicio del texto ----
  // Reset INSTANTÁNEO: el giro ya tiene su movimiento (el desliz de entrada);
  // una subida suave compitiendo con ese desliz era dos movimientos a la vez.
  const prevPageRef = useRef<number | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    const prev = prevPageRef.current;
    prevPageRef.current = pageNum;
    if (!el || prev === null || prev === pageNum) return;
    el.scrollTop = 0;
  }, [pageNum]);

  // ---- Cambio de página: fundido corto del texto nuevo ----
  // El texto reflowable también merece un giro sin sobresalto: la página
  // virtual entra con un fundido de 180 ms (nada de teleport). Con
  // `prefers-reduced-motion`, el cambio es directo, como antes.
  const pageRef = useRef<HTMLDivElement>(null);
  const primeraRef = useRef(false);
  const giroPrevioRef = useRef<number | null>(null);
  useEffect(() => {
    if (!pages) return;
    const el = pageRef.current;
    if (!el) return;
    const previo = giroPrevioRef.current;
    giroPrevioRef.current = pageNum;
    if (!primeraRef.current) {
      primeraRef.current = true;
      return;
    }
    const direccion: 1 | -1 = previo !== null && pageNum < previo ? -1 : 1;
    animarGiroPagina(el, oscuro, direccion);
  }, [pageNum, pages, oscuro]);

  // ---- Rueda: Ctrl = tamaño de letra; boost configurable para el resto ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // en un libro reflowable, «zoom» es tamaño de letra
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

  const page = pages ? pages[Math.min(pageNum, pages.length) - 1] : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-auto"
      onScroll={(e) => e.stopPropagation()}
      data-viewport="pdf"
      data-viewport-kind="epub"
      tabIndex={0}
      aria-label={t("epub.viewport")}
      data-testid="epub-viewport"
    >
      {!pages || !page ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm">{t("epub.opening")}</p>
        </div>
      ) : (
        <div className="relative h-full w-full">
          {/* frame de contenido: filtros + tinte cálido, igual que la página del PDF */}
          <div
            ref={pageRef}
            className="epub-page relative"
            style={{
              filter: cssFilter === "none" ? undefined : cssFilter,
              ["--tp-font-scale" as string]: fontScale,
            }}
            data-testid="epub-page"
            data-page={pageNum}
          >
            <div className="epubLayer" aria-label={t("epub.page", { n: pageNum })}>
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
    </div>
  );
}
