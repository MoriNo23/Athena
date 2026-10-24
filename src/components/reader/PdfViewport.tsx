"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { filterCss, useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { loadPdfLib, PDFJS_ASSETS } from "@/lib/pdf-client";
import { animarGiroPagina, cn } from "@/lib/utils";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { usePdfPageRender } from "@/hooks/use-pdf-render";
import { useOcrPage } from "@/hooks/use-ocr-page";
import { OcrOverlay } from "@/components/reader/OcrOverlay";

interface PdfViewportProps {
  filePath: string;
  pageNum: number;
  scale: number;
  onDocReady: (numPages: number, baseWidth: number, baseHeight: number) => void;
  onContainerWidth: (w: number) => void;
  onContainerHeight?: (h: number) => void;
  /** sin padding: la página ocupa el visor de borde a borde (lectura óptima) */
  bleed?: boolean;
  /** centrar la página verticalmente (página completa) */
  center?: boolean;
  onZoomGesture: (factor: number) => void;
  onBusyChange: (busy: boolean) => void;
  onError: (message: string) => void;
  /** expone el documento para el esquema/outline y otros paneles */
  onDoc?: (doc: PDFDocumentProxy | null) => void;
  /** modo texto: el visor queda tapado por el reflujo (deja de renderizar y cede sus selectores) */
  suspended?: boolean;
}

