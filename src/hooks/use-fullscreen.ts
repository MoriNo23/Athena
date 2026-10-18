"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Pantalla completa del documento, compartida por el lector y el teleprompter:
 * el estado se sincroniza con `fullscreenchange` (cubre también la salida con
 * Escape/F11 del propio navegador) y el toggle se traga los rechazos del API
 * para que una promesa rota nunca rompa la lectura.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return { isFullscreen, toggleFullscreen };
}
