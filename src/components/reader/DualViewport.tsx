"use client";

import { useEffect, useRef, useState } from "react";
import { filterCss, useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { loadPdfLib, PDFJS_ASSETS } from "@/lib/pdf-client";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";

interface DualViewportProps {
  companionPath: string;
  /** página principal actual (del libro principal) */
  mainPage: number;
  mainTotal: number;
  companionTotal: number;
}

/**
 * Visor del PDF compañero (traducción / otra edición): se ajusta al ancho de su
 * columna y muestra la página equivalente al progreso relativo del libro
 * principal, para que dos ediciones de distinta extensión avancen juntas.
 */
export function DualViewport({ companionPath, mainPage, mainTotal, companionTotal }: DualViewportProps) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const filters = useSettings((s) => s.filters);
  // `auto` sigue al tema: sin resolvedTheme (aún sin montar) la casa asume oscuro
  const cssFilter = filterCss(filters, resolvedTheme !== "light");
  const warmth = filters.warmth;

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [containerW, setContainerW] = useState(0);
  const [baseW, setBaseW] = useState(0);
  const [rendering, setRendering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void; promise: Promise<unknown> } | null>(null);

  // página equivalente por progreso relativo
  const progress = mainTotal > 0 ? (mainPage - 1) / mainTotal : 0;
  const page = Math.min(Math.max(1, Math.round(progress * companionTotal) + 1), companionTotal);

  // carga del documento
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await loadPdfLib();
        const task = pdfjs.getDocument({ url: companionPath, ...PDFJS_ASSETS });
        const loaded = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        const p1 = await loaded.getPage(1);
        const base = p1.getViewport({ scale: 1 });
        setBaseW(base.width);
        setDoc(loaded);
      } catch (e) {
        console.error("Error cargando PDF compañero", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companionPath]);

  // medición del contenedor (primer reporte inmediato, resto con debounce)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let measured = false;
    let lastW = 0;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      lastW = entry.contentRect.width;
      if (!measured) {
        measured = true;
        setContainerW(lastW);
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        setContainerW(lastW);
      }, 140);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ---- Cambio de página principal: el compañero vuelve arriba con suavidad ----
  // Sin animación en la primera render (restauración).
  const prevMainPageRef = useRef<number | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    const prev = prevMainPageRef.current;
    prevMainPageRef.current = mainPage;
    if (!el || prev === null || prev === mainPage) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, [mainPage]);

  // render de la página equivalente
  useEffect(() => {
    if (!doc || containerW <= 0 || baseW <= 0) return;
    let cancelled = false;

    (async () => {
      try {
        setRendering(true);
        const dpage = await doc.getPage(page);
        if (cancelled) return;
        const scale = Math.max(0.1, (containerW - 40) / baseW);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewport = dpage.getViewport({ scale: scale * dpr });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        renderTaskRef.current?.cancel();
        const task = dpage.render({ canvasContext: ctx, viewport } as Parameters<typeof dpage.render>[0]);
        renderTaskRef.current = task as unknown as { cancel: () => void; promise: Promise<unknown> };
        await task.promise;
      } catch (e) {
        const name = (e as { name?: string })?.name;
        if (name !== "RenderingCancelledException" && name !== "AbortException") {
          console.warn("Error renderizando compañero", e);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        renderTaskRef.current?.cancel();
      } catch {
        /* noop */
      }
    };
  }, [doc, page, containerW, baseW]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-auto border-l border-border/60"
      data-viewport="companion"
      aria-label={t("dual.viewportAria")}
    >
      {!doc ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs">Abriendo compañero…</p>
        </div>
      ) : (
        <div className="flex min-h-full w-full items-start justify-center p-5">
          <div className="relative page-frame rounded-sm" style={{ filter: cssFilter === "none" ? undefined : cssFilter }}>
            <canvas ref={canvasRef} className="block rounded-sm bg-white" aria-label={`Compañero página ${page}`} />
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
            {rendering && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 shimmer bg-black/10" />
            )}
          </div>
        </div>
      )}
      {doc && (
        <div className="pointer-events-none sticky bottom-1 mx-auto w-fit rounded-full border border-border/60 bg-card/90 px-2.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          compañero · pág. {page} de {companionTotal}
        </div>
      )}
    </div>
  );
}
