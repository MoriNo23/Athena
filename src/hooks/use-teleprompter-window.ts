"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  buildTeleprompterStream,
  extractPdfPageBlocksForTeleprompter,
  teleprompterCharCount,
  teleprompterPageOffsets,
  type TeleprompterBlock,
} from "@/core/teleprompter";
import { extractPdfPageImageBlocks } from "@/lib/teleprompter-images";
import { createCameraController, type CameraController } from "@/lib/camera";

/**
 * Ventana de lectura VIVA (teleprompter-cruce-sin-evento): la página en curso,
 * la siguiente y las ya leídas que el scroll AÚN no sacó de vista. El cruce no
 * es un evento de DOM: la página nueva se AÑADE debajo (nada de lo visible se
 * mueve) y las leídas se PODAN por delante solo cuando su pie ya salió del
 * encuadre, con compensación de scroll — el texto se va porque el scroll lo
 * esconde, nunca porque el flujo lo borre.
 */
export interface StreamWindow {
  /** primera página de la ventana (1-based); crece con la poda frontal */
  start: number;
  /** páginas start..start+n (la lectura avanza de la 0 hacia el final);
      la última ranura puede ser null (cargando) */
  pages: (TeleprompterBlock[] | null)[];
}

/** Ancla de vista para un cambio de ventana (poda frontal o prepend manual):
    el carácter newIndex de la ventana NUEVA debe quedar, tras el cambio, en
    la misma posición visual que tenía el ancla en la ventana vieja. Lo
    publica el jugador justo antes de setWin y lo consume el layout effect
    sobre [win]. */
export interface StreamViewAnchor {
  /** índice del ancla en la ventana VIEJA (trazabilidad del caso) */
  oldIndex: number;
  /** índice del mismo carácter en la ventana NUEVA */
  newIndex: number;
  /** posición visual del ancla antes del cambio: top relativo al contenedor */
  viewportY: number;
}

interface UseTeleprompterWindowOpts {
  doc: PDFDocumentProxy | null;
  /** EPUB: bloques reales de la página (h1-h4 en el flujo) */
  getPageBlocks?: (page: number) => Promise<TeleprompterBlock[]>;
  numPages: number;
  /** wps del preset activo: SOLO decide el modo instantáneo de la cámara.
      El tempo del flujo NO vive aquí (timeline en unidades: cambiar wps no
      reconstruye nada — change fluidez-velocidad). */
  wps: number | null;
  /** tarjetas por frase: los bloques largos se parten en frases legibles */
  porFrase: boolean;
  /** P2: detener a mostrar las figuras (EPUB incorporadas, PDF renderizadas) */
  pausaImagen: boolean;
  /** P2: cuánto se muestra cada figura (ms, independiente de la velocidad) */
  imagenHoldMs: number;
}

/**
 * Capa de datos y DOM del teleprompter: carga de bloques con caché, ventana
 * viva (página en curso + siguiente precargada + las leídas aún a la vista),
 * colección de spans del DOM y el seguimiento de scroll que deja el carácter
 * activo a ~40 % del alto visible. El control de reproducción (motor, cruce,
 * poda) vive en `use-teleprompter-player`.
 */
