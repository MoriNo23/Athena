"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface PagePeekProps {
  open: boolean;
  doc: PDFDocumentProxy | null;
  /** EPUB: extracto de texto de la página (sin doc, miniatura textual) */
  textPreview?: (page: number) => string;
  totalPages: number;
  /** página seleccionada durante el gesto (controlada por ReaderView) */
  sel: number;
  /** página donde el usuario estaba al abrir (para marcar «actual») */
  originPage: number;
  onSelect: (page: number) => void;
  /** mueve la selección sin cerrar (flechas del teclado) */
  onScrub: (page: number) => void;
  onCancel: () => void;
}

const THUMB_W = 190; // px de render por miniatura
const OFFSETS = [-2, -1, 0, 1, 2] as const;

/** Carrusel overlay de páginas: se abre al arrastrar hacia arriba desde el borde inferior.
 *  Muestra miniaturas (anterior / seleccionada / siguientes) renderizadas bajo demanda.
 *  El gesto de arrastre lo maneja ReaderView; aquí vive la vista + teclado. */
export function PagePeek({
  open,
  doc,
  textPreview,
  totalPages,
  sel,
  originPage,
  onSelect,
  onScrub,
  onCancel,
}: PagePeekProps) {
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const cacheRef = useRef<Map<number, string>>(new Map());
  const cacheDocRef = useRef<PDFDocumentProxy | null>(null);
  const selRef = useRef(sel);
  const { t } = useI18n();

  useEffect(() => {
    selRef.current = sel;
  }, [sel]);

  const taskRef = useRef<{ cancel: () => void } | null>(null);
  // Render secuencial de miniaturas de la ventana visible (poll del sel actual)
  useEffect(() => {
    if (!open || !doc) return;
    let alive = true;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      // libro distinto → el cache de miniaturas anterior ya no vale
      if (cacheDocRef.current !== doc) {
        cacheDocRef.current = doc;
        cacheRef.current.clear();
        setThumbs({});
      }
      while (alive) {
        const s = selRef.current;
        const wanted: number[] = [];
        for (const off of OFFSETS) {
          const p = s + off;
          if (p >= 1 && p <= totalPages) wanted.push(p);
        }
        const need = wanted.find((p) => !cacheRef.current.has(p));
        if (need === undefined) {
          await sleep(120);
          continue;
        }
        try {
          const page = await doc.getPage(need);
          if (!alive) return;
          const vp1 = page.getViewport({ scale: 1 });
          const scale = THUMB_W / vp1.width;
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(vp.width));
          canvas.height = Math.max(1, Math.floor(vp.height));
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const task = page.render({
            canvasContext: ctx,
            viewport: vp,
          } as Parameters<typeof page.render>[0]);
          taskRef.current = task as unknown as { cancel: () => void };
          await task.promise;
          if (!alive) return;
          const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
          cacheRef.current.set(need, dataUrl);
          // cap del cache (LRU simple por orden de inserción)
          if (cacheRef.current.size > 48) {
            const first = cacheRef.current.keys().next().value;
            if (first !== undefined) cacheRef.current.delete(first);
          }
          setThumbs((prev) => ({ ...prev, [need]: dataUrl }));
        } catch {
          if (!alive) return;
          // marca fallida (cadena vacía) para no reintentar en bucle
          cacheRef.current.set(need, "");
          setThumbs((prev) => ({ ...prev, [need]: "" }));
        }
      }
    })();

    return () => {
      alive = false;
      try {
        taskRef.current?.cancel();
      } catch {
        /* noop */
      }
    };
  }, [open, doc, totalPages]);

  // Teclado propio mientras el carrusel está abierto
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        onScrub(Math.max(1, selRef.current - (e.shiftKey ? 10 : 1)));
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        onScrub(Math.min(totalPages, selRef.current + (e.shiftKey ? 10 : 1)));
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSelect(selRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, totalPages, onSelect, onScrub, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] select-none" data-testid="peek-overlay" role="dialog" aria-label={t("peek.aria")}>
      {/* Fondo: clic cancela (no salta) */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }}
        aria-hidden
      />

      {/* Carrusel */}
      <div className="animate-fade-up pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-8">
        <div className="flex items-end justify-center gap-3">
          {OFFSETS.map((off) => {
            const p = sel + off;
            if (p < 1 || p > totalPages) {
              return <div key={off} className="w-16 shrink-0 sm:w-20" aria-hidden />;
            }
            const src = thumbs[p];
            const isSel = off === 0;
            const isOrigin = p === originPage && !isSel;
            return (
              <button
                key={off}
                className={cn(
                  "pointer-events-auto group relative shrink-0 overflow-hidden rounded-md border shadow-2xl transition-all duration-200",
                  isSel
                    ? "z-10 w-28 border-primary/80 ring-2 ring-primary/60 sm:w-36"
                    : Math.abs(off) === 1
                      ? "w-16 border-border/70 opacity-80 brightness-[0.8] hover:opacity-100 sm:w-24"
                      : "w-12 border-border/50 opacity-60 brightness-[0.65] sm:w-16"
                )}
                onPointerDown={(e) => {
                  // los botones no deben robar el capture del gesto
                  e.stopPropagation();
                }}
                onClick={() => onSelect(p)}
                title={isSel ? t("epub.page", { n: p }) : t("peek.goTo", { n: p })}
                data-testid={`peek-thumb-${p}`}
              >
                {thumbs[p] ? (
                  <img src={thumbs[p]} alt={t("epub.page", { n: p })} className="block h-auto w-full" draggable={false} />
                ) : textPreview ? (
                  <div className="epub-peek-card flex aspect-[3/4] w-full items-start justify-center overflow-hidden bg-card p-2">
                    <p className="font-display text-[8px] leading-snug text-foreground/80">
                      {textPreview(p).replace(/\s+/g, " ").slice(0, 340)}…
                    </p>
                  </div>
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center bg-muted">
                    <div className="shimmer h-full w-full" />
                  </div>
                )}
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 bg-black/65 py-0.5 text-center text-[10px] font-medium tabular-nums text-white",
                    isSel && "bg-primary/85 text-primary-foreground"
                  )}
                >
                  {p}
                  {isOrigin ? t("peek.currentSuffix") : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pointer-events-none rounded-full border border-border/60 bg-card/95 px-4 py-1.5 text-xs text-muted-foreground shadow-xl backdrop-blur">
          <span className="font-semibold text-foreground">{t("peek.release", { n: sel })}</span>
          <span className="mx-2 text-border">|</span>
          {t("peek.dragHint")}
          <span className="mx-2 text-border">|</span>
          {t("peek.escHint")}
        </div>
      </div>
    </div>
  );
}
