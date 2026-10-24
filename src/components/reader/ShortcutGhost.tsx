"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** ms que el recordatorio permanece en pantalla antes de retirarse solo */
const SHORTCUT_GHOST_HOLD_MS = 2500;
/** mínimo entre apariciones: el vaivén de pestañas no lo repite sin parar */
const SHORTCUT_GHOST_EVERY_MS = 8000;

export interface ShortcutGhostEntry {
  /** tecla o combinación (símbolo universal, no se traduce) */
  keys: string;
  /** qué hace (i18n) */
  action: string;
}

interface ShortcutGhostProps {
  entries: ShortcutGhostEntry[];
  testId?: string;
}

/**
 * Recordatorio de teclas fantasma para las inmersiones (lector en pantalla
 * completa y teleprompter): una columna a la derecha, en letras grandes y
 * transparentes, con cada tecla y qué hace. Decorativo (aria-hidden) y sin
 * capturar el puntero: los controles y tooltips siguen siendo la fuente
 * accesible.
 *
 * Única chispa (24-10, la dueña): «que solo aparezca una vez vuelvo a la
 * pestaña — ya no estará supervisando el mouse». Antes se disparaba con la
 * quietud del puntero (el chrome dormía tras N segundos sin moverlo y el
 * recordatorio se quedaba en pantalla oscureciendo el visor) — con la pestaña
 * en primer plano eso es ruido, no ayuda. Ahora: la pestaña pasa a visible
 * (visibilitychange) → aparece UNA vez, se retira sola (~2,5 s) y respeta un
 * mínimo entre apariciones (~8 s) para que el vaivén de pestañas no lo repita
 * sin parar. Ningún temporizador vigila el mouse. Un velo opaco cubre el texto
 * detrás mientras está en pantalla: las teclas se LEEN, no se adivinan.
 */
export function ShortcutGhost({ entries, testId }: ShortcutGhostProps) {
  const [shown, setShown] = useState(false);
  const lastAtRef = useRef(0);
  const hideTimerRef = useRef(0);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastAtRef.current < SHORTCUT_GHOST_EVERY_MS) return;
      lastAtRef.current = now;
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      setShown(true);
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = 0;
        setShown(false);
      }, SHORTCUT_GHOST_HOLD_MS);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <>
      {/*
        Velo bajo el recordatorio: la columna vive sobre el texto del libro y
        ahí las teclas se mezclaban — la dueña pidió que opaque lo de atrás.
        Decorativo y sin puntero, igual que la columna que cubre.
      */}
      <div
        className={cn("shortcut-ghost-scrim", shown && "shortcut-ghost-scrim-on")}
        aria-hidden="true"
      />
      <div
        className={cn("shortcut-ghost", shown && "shortcut-ghost-on")}
        aria-hidden="true"
        data-testid={testId}
        data-shown={shown ? "true" : "false"}
      >
        {entries.map((e) => (
          <div key={e.keys} className="shortcut-ghost-row">
            <span className="shortcut-ghost-action">{e.action}</span>
            <kbd className="shortcut-ghost-key">{e.keys}</kbd>
          </div>
        ))}
      </div>
    </>
  );
}
