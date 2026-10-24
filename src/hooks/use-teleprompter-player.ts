"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { teleprompterRewind, teleprompterCharCount, type TeleprompterBlock } from "@/lib/teleprompter";
import { TELEPROMPTER_PAGE_TURN_MS } from "@/lib/teleprompter";
import type { StreamWindow } from "@/hooks/use-teleprompter-window";
import { plannedStepDelay, stepWait, type PendingStep } from "@/lib/step-timer";

interface UseTeleprompterPlayerOpts {
  /** página real pedida por el lector (1-based) */
  pageNum: number;
  /** ventana viva (de use-teleprompter-window) */
  win: StreamWindow | null;
  setWin: (w: StreamWindow | null) => void;
  winRef: React.RefObject<StreamWindow | null>;
  winSourceRef: React.RefObject<string | null>;
  loadBlocks: (page: number) => Promise<TeleprompterBlock[]>;
  numPages: number;
  /** dominio del flujo ("pdf" | "text" | "epub"): si cambia, la ventana se reconstruye */
  sourceKey: string;
  /** hay fuente de bloques (doc cargado o extractor por página): sin ella no
      se construye ventana — evita clavar una ventana vacía sin recuperación */
  hasSource: boolean;
  /** gira la página real del lector (cuenta como lectura y hitos salvo `silent`) */
  onGoToPage: (page: number, opts?: { silent?: boolean }) => void;
  stream: ReturnType<typeof import("@/lib/teleprompter").buildTeleprompterStream>;
  firstLen: number;
  totalChars: number;
  spansRef: React.RefObject<HTMLSpanElement[]>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  scrollToChar: (idx: number, opts?: { instant?: boolean }) => void;
  /** publica el ancla de vista para el próximo cambio de ventana (sin reacomodo) */
  stageViewAnchor: (oldIndex: number, newIndex: number) => void;
  /** Auto: al agotar la página sigue sola */
  auto: boolean;
  /** palabras por segundo activas (null = Instantánea) */
  wps: number | null;
  /** tic de tipeo (WebAudio); ya filtrado por el ajuste de sonido */
  tick: () => void;
}

/**
 * Control de reproducción del teleprompter (pausa/reanudar, rebobinado, cruce
 * de página y encadenado) más el motor de encendido letra a letra.
 *
 * La ventana (página actual + siguiente) se reconstruye al llegar a una página
 * fuera de ella y resetea la reproducción; al cruzar de página el flujo
 * «desliza» la ventana y precarga la siguiente en silencio. Sin Auto, el cruce
 * espera la orden explícita (allowCross); con Auto, una pausa calculada del
 * tempo lo autoriza solo.
 */
