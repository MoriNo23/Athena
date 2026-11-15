"use client";

import { useCallback, useEffect, useState } from "react";
import { esFullscreenUtil } from "@/lib/plataforma";

/**
 * Pantalla completa del documento, compartida por el lector y el teleprompter:
 * el estado se sincroniza con `fullscreenchange` (cubre también la salida con
 * Escape/F11 del propio navegador) y el toggle se traga los rechazos del API
 * para que una promesa rota nunca rompa la lectura.
 *
 * `disponible` es falso cuando la pantalla completa no aporta nada (el APK:
 * el WebView ya ocupa toda la pantalla) o cuando el navegador no implementa
 * el API. En esos casos el botón no se pinta y los atajos lo ignoran: un
 * botón que no hace nada es peor que no tenerlo.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Se resuelve tras montar: en el servidor no hay `document` ni marca de APK.
  const [disponible, setDisponible] = useState(false);

  useEffect(() => {
    setDisponible(esFullscreenUtil());
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!esFullscreenUtil()) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return { isFullscreen: isFullscreen && disponible, toggleFullscreen, disponible };
}
