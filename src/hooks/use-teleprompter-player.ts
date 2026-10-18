"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { teleprompterRewind, teleprompterCharCount, type TeleprompterBlock } from "@/lib/teleprompter";
import { TELEPROMPTER_LETTERS_PER_WORD } from "@/lib/teleprompter";
import type { StreamWindow } from "@/hooks/use-teleprompter-window";

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
  /** gira la página real del lector (cuenta como lectura y hitos) */
  onGoToPage: (page: number) => void;
  stream: ReturnType<typeof import("@/lib/teleprompter").buildTeleprompterStream>;
  firstLen: number;
  totalChars: number;
  spansRef: React.RefObject<HTMLSpanElement[]>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  scrollToChar: (idx: number) => void;
  /** Auto: al agotar la página sigue sola */
  auto: boolean;
  /** wps del preset activo (null = instantáneo) */
  presetWps: number | null;
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
  onGoToPage,
  stream,
  firstLen,
  totalChars,
  spansRef,
  scrollRef,
  scrollToChar,
  auto,
  presetWps,
  tick,
}: UseTeleprompterPlayerOpts) {
  const [lit, setLit] = useState(0);
  const [playing, setPlaying] = useState(true);
  /** la página actual se agotó: sin Auto espera la orden */
  const [pageDone, setPageDone] = useState(false);
  const [bookDone, setBookDone] = useState(false);
  const litRef = useRef(0);
  const allowCrossRef = useRef(false);

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
      if (start !== pageNum) onGoToPage(start);
    })();
    return () => {
      alive = false;
    };
  }, [pageNum, numPages, loadBlocks, onGoToPage, sourceKey, setWin, winRef, winSourceRef]);

  // ---------- deslizar la ventana al cruzar de página ----------
  const slide = useCallback(
    (rebase: number) => {
      const cur = winRef.current;
      if (!cur || !cur.pages[1]) return;
      const nextStart = cur.start + 1;
      const first = cur.pages[1];
      allowCrossRef.current = false;
      litRef.current = rebase;
      setLit(rebase);
      setPageDone(false);
      setBookDone(false);
      onGoToPage(nextStart);
      void (async () => {
        const nextBlocks = nextStart + 1 <= numPages ? await loadBlocks(nextStart + 1) : null;
        const next: StreamWindow = { start: nextStart, pages: [first, nextBlocks] };
        winRef.current = next;
        setWin(next);
        // precarga silenciosa: el próximo cruce no espera extracción
        if (nextStart + 2 <= numPages) void loadBlocks(nextStart + 2);
      })();
    },
    [loadBlocks, numPages, onGoToPage, setWin, winRef]
  );

  // ---------- motor de encendido ----------
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !win || totalChars === 0) return;
    const spans = Array.from(root.querySelectorAll<HTMLSpanElement>(".tp-ch"));
    if (spans.length === 0) return;
    spansRef.current = spans;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = presetWps == null || reduced;
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

    const step = () => {
      if (cancelled) return;
      if (i >= spans.length) {
        setBookDone(true);
        return;
      }
      // el título se enciende completo (fundido del bloque, no letra a letra)
      const heading = headingAt(i);
      const end = heading ? heading.start + heading.length : i + 1;
      for (let k = i; k < end; k++) spans[k]?.classList.add("on");
      if (heading) spans[i]?.closest<HTMLElement>(".tp-block")?.classList.add("on");
      if (stream.steps[i]?.char.trim()) tick();

      i = end;
      litRef.current = i;
      setLit(i);
      scrollToChar(i - 1);

      if (i >= spans.length) {
        setBookDone(true);
        return;
      }
      // fin de la página de la ventana: encadenar o esperar la orden
      if (win.pages[1] && i >= firstLen) {
        if (!auto && !allowCrossRef.current) {
          setPageDone(true);
          return;
        }
        slide(i - firstLen);
        return;
      }
      timer = window.setTimeout(step, Math.max(8, stream.steps[i]?.delay ?? 40));
    };

    timer = window.setTimeout(step, Math.max(8, stream.steps[i]?.delay ?? 40));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [win, stream, totalChars, firstLen, playing, pageDone, bookDone, auto, presetWps, tick, scrollToChar, slide]);

  // ---------- Auto: al agotar la página sigue sola ----------
  useEffect(() => {
    if (!auto || !playing || bookDone) return;
    if (!pageDone) return;
    const base = presetWps ? 1000 / (presetWps * TELEPROMPTER_LETTERS_PER_WORD) : 0;
    const delay = presetWps ? Math.min(1800, Math.max(650, base * 10)) : 380;
    const timer = window.setTimeout(() => {
      allowCrossRef.current = true;
      setPageDone(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [auto, playing, pageDone, bookDone, presetWps]);

  // ---------- rebobinado ----------
  const loadPreviousPage = useCallback(() => {
    const cur = winRef.current;
    if (!cur || cur.start <= 1) return;
    const prev = cur.start - 1;
    setPlaying(false);
    void (async () => {
      const blocks = await loadBlocks(prev);
      const all = teleprompterCharCount(blocks);
      const next: StreamWindow = { start: prev, pages: [blocks, cur.pages[0]] };
      winRef.current = next;
      litRef.current = all;
      setWin(next);
      setLit(all);
      setPageDone(false);
      setBookDone(false);
      onGoToPage(prev);
    })();
  }, [loadBlocks, onGoToPage, setWin, winRef]);

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
    scrollToChar(Math.max(0, to - 1));
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
    scrollToChar(Math.max(0, end - 1));
    if (win?.pages[1]) setPageDone(true);
    else setBookDone(true);
  }, [bookDone, pageDone, playing, win, firstLen, totalChars, stream, scrollToChar, spansRef]);

  return { lit, playing, setPlaying, pageDone, bookDone, forward, rewindOne };
}
