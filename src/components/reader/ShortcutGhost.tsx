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
 *
 * Petición de la dueña (24-10): «cuando no tengo foco — por ejemplo si saco el
 * mouse por completo — que se muestre SIN ocultarse y que la pantalla se
 * oscurezca para que sea más legible». Mientras la interfaz DUERME (la señal
 * de inmersión queda encendida) el recordatorio se queda en pantalla y una
 * capa oscurece el visor para que las teclas se lean. Al despertar (mouse
 * dentro), todo se retira como antes.
 */
export function ShortcutGhost({ signal, entries, testId }: ShortcutGhostProps) {
  const [shown, setShown] = useState(false);
  /** la interfaz duerme: el recordatorio se queda y el visor se oscurece */
  const [asentado, setAsentado] = useState(false);
  const prevSignalRef = useRef(signal);
  const lastAtRef = useRef(0);
  const hideTimerRef = useRef(0);

  useEffect(() => {
    // solo las transiciones REALES de visibilidad disparan (el montaje no cuenta)
    if (prevSignalRef.current === signal) return;
    prevSignalRef.current = signal;
    // la señal encendida marca «interfaz oculta»: al dormirse el recordatorio
    // SE QUEDA (sin temporizador de retirada); al despertar, aparición normal
    const duerme = !!signal;
    // la aparición se agenda fuera del cuerpo del efecto: es la respuesta a un
    // evento de UI, no estado derivado del render
    const arm = window.setTimeout(() => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = 0;
      }
      if (duerme) {
        setAsentado(true);
        setShown(true);
        return;
      }
      setAsentado(false);
      const now = Date.now();
      if (now - lastAtRef.current < SHORTCUT_GHOST_EVERY_MS) return;
      lastAtRef.current = now;
      setShown(true);
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
    <>
      {/* Oscurecimiento del visor mientras la interfaz duerme (petición de la
          dueña): cubre la lectura por debajo del recordatorio y de la UI viva.
          Nunca captura el puntero — el mouse que despierta pasa por dentro. */}
      <div
        className={cn("shortcut-ghost-scrim", asentado && "shortcut-ghost-scrim-on")}
        aria-hidden="true"
        data-testid={testId ? `${testId}-scrim` : undefined}
        data-shown={asentado ? "true" : "false"}
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
