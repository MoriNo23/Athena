"use client";

import { useEffect, type RefObject } from "react";
import type { ZoomPresetId } from "@/lib/types";

/** Teclas reservadas por otros atajos del lector: no pueden ocultar la UI */
export const RESERVED_HOTKEYS = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "pageup",
  "pagedown",
  "+",
  "=",
  "-",
  "f",
  "o",
  "m",
  "escape",
  "tab",
  " ",
  "enter",
]);

interface ReaderKeyActions {
  goToPage: (p: number) => void;
  pageNum: number;
  zoomBy: (factor: number) => void;
  toggleFullscreen: () => void;
  applyZoomPreset: (id: ZoomPresetId) => void;
  scrollByStep: (dir: 1 | -1) => boolean;
}

/**
 * Guarda del lector: solo bloqueamos donde el foco NECESITA las teclas para sí.
 * Bloquea: inputs de texto, diálogos/panels abiertos y controles que consumen
 * flechas (sliders, tabs, menús, listas). Los botones sueltos NO bloquean:
 * tras click en un botón de chrome los atajos siguen vivos (fix «teclas muertas»).
 */
function isBlockedTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.isContentEditable) return true;
  // dentro de diálogos/sheets/popovers abiertos (p. ej. ajustes con sliders) no navegamos
  if (el.closest?.('[role="dialog"]')) return true;
  // controles que usan las flechas para su propia navegación
  const role = el.getAttribute?.("role");
  if (role === "slider" || role === "tab" || role === "menuitem" || role === "option" || role === "combobox") return true;
  if (el.closest?.('[role="slider"], [role="menu"], [role="listbox"], [role="radiogroup"], [role="tablist"]')) return true;
  return false;
}

/** Ejecuta el atajo que corresponda; devuelve true si la tecla era un atajo */
function runReaderKey(e: KeyboardEvent, a: ReaderKeyActions): boolean {
  switch (e.key) {
    case "ArrowRight":
    case "PageDown":
      e.preventDefault();
      a.goToPage(a.pageNum + 1);
      return true;
    case "ArrowLeft":
    case "PageUp":
      e.preventDefault();
      a.goToPage(a.pageNum - 1);
      return true;
    case "ArrowDown":
      e.preventDefault();
      // en el borde inferior de la página: pasa a la siguiente (lectura continua)
      if (!a.scrollByStep(1)) a.goToPage(a.pageNum + 1);
      return true;
    case "ArrowUp":
      e.preventDefault();
      // en el borde superior: vuelve a la anterior
      if (!a.scrollByStep(-1)) a.goToPage(a.pageNum - 1);
      return true;
    case "+":
    case "=":
      a.zoomBy(1.12);
      return true;
    case "-":
      a.zoomBy(1 / 1.12);
      return true;
    case "f":
    case "F":
      a.applyZoomPreset("page");
      return true;
    case "o":
    case "O":
      a.applyZoomPreset("optimal");
      return true;
    case "m":
    case "M":
      e.preventDefault();
      a.toggleFullscreen();
      return true;
    default:
      return false;
  }
}

/**
 * Atajos de teclado del lector (spec crapper: decisión por caso, funciones chicas).
 * ←/→ y PageUp·PageDown navegan páginas; ↑/↓ desplazan dentro de la página con
 * el salto configurable (y giran la página al llegar al borde); +/− zoom,
 * F página completa, O óptimo, M fullscreen; tecla configurable oculta/muestra
 * la interfaz (inmersión manual).
 * Con el carrusel de peek abierto, PagePeek maneja las suyas.
 */
export function useReaderHotkeys(opts: {
  goToPage: (p: number) => void;
  pageNum: number;
  zoomBy: (factor: number) => void;
  toggleFullscreen: () => void;
  applyZoomPreset: (id: ZoomPresetId) => void;
  peekOpenRef: RefObject<boolean>;
  /** desplaza el visor una fracción configurable; false si ya está en el borde */
  scrollByStep: (dir: 1 | -1) => boolean;
  /** oculta/muestra la interfaz al instante (tecla configurable en ajustes) */
  toggleHideUi: () => void;
  toggleKey: string;
}) {
  const {
    goToPage,
    pageNum,
    zoomBy,
    toggleFullscreen,
    applyZoomPreset,
    peekOpenRef,
    scrollByStep,
    toggleHideUi,
    toggleKey,
  } = opts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isBlockedTarget(e.target)) return;
      // carrusel abierto: las flechas/Enter/Esc los maneja PagePeek
      if (peekOpenRef.current) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const handled = runReaderKey(e, {
        goToPage,
        pageNum,
        zoomBy,
        toggleFullscreen,
        applyZoomPreset,
        scrollByStep,
      });
      if (handled) return;
      // Tecla configurable de inmersión manual (ocultar/mostrar la UI)
      if (toggleKey && e.key.toLowerCase() === toggleKey.toLowerCase()) {
        e.preventDefault();
        toggleHideUi();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goToPage, pageNum, zoomBy, toggleFullscreen, applyZoomPreset, peekOpenRef, scrollByStep, toggleHideUi, toggleKey]);
}
