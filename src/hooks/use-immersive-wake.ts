"use client";

import { useEffect, type RefObject } from "react";

/**
 * Inmersión de lectura: oculta el chrome (cabecera, dock, riel) tras N segundos
 * sin actividad y lo despierta SOLO con el mouse.
 *
 * Regla de oro (spec crapper/UX): las teclas y la rueda ejecutan su acción en
 * silencio — no despiertan la UI — y solo reinician el temporizador de
 * ocultación. Así la lectura con atajos nunca interrumpe la inmersión.
 *
 * Ocultación manual (tecla): si la UI la escondió el usuario con su tecla
 * (hiddenByKeyRef), el mouse NO la despierta — solo la misma tecla la devuelve.
 * El hook expone rearmRef para reiniciar el temporizador tras mostrarla.
 */
export function useImmersiveWake(opts: {
  enabled: boolean;
  idleSeconds: number;
  chromeHiddenRef: RefObject<boolean>;
  /** true si la UI está oculta por la tecla del usuario (no por inactividad) */
  hiddenByKeyRef: RefObject<boolean>;
  pointerOnChromeRef: RefObject<boolean>;
  overlaysOpenRef: RefObject<boolean>;
  setChromeHidden: (v: boolean) => void;
  /** el hook escribe aquí una función para rearmar el temporizador de ocultación */
  rearmRef?: RefObject<(() => void) | null>;
}) {
  const {
    enabled,
    idleSeconds,
    chromeHiddenRef,
    hiddenByKeyRef,
    pointerOnChromeRef,
    overlaysOpenRef,
    setChromeHidden,
    rearmRef,
  } = opts;

  useEffect(() => {
    const show = () => {
      if (chromeHiddenRef.current) {
        chromeHiddenRef.current = false;
        setChromeHidden(false);
      }
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // No ocultar si ya está oculta (p. ej. por tecla), si el mouse descansa
        // sobre la UI o hay algo abierto
        if (chromeHiddenRef.current || hiddenByKeyRef.current || pointerOnChromeRef.current || overlaysOpenRef.current) {
          arm();
          return;
        }
        chromeHiddenRef.current = true;
        setChromeHidden(true);
      }, Math.max(2, idleSeconds) * 1000);
    };
    if (rearmRef) rearmRef.current = arm;
    if (!enabled) {
      // desactiva en el siguiente tick (sin setState síncrono en el cuerpo del efecto)
      timer = setTimeout(show, 0);
      return () => {
        if (timer) clearTimeout(timer);
        if (rearmRef) rearmRef.current = null;
      };
    }
    const wake = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      pointerOnChromeRef.current = !!t?.closest?.("[data-chrome]");
      // Ocultación por tecla: el mouse no manda — solo la misma tecla devuelve la UI
      if (hiddenByKeyRef.current) return;
      show();
      arm();
    };
    // Teclas y rueda: ejecutan su acción sin DESPERTAR la UI (lectura fluida);
    // solo reinician el temporizador de ocultación. Solo el mouse despierta el chrome.
    // EXCEPCIÓN (a11y): Tab navega el FOCO — con el chrome dormido, un usuario
    // de solo-teclado no tiene otra forma de alcanzar los controles (están en
    // visibility:hidden y el tab los salta). Tab lo despierta.
    const keepAsleepKeys = (e: KeyboardEvent) => {
      if (hiddenByKeyRef.current) return;
      if (e.key === "Tab" && chromeHiddenRef.current) {
        show();
      }
      arm();
    };
    const keepAsleepWheel = () => {
      if (hiddenByKeyRef.current) return;
      arm();
    };
    window.addEventListener("mousemove", wake, { passive: true });
    window.addEventListener("keydown", keepAsleepKeys);
    window.addEventListener("wheel", keepAsleepWheel, { passive: true });
    arm();
    return () => {
      if (timer) clearTimeout(timer);
      if (rearmRef) rearmRef.current = null;
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", keepAsleepKeys);
      window.removeEventListener("wheel", keepAsleepWheel);
    };
  }, [enabled, idleSeconds, chromeHiddenRef, hiddenByKeyRef, pointerOnChromeRef, overlaysOpenRef, setChromeHidden, rearmRef]);
}
