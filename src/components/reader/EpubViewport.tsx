"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { filterCss, useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import type { EpubPage } from "@/lib/epub";

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
  const cssFilter = filterCss(filters);
  const warmth = filters.warmth;
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Foco inicial del visor (mismo contrato que PdfViewport) ----
  useEffect(() => {
    if (!pages) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    containerRef.current?.focus({ preventScroll: true });
  }, [pages]);

  // ---- Cambio de página: volver al inicio del texto ----
  const prevPageRef = useRef<number | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    const prev = prevPageRef.current;
    prevPageRef.current = pageNum;
    if (!el || prev === null || prev === pageNum) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, [pageNum]);

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
        <div className="epub-frame relative mx-auto w-full px-6 sm:px-10">
          {/* frame de contenido: filtros + tinte cálido, igual que la página del PDF */}
          <div
            className="epub-page relative"
            style={{
              filter: cssFilter === "none" ? undefined : cssFilter,
              ["--vn-font-scale" as string]: fontScale,
            }}
            data-testid="epub-page"
            data-page={pageNum}
          >
            <div className="epubLayer" aria-label={t("epub.page", { n: pageNum })}>
              {page.blocks.map((b, i) =>
                b.kind === "img" ? (
                  <img key={i} src={b.src} alt={b.alt} className="epub-img" draggable={false} />
                ) : b.kind === "quote" ? (
                  <blockquote key={i} className="epub-quote" dangerouslySetInnerHTML={{ __html: b.html }} />
                ) : b.kind === "li" ? (
                  <p key={i} className="epub-li" dangerouslySetInnerHTML={{ __html: b.html }} />
                ) : b.kind === "h1" ? (
                  <h2 key={i} className="epub-h epub-h1" dangerouslySetInnerHTML={{ __html: b.html }} />
                ) : b.kind === "h2" ? (
                  <h3 key={i} className="epub-h epub-h2" dangerouslySetInnerHTML={{ __html: b.html }} />
                ) : b.kind === "h3" ? (
                  <h3 key={i} className="epub-h epub-h3" dangerouslySetInnerHTML={{ __html: b.html }} />
                ) : b.kind === "h4" ? (
                  <h4 key={i} className="epub-h epub-h3" dangerouslySetInnerHTML={{ __html: b.html }} />
                ) : (
                  <p key={i} className="epub-p" dangerouslySetInnerHTML={{ __html: b.html }} />
                )
              )}
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
