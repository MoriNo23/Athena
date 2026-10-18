"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { loadPdfLib } from "@/lib/pdf-client";
import type { PageViewport, PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { TextLayer as PdfjsTextLayer } from "pdfjs-dist";

type RenderTaskLike = { cancel: () => void; promise: Promise<unknown> };

/** ¿El error es una cancelación intencional (cambio de página/zoom)? No es un fallo real. */
function isRenderCancelled(e: unknown): boolean {
  const name = (e as { name?: string })?.name;
  return name === "RenderingCancelledException" || name === "AbortException";
}

/** Ajusta el lienzo al viewport (con DPR) y devuelve su contexto 2d. */
function sizeCanvas(
  canvas: HTMLCanvasElement,
  viewport: { width: number; height: number },
  dpr: number
): CanvasRenderingContext2D | null {
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
  return canvas.getContext("2d", { alpha: false });
}

/** Muestrea el canvas reducido a 48x64 y devuelve true si es (casi) uniforme */
function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  try {
    const w = 48;
    const h = 64;
    const probe = document.createElement("canvas");
    probe.width = w;
    probe.height = h;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    if (!pctx) return false;
    pctx.drawImage(canvas, 0, 0, w, h);
    const data = pctx.getImageData(0, 0, w, h).data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
      if (max - min > 18) return false; // hay contraste → hay contenido
    }
    return true; // uniforme → probablemente en blanco
  } catch {
    return false;
  }
}

/**
 * Render de una página con red de seguridad anti página en blanco: algunos PDFs
 * (papers escaneados con perfiles ICC, fuentes CID) pueden renderizar vacíos si
 * un recurso falló silenciosamente. Detectamos un lienzo casi uniforme en una
 * copia reducida y reintentamos una vez.
 */
async function renderWithSafetyNet(opts: {
  page: PDFPageProxy;
  canvas: HTMLCanvasElement;
  viewport: PageViewport;
  ctx: CanvasRenderingContext2D;
  setTask: (t: RenderTaskLike) => void;
  isCancelled: () => boolean;
}): Promise<void> {
  const { page, canvas, viewport, ctx, setTask, isCancelled } = opts;
  const render = () => {
    const task = page.render({ canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]);
    setTask(task as unknown as RenderTaskLike);
    return task.promise;
  };

  await render();
  if (isCancelled()) return;
  if (!isCanvasBlank(canvas)) return;

  try {
    await new Promise((r) => setTimeout(r, 120));
    if (isCancelled()) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await render();
  } catch (e) {
    if (!isRenderCancelled(e)) console.warn("Reintento de render falló", e);
  }
}

/**
 * Render de la página actual + capa de texto (selección de palabras para el
 * diccionario). Devuelve el estado de ocupado local y si la página trae texto
 * digital (null = aún sin saber; false = escaneo → candidato a OCR).
 */
export function usePdfPageRender(opts: {
  doc: PDFDocumentProxy | null;
  pageNum: number;
  scale: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  textLayerRef: RefObject<HTMLDivElement | null>;
  onBusyChange: (busy: boolean) => void;
  /** modo texto: el visor de páginas queda tapado y deja de renderizar */
  suspended?: boolean;
}) {
  const { doc, pageNum, scale, canvasRef, textLayerRef, onBusyChange, suspended = false } = opts;
  const [renderingPage, setRenderingPage] = useState(false);
  const [pageHasText, setPageHasText] = useState<boolean | null>(null);
  const pageHasTextRef = useRef<boolean | null>(null);
  const renderTaskRef = useRef<RenderTaskLike | null>(null);
  const textTaskRef = useRef<PdfjsTextLayer | null>(null);

  useEffect(() => {
    pageHasTextRef.current = pageHasText;
  }, [pageHasText]);

  // ---- Render de la página actual ----
  useEffect(() => {
    if (!doc || suspended) return;
    let cancelled = false;

    (async () => {
      try {
        setRenderingPage(true);
        onBusyChange(true);
        const page = await doc.getPage(pageNum);
        if (cancelled) return;

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: scale * dpr });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = sizeCanvas(canvas, viewport, dpr);
        if (!ctx) return;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await renderWithSafetyNet({
          page,
          canvas,
          viewport,
          ctx,
          setTask: (t) => {
            renderTaskRef.current = t;
          },
          isCancelled: () => cancelled,
        });

        if (!cancelled) {
          setRenderingPage(false);
          onBusyChange(false);
        }
      } catch (e) {
        // Cancelaciones intencionales no son error
        if (!isRenderCancelled(e)) {
          console.error("Error renderizando página", e);
          if (!cancelled) {
            setRenderingPage(false);
            onBusyChange(false);
          }
        }
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
  }, [doc, pageNum, scale, canvasRef, onBusyChange, suspended]);

  // ---- Capa de texto (selección de palabras para el diccionario) ----
  useEffect(() => {
    if (!doc || suspended) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const container = textLayerRef.current;
        if (!container) return;

        setPageHasText(null);
        textTaskRef.current?.cancel();
        container.replaceChildren();
        container.style.setProperty("--total-scale-factor", String(scale));

        const pdfjs = await loadPdfLib();
        const viewport = page.getViewport({ scale });
        const layer = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent({ disableNormalization: false }),
          container,
          viewport,
        });
        textTaskRef.current = layer;
        await layer.render();
        // ¿esta página trae texto digital? Si no, es un escaneo → se ofrece OCR
        const chars = container.textContent?.replace(/\s/g, "").length ?? 0;
        if (!cancelled) setPageHasText(chars >= 8);
      } catch (e) {
        if (!isRenderCancelled(e)) console.warn("No se pudo construir la capa de texto", e);
      }
    })();

    return () => {
      cancelled = true;
      try {
        textTaskRef.current?.cancel();
      } catch {
        /* noop */
      }
    };
  }, [doc, pageNum, scale, textLayerRef, suspended]);

  return { renderingPage, pageHasText, pageHasTextRef };
}
