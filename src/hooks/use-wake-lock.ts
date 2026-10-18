"use client";

import { useEffect, useRef } from "react";

/** Sentinel mínimo de Screen Wake Lock (la lib estándar puede no traerlo). */
interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
}
type WakeLockApi = { request: (type: "screen") => Promise<WakeLockSentinelLike> };

/**
 * Pantalla despierta (Screen Wake Lock): con `enabled` y la pestaña visible
 * pide el bloqueo, lo vuelve a pedir al regresar a la pestaña (el navegador
 * lo libera solo al ocultarla) y lo libera al deshabilitar o desmontar.
 * Sin soporte del navegador: silencio total, la lectura sigue igual.
 */
export function useWakeLock(enabled: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!wakeLock) return;

    let alive = true;

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
    };

    const acquire = () => {
      if (!alive || !enabledRef.current || sentinelRef.current) return;
      if (document.visibilityState !== "visible") return;
      wakeLock
        .request("screen")
        .then((sentinel) => {
          if (!alive || !enabledRef.current) {
            void sentinel.release().catch(() => {});
            return;
          }
          sentinelRef.current = sentinel;
          sentinel.addEventListener("release", () => {
            if (sentinelRef.current === sentinel) sentinelRef.current = null;
          });
        })
        .catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    if (enabled) acquire();
    else release();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [enabled]);
}
