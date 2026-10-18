"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** ms que el recordatorio permanece en pantalla antes de retirarse solo */
const SHORTCUT_GHOST_HOLD_MS = 2500;
/** mínimo entre apariciones: el movimiento del mouse no lo repite sin parar */
const SHORTCUT_GHOST_EVERY_MS = 8000;

export interface ShortcutGhostEntry {
  /** tecla o combinación (símbolo universal, no se traduce) */
  keys: string;
  /** qué hace (i18n) */
  action: string;
}

interface ShortcutGhostProps {
  /** señal de visibilidad de la interfaz: cada CAMBIO dispara una aparición
      (la inmersión del modo que monta el fantasma: uiHidden / chromeHidden) */
  signal: string | boolean;
  entries: ShortcutGhostEntry[];
  testId?: string;
}

/**
 * Recordatorio de teclas fantasma para las inmersiones (lector en pantalla
 * completa y teleprompter): una columna a la derecha, en letras grandes y
 * transparentes, con cada tecla y qué hace. Cada transición de visibilidad de
 * la interfaz dispara una aparición, que se retira sola (~2.5 s) con un
 * mínimo entre apariciones (~8 s) para que el movimiento del mouse no lo
 * repita sin parar. Decorativo (aria-hidden) y sin capturar el puntero: los
 * controles y tooltips siguen siendo la fuente accesible.
 */
export function ShortcutGhost({ signal, entries, testId }: ShortcutGhostProps) {
  const [shown, setShown] = useState(false);
  const prevSignalRef = useRef(signal);
  const lastAtRef = useRef(0);
  const hideTimerRef = useRef(0);

  useEffect(() => {
    // solo las transiciones REALES de visibilidad disparan (el montaje no cuenta)
    if (prevSignalRef.current === signal) return;
    prevSignalRef.current = signal;
    // la aparición se agenda fuera del cuerpo del efecto: es la respuesta a un
    // evento de UI, no estado derivado del render
    const arm = window.setTimeout(() => {
      const now = Date.now();
      if (now - lastAtRef.current < SHORTCUT_GHOST_EVERY_MS) return;
      lastAtRef.current = now;
      setShown(true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = 0;
        setShown(false);
      }, SHORTCUT_GHOST_HOLD_MS);
    }, 0);
    return () => window.clearTimeout(arm);
  }, [signal]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    },
    []
  );

  return (
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
  );
}