export function useTeleprompterWindow({
  doc,
  getPageBlocks,
  numPages,
  wps,
  porFrase = true,
  pausaImagen,
  imagenHoldMs,
}: UseTeleprompterWindowOpts) {
  const [win, setWin] = useState<StreamWindow | null>(null);
  const winRef = useRef<StreamWindow | null>(null);
  const winSourceRef = useRef<string | null>(null);
  const cacheRef = useRef<Map<number, TeleprompterBlock[]>>(new Map());

  // el caché es del doc/SOURCE en curs0: al cambiar libro o fuente, arranca
  // limpio (mezclar bloques de dos libros es leer lo que ya no es)
  useEffect(() => {
    cacheRef.current = new Map();
  }, [doc, getPageBlocks]);

  const spansRef = useRef<HTMLSpanElement[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const viewAnchorRef = useRef<StreamViewAnchor | null>(null);

  // ---------- cámara: UN bucle rAF persistente con lerp exponencial ----------
  // Las órdenes de cámara (scrollToChar) SOLO actualizan el objetivo: la
  // velocidad es continua y retargetear a mitad de vuelo nunca tira de vuelta
  // ni arranca curvas nuevas (el rebote del modo automático era eso). Con
  // preset instantáneo o movimiento reducido la cámara escribe directo.
  const cameraRef = useRef<CameraController | null>(null);
  const viewInstantRef = useRef(false);

  if (!cameraRef.current) {
    cameraRef.current = createCameraController({
      el: () => scrollRef.current,
      now: () => performance.now(),
      schedule: (cb) => requestAnimationFrame(cb),
      cancel: (id) => cancelAnimationFrame(id),
      attached: (el) => el.isConnected,
    });
  }
  const camera = cameraRef.current;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewInstantRef.current = wps == null || reduced;
  }, [wps]);

  /** Cancela la cámara en vuelo: el desplazamiento manual manda sobre el
      seguimiento (rueda, ↑) y el objetivo se recalcula contra el DOM real. */
  const cancelViewAnim = useCallback((): boolean => {
    const estaba = camera.isActive();
    camera.cancel();
    return estaba;
  }, [camera]);

  /** Publica el ancla de vista para el PRÓXIMO cambio de ventana: el carácter
      newIndex de la ventana nueva debe quedar tras el swap donde está ahora
      el carácter oldIndex (posición visual medida sobre los spans reales, no
      scrollTop). El layout effect sobre [win] lo consume y compensa sin
      animación antes del pintado. Sin span medible, no publica (el motor
      re-ancla con su primera orden). */
  const stageViewAnchor = useCallback((oldIndex: number, newIndex: number) => {
    const root = scrollRef.current;
    const el = spansRef.current[oldIndex];
    if (!root || !el) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    viewAnchorRef.current = { oldIndex, newIndex, viewportY: r.top - rr.top };
  }, []);

  // ---------- carga de bloques (PDF: heurística compartida con el modo texto) ----
  // `pausaImagen` se lee por ref: el toggle no debe recrear loadBlocks (eso
  // reconstruiría la ventana y devolvería la lectura al inicio de página).
  const pausaImagenRef = useRef(pausaImagen);
  useEffect(() => {
    pausaImagenRef.current = pausaImagen;
  }, [pausaImagen]);

  const loadBlocks = useCallback(
    async (page: number): Promise<TeleprompterBlock[]> => {
      if (page < 1 || page > numPages) return [];
      const cached = cacheRef.current.get(page);
      if (cached) return cached;
      let blocks: TeleprompterBlock[] = [];
      if (getPageBlocks) {
        blocks = await getPageBlocks(page);
      } else if (doc) {
        blocks = await extractPdfPageBlocksForTeleprompter(doc, page);
        // P2 PDF: láminas de la página (render público, fallo → sin tarjeta)
        if (pausaImagenRef.current) {
          try {
            const imgs = await extractPdfPageImageBlocks(doc, page);
            if (imgs.length > 0) blocks = [...blocks, ...imgs];
          } catch {
            /* sin figuras: la página fluye como texto */
          }
        }
      }
      // P2 EPUB: las tarjetas ya vienen dentro de getPageBlocks — el toggle
      // las filtra aquí (mismo contrato para ambas fuentes)
      if (!pausaImagenRef.current) blocks = blocks.filter((b) => !b.image);
      cacheRef.current.set(page, blocks);
      return blocks;
    },
    [getPageBlocks, doc, numPages]
  );

  // ---------- spans del DOM (para encendido, scroll y rebobinado) ----------
  // useLayoutEffect: la compensación de ancla corre antes del pintado y
  // necesita los spans de la ventana NUEVA ya coleccionados y medibles.
  useLayoutEffect(() => {
    spansRef.current = Array.from(
      scrollRef.current?.querySelectorAll<HTMLSpanElement>(".tp-ch") ?? []
    );
  }, [win]);

  // Ventana nueva (cruce, rebobinado, reconstrucción): si el jugador publicó
  // un ancla, la vista se compensa ATÓMICAMENTE —sin animación y antes del
  // pintado— para que el carácter ancla quede donde estaba y la columna no
  // se reacomode (el navegador clampea al rango válido: con la página nueva
  // al inicio de la columna el asentamiento cae al tope). Sin ancla, cualquier
  // cámara en vuelo apunta a contenido que ya no existe — se cancela y el
  // motor re-ancla con su primer scrollToChar contra el DOM fresco.
  useLayoutEffect(() => {
    const anchor = viewAnchorRef.current;
    viewAnchorRef.current = null;
    cancelViewAnim();
    const root = scrollRef.current;
    if (!root || !anchor) return;
    const el = spansRef.current[anchor.newIndex];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const docOffset = r.top - rr.top + root.scrollTop;
    root.scrollTop = docOffset - anchor.viewportY;
  }, [win, cancelViewAnim]);

  /** deja el carácter `idx` a ~40 % del alto visible. La cámara parte SIEMPRE
      de donde esté la vista ahora y solo actualiza el objetivo: en modo auto
      las órdenes llegan letra a letra y ninguna reconstruye la animación —
      la columna sube continua, sin brincos (change teleprompter-camara-estable). */
  const scrollToChar = useCallback(
    (idx: number, opts?: { instant?: boolean }) => {
      const root = scrollRef.current;
      const el = spansRef.current[idx];
      if (!root || !el) return;
      const r = el.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      const target = root.scrollTop + (r.top - rr.top - root.clientHeight * 0.4);
      // `instant`: el rebobinado acompaña la posición de forma DIRECTA (sin
      // animación de cámara): el resultado depende solo del layout y de qué
      // letras están encendidas, nunca de una animación en vuelo.
      camera.order(target, { instant: viewInstantRef.current || opts?.instant });
    },
    [camera]
  );

  const windowBlocks = useMemo(
    () => (win ? win.pages.flatMap((p) => p ?? []) : []),
    [win]
  );
  // El timeline NO depende del wps (unidades de tempo): arrastrar el slider
  // de velocidad no reconstruye el flujo ni reinicia el motor.
  const stream = useMemo(
    () => buildTeleprompterStream(windowBlocks, porFrase, imagenHoldMs),
    [windowBlocks, porFrase, imagenHoldMs]
  );
  // ---------- offsets por página de la ventana ----------
  // El flujo es la concatenación de las páginas de la ventana; los offsets
  // acumulados dicen dónde empieza y acaba cada una dentro de los spans
  // globales. Es el mapa que usa el jugador para anunciar el cruce (progreso)
  // sin tocar el DOM y para podar por delante sin tocar lo visible.
  const pageLens = useMemo(
    () => (win ? win.pages.map((p) => teleprompterCharCount(p ?? [])) : []),
    [win]
  );
  const pageOffsets = useMemo(() => teleprompterPageOffsets(pageLens), [pageLens]);

  /** Cuántas de las primeras `limit` páginas de la ventana están YA FUERA del
      encuadre (su pie quedó por encima del borde superior, con margen de
      respeto). Solo mide: la poda (estado + ancla + rebase de índices) la
      ejecuta el jugador, dueño del encendido. Sin span medible, no hay poda. */
  const pruneMeasure = useCallback(
    (limit: number): number => {
      const root = scrollRef.current;
      if (!root || limit <= 0) return 0;
      const rr = root.getBoundingClientRect();
      const margin = root.clientHeight * 0.3;
      const spans = spansRef.current;
      let cut = 0;
      while (cut < limit) {
        const el = spans[pageOffsets[cut + 1] - 1];
        if (!el) break;
        if (el.getBoundingClientRect().bottom >= rr.top - margin) break;
        cut += 1;
      }
      return cut;
    },
    [pageOffsets, scrollRef, spansRef]
  );

  const totalChars = stream.steps.length;

  return {
    win,
    setWin,
    winRef,
    winSourceRef,
    loadBlocks,
    spansRef,
    scrollRef,
    scrollToChar,
    cancelViewAnim,
    stageViewAnchor,
    windowBlocks,
    stream,
    pageOffsets,
    pruneMeasure,
    totalChars,
  };
}
