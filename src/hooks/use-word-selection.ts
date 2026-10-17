"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

/**
 * Detección de selección de palabras (mouseup sobre la capa de texto del PDF,
 * digital u OCR) y avisos asociados: cierra con Escape o scroll del visor y
 * avisa una sola vez por libro cuando el usuario intenta seleccionar en una
 * página escaneada sin texto.
 */
export function useWordSelectionEvents(opts: {
  enabled: boolean;
  bookId: string;
  /** la tarjeta está abierta (hay selección vigente) */
  active: boolean;
  cardRef: RefObject<HTMLDivElement | null>;
  /** palabra seleccionada dentro de la capa de texto */
  onPick: (pick: { word: string; x: number; y: number }) => void;
  /** clic sin selección: cerrar la tarjeta */
  onClear: () => void;
}) {
  const { enabled, bookId, active, cardRef, onPick, onClear } = opts;
  const { toast } = useToast();
  const { t } = useI18n();
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const scanHintShownRef = useRef(false);

  const onClearRef = useRef(onClear);
  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  /** Si el usuario intentó seleccionar en una página sin texto digital, avisar una vez por libro */
  const maybeScanHint = useCallback(
    (e: MouseEvent) => {
      if (scanHintShownRef.current) return;
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (!start) return;
      // un arrastre corto es un clic simple, no un intento de selección
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      const target = e.target instanceof Element ? e.target : null;
      const layer = target?.closest(".textLayer, .ocrLayer");
      if (!layer || layer.querySelectorAll("span").length > 0) return;
      try {
        const key = `riel-hint-scan-${bookId}`;
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
      } catch {
        /* noop */
      }
      scanHintShownRef.current = true;
      toast({
        title: t("scan.title"),
        description: t("scan.body"),
        duration: 7000,
      });
    },
    [bookId, toast, t]
  );

  // ---- Detección de selección (mouseup sobre la capa de texto) ----
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };
    const handler = (e: MouseEvent) => {
      // clic dentro de la tarjeta: no reevaluar
      if (cardRef.current?.contains(e.target as Node)) return;
      // clic con botón derecho / medio: ignorar
      if (e.button !== 0) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      if (!selection || selection.isCollapsed || text.length === 0) {
        maybeScanHint(e);
        onClearRef.current();
        return;
      }
      // solo nos interesan selecciones dentro de las capas de texto (PDF digital,
      // OCR o página EPUB): el resto no abre ni cierra la tarjeta
      const anchor = selection.anchorNode;
      const el = anchor instanceof Element ? anchor : anchor?.parentElement;
      if (!el?.closest(".textLayer, .ocrLayer, .epubLayer")) {
        return; // fuera del libro: no abrir, no cerrar
      }

      const words = text.split(/\s+/).filter(Boolean);
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const word = words[0] ?? text;
      onPick({ word, x: rect.left + rect.width / 2, y: rect.bottom });
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("mouseup", handler, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("mouseup", handler, true);
    };
  }, [enabled, cardRef, onPick, maybeScanHint]);

  // ---- Cerrar con Escape o scroll del visor ----
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClearRef.current();
      }
    };
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-viewport='pdf']")) onClearRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [active]);
}