export function PdfViewport({
  filePath,
  pageNum,
  scale,
  onDocReady,
  onContainerWidth,
  onContainerHeight,
  bleed = false,
  center = false,
  onZoomGesture,
  onBusyChange,
  onError,
  onDoc,
  suspended = false,
}: PdfViewportProps) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const filters = useSettings((s) => s.filters);
  const wheelBoost = useSettings((s) => s.reading.wheelBoost);
  // `auto` sigue al tema: sin resolvedTheme (aún sin montar) la casa asume oscuro
  const cssFilter = filterCss(filters, resolvedTheme !== "light");
  const warmth = filters.warmth;
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const docReadyFired = useRef(false);

  const { renderingPage, pageHasText, pageHasTextRef } = usePdfPageRender({
    doc,
    pageNum,
    scale,
    canvasRef,
    textLayerRef,
    onBusyChange,
    suspended,
  });
  const ocr = useOcrPage({ doc, filePath, pageNum, pageHasTextRef });

  // ---- Carga del documento (el componente remonta por key al cambiar filePath) ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await loadPdfLib();
        const task = pdfjs.getDocument({ url: filePath, ...PDFJS_ASSETS });
        const loaded = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        const page = await loaded.getPage(1);
        const base = page.getViewport({ scale: 1 });
        if (!docReadyFired.current) {
          docReadyFired.current = true;
          onDocReady(loaded.numPages, base.width, base.height);
        }
        onDoc?.(loaded);
        setDoc(loaded);
        setLoading(false);
      } catch (e) {
        console.error("Error cargando PDF", e);
        if (!cancelled) {
          setLoading(false);
          onError("No se pudo abrir el PDF. Puede haberse movido o borrado.");
        }
      }
    })();

    return () => {
      cancelled = true;
      onDoc?.(null);
    };
  }, [filePath]);

  // ---- Foco inicial del visor ----
  // Al terminar la carga, el visor toma el foco si nadie más lo tiene. Así los
  // atajos funcionan sin click previo en la página (y en contextos embebidos
  // tipo iframe, en cuanto el marco recibe el foco con el primer click).
  useEffect(() => {
    if (loading || suspended) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    containerRef.current?.focus({ preventScroll: true });
  }, [loading, suspended]);

  // ---- Medición del contenedor ----
  // El primer reporte es inmediato (evita un salto de escala al abrir); los
  // siguientes van con debounce: cuando la UI se pliega (inmersión) o se
  // redimensiona la ventana, el ResizeObserver dispara en cada frame y
  // re-renderizar el PDF por cada uno sería un derroche.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let measured = false;
    let lastW = 0;
    let lastH = 0;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      lastW = entry.contentRect.width;
      lastH = entry.contentRect.height;
      if (!measured) {
        measured = true;
        onContainerWidth(lastW);
        onContainerHeight?.(lastH);
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onContainerWidth(lastW);
        onContainerHeight?.(lastH);
      }, 140);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ---- Zoom con Ctrl + rueda ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        onZoomGesture(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [onZoomGesture]);

  // ---- Rueda con multiplicador configurable ----
  // Con boost 1 la rueda queda nativa (suavidad del navegador intacta); a partir
  // de 1.5 interceptamos el gesto y amplificamos el desplazamiento vertical —
  // el usuario decide cuánto avanza cada giro, sin reacomodar la vista a cada rato.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (wheelBoost === 1) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return; // el zoom con Ctrl+rueda tiene su propio camino
      e.preventDefault();
      el.scrollTop += e.deltaY * wheelBoost;
      el.scrollLeft += e.deltaX * wheelBoost;
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [wheelBoost]);

  // ---- Cambio de página: hacia el inicio de la página ----
  // Sin animación en la carga/restauración inicial (el componente ya nace en la página guardada).
  // Reset INSTANTÁNEO: el fundido de la página nueva es el único movimiento del giro.
  const prevPageRef = useRef<number | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    const prev = prevPageRef.current;
    prevPageRef.current = pageNum;
    if (!el || prev === null || prev === pageNum) return;
    el.scrollTop = 0;
  }, [pageNum]);

  // ---- Cambio de página: fundido corto de la página recién pintada ----
  // La página anterior NUNCA desaparece antes de tiempo: el repinte ocurre
  // sobre el mismo canvas y el fundido entra cuando la nueva ya está lista
  // (renderingPage vuelve a false). Así el giro no es un golpe seco ni un
  // parpadeo de spinner. `prefers-reduced-motion` apaga el movimiento.
  const frameRef = useRef<HTMLDivElement>(null);
  const pintadaRef = useRef(false);
  const giroPrevioRef = useRef<number | null>(null);
  useEffect(() => {
    if (renderingPage) return;
    const el = frameRef.current;
    if (!el) return;
    const previo = giroPrevioRef.current;
    giroPrevioRef.current = pageNum;
    if (!pintadaRef.current) {
      pintadaRef.current = true;
      return;
    }
    const direccion: 1 | -1 = previo !== null && pageNum < previo ? -1 : 1;
    animarGiroPagina(el, resolvedTheme !== "light", direccion);
  }, [pageNum, renderingPage, resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-auto", suspended && "invisible")}
      onScroll={(e) => e.stopPropagation()}
      data-viewport={suspended ? undefined : "pdf"}
      tabIndex={0}
      aria-hidden={suspended || undefined}
      aria-label={t("epub.viewport")}
    >
      {loading ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm">Abriendo el libro…</p>
        </div>
      ) : (
        <div
          ref={frameRef}
          className={cn(
            "flex min-h-full w-full justify-center",
            center ? "items-center" : "items-start",
            bleed ? "p-0" : "p-4"
          )}
        >
          <div className="relative page-frame rounded-sm" style={{ filter: cssFilter === "none" ? undefined : cssFilter }}>
            <canvas ref={canvasRef} className="block rounded-sm bg-white" aria-label={`Página ${pageNum}`} />
            {/* Capa de texto invisible: habilita selección de palabras (diccionario) */}
            <div ref={textLayerRef} className="textLayer" aria-hidden />

            <OcrOverlay
              ocrActive={ocr.ocrActive}
              ocrResult={ocr.ocrResult}
              ocrWorking={ocr.ocrWorking}
              pageHasText={pageHasText}
              ocrLang={ocr.ocrLang}
              showOcrText={ocr.showOcrText}
              ocrCopied={ocr.ocrCopied}
              onStart={() => void ocr.startOcr()}
              onSwitchLang={ocr.switchOcrLang}
              onCopy={ocr.copyOcrText}
              onToggleText={() => ocr.setShowOcrText((v) => !v)}
              onHide={ocr.hideOcr}
            />

            {/* Tinte cálido para reducir la luz azul */}
            {warmth > 0 && (
              <div
                className="pointer-events-none absolute inset-0 z-[3] rounded-sm"
                style={{
                  background: "rgb(255 158 61)",
                  mixBlendMode: "multiply",
                  opacity: (warmth / 100) * 0.55,
                }}
                aria-hidden
              />
            )}
            {renderingPage && (
              <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
                <div className="m-3 h-1 w-24 overflow-hidden rounded-full bg-black/20">
                  <div className="h-full w-full shimmer" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