export function useTeleprompterPlayer({
  pageNum,
  win,
  setWin,
  winRef,
  winSourceRef,
  loadBlocks,
  numPages,
  sourceKey,
  hasSource,
  onGoToPage,
  stream,
  firstLen,
  totalChars,
  spansRef,
  scrollRef,
  scrollToChar,
  stageViewAnchor,
  auto,
  wps,
  tick,
}: UseTeleprompterPlayerOpts) {
  const [lit, setLit] = useState(0);
  const [playing, setPlaying] = useState(true);
  /** la página actual se agotó: sin Auto espera la orden */
  const [pageDone, setPageDone] = useState(false);
  const [bookDone, setBookDone] = useState(false);
  const litRef = useRef(0);
  const allowCrossRef = useRef(false);
  // El callback del lector se lee por ref: su identidad nunca debe reiniciar
  // el motor ni recrear `slide` (defensa ante un padre que no lo memoice).
  const onGoToPageRef = useRef(onGoToPage);
  useEffect(() => {
    onGoToPageRef.current = onGoToPage;
  }, [onGoToPage]);
  // Próximo paso del motor: instante en que vence y a qué letra corresponde.
  // Si el efecto se reinicia (cualquier dependencia que cambie) la espera ya
  // transcurrida no se pierde: una pausa larga no puede quedar siempre a medias.
  const dueRef = useRef<PendingStep<StreamWindow> | null>(null);

  // ---------- ventana: página actual + siguiente ----------
  useEffect(() => {
    const cur = winRef.current;
    // el cruce interno ya movió la ventana: el lector solo va un paso por detrás
    if (
      cur &&
      winSourceRef.current === sourceKey &&
      pageNum >= cur.start &&
      pageNum <= cur.start + 1
    ) {
      return;
    }
    // sin fuente de bloques (el PDF aún carga) no se construye ventana vacía:
    // loadBlocks cambia de identidad al llegar el doc y este efecto re-corre
    if (!hasSource) return;

    let alive = true;
    void (async () => {
      let start = pageNum;
      let first = await loadBlocks(start);
      // portada o página muda: el flujo arranca en la siguiente con texto
      if (teleprompterCharCount(first) === 0) {
        for (let p = pageNum + 1; p <= Math.min(numPages, pageNum + 3); p++) {
          const blocks = await loadBlocks(p);
          if (teleprompterCharCount(blocks) > 0) {
            start = p;
            first = blocks;
            break;
          }
        }
      }
      const next = start < numPages ? await loadBlocks(start + 1) : null;
      if (!alive) return;
      const opened: StreamWindow = { start, pages: [first, next] };
      winRef.current = opened;
      winSourceRef.current = sourceKey;
      litRef.current = 0;
      setWin(opened);
      setLit(0);
      setPlaying(true);
      setPageDone(false);
      setBookDone(false);
      // alineación al abrir: no es lectura, no suma páginas
      if (start !== pageNum) onGoToPageRef.current(start, { silent: true });
    })();
    return () => {
      alive = false;
    };
  }, [pageNum, numPages, loadBlocks, sourceKey, hasSource, setWin, winRef, winSourceRef]);

  // ---------- deslizar la ventana al cruzar de página ----------
  // CRUCE ATÓMICO: la ventana nueva entra en el MISMO render que el rebase del
  // encendido (fin de las órdenes de cámara contra el DOM viejo: nada de
  // vaivén). La página siguiente se rellena después con un segundo setWin que
  // conserva `start`; mientras tanto el motor lee solo la primera página y
  // espera el relleno sin declarar el fin del libro. El ancla deja la vista
  // en su sitio durante el intercambio (sin reacomodo visible).
  const slide = useCallback(
    (rebase: number) => {
      const cur = winRef.current;
      if (!cur || !cur.pages[1]) return;
      const nextStart = cur.start + 1;
      const first = cur.pages[1];
      allowCrossRef.current = false;
      // ancla: el primer carácter sin encender de la página nueva (índice
      // `rebase` en la ventana nueva) queda donde está ahora en la columna
      stageViewAnchor(firstLen + rebase, rebase);
      litRef.current = rebase;
      setLit(rebase);
      setPageDone(false);
      setBookDone(false);
      onGoToPageRef.current(nextStart);
      const opened: StreamWindow = { start: nextStart, pages: [first, null] };
      winRef.current = opened;
      setWin(opened);
      void (async () => {
        const nextBlocks = nextStart + 1 <= numPages ? await loadBlocks(nextStart + 1) : null;
        if (winRef.current !== opened) return; // el lector ya rebobinó: no clobbers con la ventana vieja
        const filled: StreamWindow = { start: nextStart, pages: [first, nextBlocks] };
        winRef.current = filled;
        setWin(filled);
        // precarga silenciosa: el próximo cruce no espera extracción
        if (nextStart + 2 <= numPages) void loadBlocks(nextStart + 2);
      })();
    },
    [firstLen, loadBlocks, numPages, setWin, stageViewAnchor, winRef]
  );

  // ---------- motor de encendido ----------
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !win || totalChars === 0) return;
    const spans = Array.from(root.querySelectorAll<HTMLSpanElement>(".tp-ch"));
    if (spans.length === 0) return;
    spansRef.current = spans;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = wps == null || reduced;
    const paint = (n: number) => spans.forEach((s, k) => s.classList.toggle("on", k < n));
    const syncHeadings = (n: number) => {
      for (const b of stream.blocks) {
        if (!b.heading) continue;
        spans[b.start]?.closest<HTMLElement>(".tp-block")?.classList.toggle("on", n > b.start);
      }
    };

    // Instantánea o movimiento reducido: la página actual entera, sin animación.
    if (instant) {
      const reveal = () => {
        if (cancelled) return;
        const end = win.pages[1] ? firstLen : totalChars;
        paint(end);
        syncHeadings(end);
        litRef.current = end;
        setLit(end);
        if (win.pages[1]) setPageDone(true);
        else setBookDone(true);
      };
      let cancelled = false;
      const timer = window.setTimeout(reveal, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    if (pageDone || bookDone || !playing) {
      paint(litRef.current);
      syncHeadings(litRef.current);
      return;
    }

    let cancelled = false;
    let timer = 0;
    let i = Math.min(litRef.current, spans.length);
    paint(i);
    syncHeadings(i);

    const headingAt = (idx: number) =>
      stream.blocks.find((b) => b.heading && idx >= b.start && idx < b.start + b.length);

    // hueco del cruce atómico: la página siguiente aún no entró en la ventana
    // pero el libro sigue — no declarar fin; el segundo setWin (relleno)
    // relanza el motor desde donde quedó
    const atWindowGap = () => !win.pages[1] && win.start < numPages;

    const step = () => {
      if (cancelled) return;
      // un avance manual puede haber movido el encendido: el motor sigue desde
      // ahí en vez de volver a iluminar por detrás
      if (litRef.current > i) i = litRef.current;
      // cruce ANTES de encender: si el flujo ya llegó al fin de la página, la
      // ventana se desliza sin encender caracteres de la página nueva contra
      // el DOM viejo (la orden de cámara del cruce la pone el ancla, no el motor)
      if (win.pages[1] && i >= firstLen) {
        if (!auto && !allowCrossRef.current) {
          setPageDone(true);
          return;
        }
        slide(i - firstLen);
        return;
      }
      if (i >= spans.length) {
        if (atWindowGap()) return;
        setBookDone(true);
        return;
      }
      // el título se enciende completo (fundido del bloque, no letra a letra)
      const heading = headingAt(i);
      const end = heading ? heading.start + heading.length : i + 1;
      for (let k = i; k < end; k++) spans[k]?.classList.add("on");
      if (heading) spans[i]?.closest<HTMLElement>(".tp-block")?.classList.add("on");
      if (stream.steps[i]?.char.trim()) tick();

      // la orden de vista de un título ancla el INICIO del bloque en la zona
      // cómoda: la cámara no se sumerge el alto del bloque entero
      scrollToChar(heading ? heading.start : end - 1);
      i = end;
      litRef.current = i;
      setLit(i);

      if (i >= spans.length) {
        if (atWindowGap()) return;
        setBookDone(true);
        return;
      }
      schedule(delayAt(i));
    };

    /** Espera planeada del paso que empieza en `idx`: con Auto, el cruce de
        página espera `TELEPROMPTER_PAGE_TURN_MS` (cambio no brusco) */
    function delayAt(idx: number) {
      return plannedStepDelay({
        lit: idx,
        firstLen,
        hasNext: !!win?.pages[1],
        auto,
        allowCross: allowCrossRef.current,
        stepDelay: stream.steps[idx]?.delay ?? 40,
        turnMs: TELEPROMPTER_PAGE_TURN_MS,
      });
    }

    /** Programa el próximo paso y anota cuándo vence (ver `dueRef`) */
    function schedule(delay: number) {
      dueRef.current = { at: performance.now() + delay, lit: i, win };
      timer = window.setTimeout(step, delay);
    }
    // arranque o reinicio del efecto: si el paso pendiente es el mismo, solo
    // espera lo que le faltaba
    schedule(stepWait(delayAt(i), dueRef.current, i, win, performance.now()));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [win, stream, totalChars, firstLen, numPages, playing, pageDone, bookDone, auto, wps, tick, scrollToChar, slide]);

  // ---------- Auto: al agotar la página sigue sola ----------
  useEffect(() => {
    if (!auto || !playing || bookDone) return;
    if (!pageDone) return;
    // misma pausa que el cruce con Auto: el cambio de página nunca es brusco
    const delay = TELEPROMPTER_PAGE_TURN_MS;
    const timer = window.setTimeout(() => {
      allowCrossRef.current = true;
      setPageDone(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [auto, playing, pageDone, bookDone]);

  // ---------- avance manual de una letra ----------
  /**
   * `→`: enciende UN carácter más (si cae dentro de un título, enciende el
   * bloque entero, como ya hace el motor) y lleva la vista al carácter
   * nuevo. El avance automático se pausa: la orden manual manda. Al final de
   * la página no hace nada — ese gesto es el salto de página.
   */
  const stepForward = useCallback(() => {
    const spans = spansRef.current;
    const cur = litRef.current;
    if (spans.length === 0 || cur >= firstLen || cur >= spans.length) return;
    setPlaying(false);
    const heading = stream.blocks.find((b) => b.heading && cur >= b.start && cur < b.start + b.length);
    const end = heading ? heading.start + heading.length : cur + 1;
    for (let k = cur; k < end; k++) spans[k]?.classList.add("on");
    if (heading) spans[heading.start]?.closest<HTMLElement>(".tp-block")?.classList.add("on");
    litRef.current = end;
    setLit(end);
    scrollToChar(end - 1);
  }, [firstLen, scrollToChar, spansRef, stream]);

  /** `Shift+→`: salto a la página siguiente (el cruce atómico, sin esperar al motor) */
  const goToNextPage = useCallback(() => {
    const cur = winRef.current;
    if (!cur || !cur.pages[1]) return; // no hay página siguiente en la ventana
    setPlaying(true);
    slide(0);
  }, [slide, winRef]);

  // ---------- rebobinado ----------
  const loadPreviousPage = useCallback(() => {
    const cur = winRef.current;
    if (!cur || cur.start <= 1) return;
    const prev = cur.start - 1;
    setPlaying(false);
    void (async () => {
      const blocks = await loadBlocks(prev);
      const all = teleprompterCharCount(blocks);
      // ancla del prepend: el carácter activo (índice + prevLen en la ventana
      // nueva) queda donde está — la columna no se reacomoda al retroceder
      stageViewAnchor(litRef.current, litRef.current + all);
      const next: StreamWindow = { start: prev, pages: [blocks, cur.pages[0]] };
      winRef.current = next;
      litRef.current = all;
      setWin(next);
      setLit(all);
      setPageDone(false);
      setBookDone(false);
      onGoToPageRef.current(prev);
    })();
  }, [loadBlocks, setWin, stageViewAnchor, winRef]);

  /** `Shift+←`: salto a la página anterior (completa y encendida, lista para releer) */
  const goToPrevPage = useCallback(() => {
    loadPreviousPage();
  }, [loadPreviousPage]);

  const rewindOne = useCallback(() => {
    const cur = winRef.current;
    if (!cur) return;
    const next = teleprompterRewind({ page: cur.start, lit: litRef.current });
    if (!next) return;
    if (next.lit === -1) {
      loadPreviousPage();
      return;
    }
    setPlaying(false);
    setPageDone(false);
    setBookDone(false);
    const spans = spansRef.current;
    let to = next.lit;
    // a un título se entra de golpe: al rebobinar dentro, se apaga entero
    const heading = stream.blocks.find((b) => b.heading && to > b.start && to < b.start + b.length);
    if (heading) to = heading.start;
    for (let k = to; k < litRef.current; k++) spans[k]?.classList.remove("on");
    for (const b of stream.blocks) {
      if (b.heading && to <= b.start) {
        spans[b.start]?.closest<HTMLElement>(".tp-block")?.classList.remove("on");
      }
    }
    litRef.current = to;
    setLit(to);
    // rebobinado: cámara directa, sin la animación del avance (ver design.md)
    scrollToChar(Math.max(0, to - 1), { instant: true });
  }, [stream, loadPreviousPage, scrollToChar, spansRef, winRef]);

  // ---------- avance ----------
  const forward = useCallback(() => {
    if (bookDone) return;
    if (pageDone) {
      allowCrossRef.current = true;
      setPageDone(false);
      setPlaying(true);
      return;
    }
    if (!playing) {
      setPlaying(true);
      return;
    }
    // en marcha: completar la página actual de golpe
    const spans = spansRef.current;
    const end = win?.pages[1] ? firstLen : totalChars;
    for (let k = litRef.current; k < end; k++) spans[k]?.classList.add("on");
    for (const b of stream.blocks) {
      if (b.heading && end > b.start) {
        spans[b.start]?.closest<HTMLElement>(".tp-block")?.classList.add("on");
      }
    }
    litRef.current = end;
    setLit(end);
    // Revelado completo SIN orden de vista: el resto del texto se enciende
    // donde está y la columna queda donde el lector lee — sin barrido al fondo
    // de la página. El cruce posterior re-ancla la vista con el ancla atómica.
    if (win?.pages[1]) setPageDone(true);
    else setBookDone(true);
  }, [bookDone, pageDone, playing, win, firstLen, totalChars, stream, spansRef]);

  return { lit, playing, setPlaying, pageDone, bookDone, forward, rewindOne, stepForward, goToNextPage, goToPrevPage };
}
