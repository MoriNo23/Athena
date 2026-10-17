"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ZoomPresetId } from "@/lib/types";

const MIN_SCALE = 0.4;
const MAX_SCALE = 8;

/**
 * Los presets NO se recortan con MAX_SCALE: derivan del tamaño real del visor
 * (llenarlo nunca puede explotar — el canvas acusa como mucho ancho_del_visor × dpr).
 * Recortarlos con un tope fijo rompía «Lectura óptima» en PDFs de página base
 * pequeña: pedían escala > 4 para llenar el ancho y el recorte dejaba el libro
 * centrado con un marco de fondo a los costados. El tope solo rige el zoom manual.
 */

/** Zoom predefinidos: todos RELATIVOS AL VISOR y recalculados en vivo */
export const ZOOM_TARGETS: { id: ZoomPresetId; label: string; hint: string }[] = [
  {
    id: "optimal",
    label: "Lectura óptima",
    hint: "El libro ocupa toda la pantalla, de borde a borde",
  },
  {
    id: "page",
    label: "Página completa",
    hint: "La página entera visible sin desplazarte, con aire alrededor",
  },
  { id: "wide", label: "Alejar · paso 1", hint: "La página con aire alrededor" },
  { id: "mid", label: "Alejar · paso 2", hint: "Contexto visual de doble página" },
  { id: "far", label: "Alejar · paso 3", hint: "La página entera en miniatura, ideal para hojear" },
];

/**
 * Escala efectiva derivada del tamaño REAL del visor en cada momento (el scroll
 * vertical de «óptima» es inherente a una página más alta que el monitor).
 * Cuando la UI se oculta (inmersión) el visor crece y la página se re-encuadra
 * sola — el libro siempre llena el espacio disponible, en cualquier preset.
 * «Página completa» = la hoja entera encajada; «Alejar ×n» = fracción del ancho.
 */
function presetScaleFor(
  id: ZoomPresetId | "custom" | null,
  baseWidth: number,
  baseHeight: number,
  containerW: number,
  containerH: number
): number | null {
  if (baseWidth <= 0 || containerW <= 0) return null;
  if (id === "optimal") return (containerW - 2) / baseWidth;
  if (id === "page") {
    if (baseHeight <= 0 || containerH <= 0) return null;
    return Math.min((containerW - 40) / baseWidth, (containerH - 40) / baseHeight);
  }
  const frac = id === "wide" ? 0.7 : id === "mid" ? 0.55 : id === "far" ? 0.42 : null;
  return frac == null ? null : (containerW * frac) / baseWidth;
}

/** Zoom del visor: predefinidos relativos al visor + zoom manual (+/−, Ctrl+rueda) */
export function useZoomPreset() {
  const [baseWidth, setBaseWidth] = useState(0);
  const [baseHeight, setBaseHeight] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [scale, setScale] = useState(1);
  const [activeZoom, setActiveZoom] = useState<ZoomPresetId | "custom" | null>("optimal");
  /** zoom manual guardado como fracción del ancho del visor: al crecer/encoger
      el visor (inmersión, resize) la página se re-encuadra como los presets */
  const customRelRef = useRef<number | null>(null);

  const presetScale = presetScaleFor(activeZoom, baseWidth, baseHeight, containerW, containerH);
  const effectiveScale = presetScale != null ? presetScale : scale;

  const zoomBy = useCallback(
    (factor: number) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, effectiveScale * factor));
      if (baseWidth > 0 && containerW > 0) {
        customRelRef.current = (next * baseWidth) / containerW;
      }
      setScale(next);
      setActiveZoom("custom");
    },
    [effectiveScale, baseWidth, containerW]
  );

  const applyZoomPreset = useCallback((id: ZoomPresetId) => {
    setActiveZoom(id);
  }, []);

  // Zoom manual relativo: si el visor cambia de tamaño estando en «custom»,
  // la página mantiene su fracción de ancho y se re-escala sola.
  useEffect(() => {
    if (activeZoom !== "custom") return;
    const rel = customRelRef.current;
    if (rel == null || containerW <= 0 || baseWidth <= 0) return;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (rel * containerW) / baseWidth));
    setScale((prev) => (Math.abs(prev - next) > 0.0005 ? next : prev));
  }, [containerW, activeZoom, baseWidth]);

  return {
    baseWidth,
    baseHeight,
    setBaseWidth,
    setBaseHeight,
    setContainerW,
    setContainerH,
    effectiveScale,
    activeZoom,
    fitMode: activeZoom === "optimal",
    zoomBy,
    applyZoomPreset,
  };
}
