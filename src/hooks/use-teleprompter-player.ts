"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  teleprompterRewind,
  teleprompterCharCount,
  teleprompterPageEnd,
  teleprompterPageContaining,
  teleprompterPrunableLimit,
  msPorUnidad,
  type TeleprompterBlock,
} from "@/core/teleprompter";
import { TELEPROMPTER_PAGE_TURN_MS } from "@/core/teleprompter";
import { TELEPROMPTER_WPS_DEFAULT } from "@/core/types";
import type { StreamWindow } from "@/hooks/use-teleprompter-window";
import { stepWait, type PendingStep } from "@/core/step-timer";

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
  stream: ReturnType<typeof import("@/core/teleprompter").buildTeleprompterStream>;
  /** offsets acumulados de caracteres por página de la ventana (el mapa del
      cruce sin evento: dónde empieza y acaba cada página en los spans) */
  pageOffsets: number[];
  /** mide cuántas páginas del frente de la ventana ya salieron del encuadre */
  pruneMeasure: (limit: number) => number;
  totalChars: number;
  spansRef: React.RefObject<HTMLSpanElement[]>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  scrollToChar: (idx: number, opts?: { instant?: boolean }) => void;
  /** publica el ancla de vista para el próximo cambio de ventana (sin reacomodo) */
  stageViewAnchor: (oldIndex: number, newIndex: number) => void;
  /** Auto: al agotar la página sigue sola */
  auto: boolean;
  /** palabras por segundo activas (null = Instantánea). SOLO el paso null↔número
      reinicia el motor: los cambios en vivo los lee delayAt por ref */
  wps: number | null;
  /** tic de tipeo (WebAudio); ya filtrado por el ajuste de sonido */
  tick: () => void;
}

/**
 * Control de reproducción del teleprompter (pausa/reanudar, rebobinado, cruce
 * de página y encadenado) más el motor de encendido letra a letra.
 *
 * CRUCE SIN EVENTO (teleprompter-cruce-sin-evento): la ventana es una columna
 * viva. Al agotar una página NO se intercambia nada — la página nueva ya está
 * debajo (appendNext la añade al entrar en la última cargada, por debajo de la
 * vista) y el texto leído permanece encima: es el SCROLL el que lo saca de
 * vista a ritmo de lectura. La poda frontal ocurre mucho después, cuando el
 * pie de una página leída lleva fuera del encuadre un margen de respeto: el
 * ancla compensa el scroll antes del pintado y ni un píxel salta. Sin Auto el
 * flujo se detiene al final de cada página (pageDone) y espera la orden del
 * lector; con Auto continúa a ritmo normal. La única espera extra al agotar
 * la página es la del revelado instantáneo con Auto (pageDone): ahí no hay
 * ritmo de letras que proteger.
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
  pageOffsets,
  pruneMeasure,
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
  /** Cuántos spans leading están encendidos en el DOM VIVO (última cifra que
      `paint` dejó aplicada). Guardar la cifra evita el repaso masivo: cada
      re-arranque del motor (append, pausa, poda) volvía a recorrer TODOS los
      spans de la columna (miles) con classList.toggle y ese churn de estilos
      en el WebView del APK borra el texto un instante — el parpadeo «las
      letras desaparecen y vuelven» que se ve en el teléfono. Hoy el repaso
      solo corre cuando la cifra real cambia; el DOM ya está correcto porque
      las claves por página preservan los nodos (y sus clases) al podar. */
  const paintedRef = useRef(-1);
  /** límites de página ya cruzados por el flujo (índice 0-based en la ventana):
      la página que contiene el carácter activo YA fue anunciada */
  const crossedRef = useRef(0);
  /** última página real anunciada al lector: evita doble conteo al cruzar de
      ida y vuelta por la misma frontera (rebobinado y re-lectura) */
  const lastFiredRef = useRef<number | null>(null);
  // Velocidad ACTIVA leída por ref (change fluidez-velocidad): arrastrar el
  // slider de wps NO reinicia el motor — el efecto no depende de `wps` y el
  // ritmo nuevo entra con la letra siguiente. Solo el paso a Instantánea
  // (null ↔ número) reinicia, porque cambia el MODO de encendido.
  const wpsRef = useRef(wps);
  useEffect(() => {
    wpsRef.current = wps;
  }, [wps]);
  /** modo de encendido (Instantánea): su flip SÍ reinicia el motor, el drag
      del slider NO (ver deps del efecto de encendido) */
  const instante = wps == null;
  // El callback del lector se lee por ref: su identidad nunca debe reiniciar
  // el motor ni recrear `appendNext` (defensa ante un padre que no lo memoice).
  const onGoToPageRef = useRef(onGoToPage);
  useEffect(() => {
    onGoToPageRef.current = onGoToPage;
  }, [onGoToPage]);
  // Próximo paso del motor: instante en que vence y a qué letra corresponde.
  // Si el efecto se reinicia (cualquier dependencia que cambie) la espera ya
  // transcurrida no se pierde: una pausa larga no puede quedar siempre a medias.
  const dueRef = useRef<PendingStep<StreamWindow> | null>(null);

  // ---------- ventana: reconstrucción solo si el lector sale de ella ----------
  useEffect(() => {
    const cur = winRef.current;
    // la ventana viva cubre varias páginas (leídas + en curso + siguiente):
    // mientras la página pedida viva dentro, la columna NO se reconstruye
    if (
      cur &&
      winSourceRef.current === sourceKey &&
      pageNum >= cur.start &&
      pageNum <= cur.start + cur.pages.length - 1
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
      // DOM nuevo (nodos recién montados, todo apagado): forzar un repaso
      paintedRef.current = -1;
      crossedRef.current = 0;
      lastFiredRef.current = start;
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

  // ---------- añadir la página siguiente DEBAJO de la columna ----------
  /**
   * El append es el cruce sin evento: la página nueva entra AL FINAL de la
   * columna, por debajo de la vista — nada de lo visible se mueve ni un
   * píxel. Se llama al ENTRAR en la última página cargada: la siguiente se
   * carga mientras se lee la actual (mismo prefetch que el cruce antiguo,
   * pero sin intercambio de ventana). El relleno usa la geometría VIVA de la
   * ventana: una poda frontal en el ínterin no estropea la ranura.
   */
  const appendNext = useCallback(() => {
    const cur = winRef.current;
    if (!cur) return;
    if (cur.pages[cur.pages.length - 1] == null) return; // ya hay una cargando
    const nextPage = cur.start + cur.pages.length;
    if (nextPage > numPages) return;
    const opened: StreamWindow = { start: cur.start, pages: [...cur.pages, null] };
    winRef.current = opened;
    setWin(opened);
    void loadBlocks(nextPage).then((blocks) => {
      const live = winRef.current;
      if (!live) return; // el lector saltó a otra parte: nada que rellenar
      const idx = nextPage - live.start;
      if (idx < 0 || idx >= live.pages.length || live.pages[idx] != null) return;
      const pages = live.pages.slice();
      pages[idx] = blocks;
      const filled: StreamWindow = { start: live.start, pages };
      winRef.current = filled;
      setWin(filled);
    });
  }, [loadBlocks, numPages, setWin, winRef]);

  // ---------- anuncio de progreso al entrar en una página nueva ----------
  /**
   * Cruce de página REAL: solo progreso y prefetch — ningún cambio de DOM.
   * Cuenta los límites superados por el encendido y anuncia cada página
   * nueva una sola vez (ida y vuelta por la misma frontera no duplica el
   * conteo del lector). Al entrar en la última página cargada arma la carga
   * de la siguiente.
   */
  const crossBoundaries = useCallback(
    (i: number) => {
      const cur = winRef.current;
      if (!cur) return;
      let crossed = crossedRef.current;
      while (crossed < pageOffsets.length - 1 && i >= (pageOffsets[crossed + 1] ?? Infinity)) {
        crossed += 1;
        const page = cur.start + crossed;
        if (lastFiredRef.current !== page) {
          lastFiredRef.current = page;
          onGoToPageRef.current(page);
        }
      }
      crossedRef.current = crossed;
      if (crossed >= cur.pages.length - 1) appendNext();
    },
    [appendNext, pageOffsets, winRef]
  );

  // ---------- poda frontal invisible ----------
  /**
   * Quita del FRENTE las páginas leídas cuyo pie ya salió del encuadre (con
   * margen de respeto): el texto leído se va porque el scroll lo escondió,
   * NUNCA por un evento del flujo. El ancla deja el primer carácter retenido
   * donde está y la compensación corre antes del pintado — la poda es
   * imperceptible. Devuelve cuántas páginas se podaron (> 0: el motor se
   * re-arranca con los índices ya reasentados, sin perder la espera pendiente).
   */
  const pruneFront = useCallback((): number => {
    const cur = winRef.current;
    if (!cur || cur.pages.length <= 1) return 0;
    const limit = teleprompterPrunableLimit(pageOffsets, litRef.current);
    const cut = pruneMeasure(limit);
    if (cut <= 0) return 0;
    const prunedLen = pageOffsets[cut] ?? 0;
    // ancla: el primer carácter de la primera página retenida queda donde está
    stageViewAnchor(prunedLen, 0);
    litRef.current = Math.max(0, litRef.current - prunedLen);
    setLit(litRef.current);
    // La poda NO toca clases: los nodos retenidos conservan su encendido y sus
    // índices se reasientan igual que litRef — el repaso del motor se puede
    // saltar (guardia del paint) y la poda ni parpadea.
    paintedRef.current = litRef.current;
    crossedRef.current = Math.max(0, crossedRef.current - cut);
    const next: StreamWindow = { start: cur.start + cut, pages: cur.pages.slice(cut) };
    winRef.current = next;
    if (dueRef.current) {
      dueRef.current = {
        at: dueRef.current.at,
        lit: Math.max(0, dueRef.current.lit - prunedLen),
        win: next,
      };
    }
    setWin(next);
    return cut;
  }, [pageOffsets, pruneMeasure, setWin, stageViewAnchor, winRef]);

  // ---------- motor de encendido ----------
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !win || totalChars === 0) return;
    const spans = Array.from(root.querySelectorAll<HTMLSpanElement>(".tp-ch"));
    if (spans.length === 0) return;
    spansRef.current = spans;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = instante || reduced;
    // Pintado con guardia: si la cifra del DOM vivo ya es `n`, no se toca un
    // solo span. El parpadeo del APK era este repaso sin guardia en cada
    // re-arranque del efecto (append/prune/pausa re-corren el efecto).
    const paint = (n: number) => {
      if (paintedRef.current === n) return;
      spans.forEach((s, k) => s.classList.toggle("on", k < n));
      paintedRef.current = n;
    };
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
        const end = teleprompterPageEnd(pageOffsets, litRef.current);
        if (end > litRef.current) {
          // anunciar las páginas que entran a revelarse (el cruce sin evento
          // también vive aquí) y armar la carga de la siguiente
          crossBoundaries(end - 1);
          paint(end);
          syncHeadings(end);
          litRef.current = end;
          setLit(end);
        } else if (
          win.start + teleprompterPageContaining(pageOffsets, litRef.current) < numPages
        ) {
          // borde de la ventana con libro por delante: nada que revelar —
          // traer la página siguiente (idempotente) y el relleno re-arma
          appendNext();
        }
        if (win.start + teleprompterPageContaining(pageOffsets, litRef.current) < numPages) {
          setPageDone(true);
        } else {
          setBookDone(true);
        }
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

    // hueco al final de la ventana: la siguiente aún carga pero el libro sigue
    // — no declarar fin; el relleno relanza el motor desde donde quedó
    const atWindowGap = () =>
      win.pages[win.pages.length - 1] == null && win.start + win.pages.length - 1 < numPages;

    const step = () => {
      if (cancelled) return;
      // un avance manual puede haber movido el encendido: el motor sigue desde
      // ahí en vez de volver a iluminar por detrás
      if (litRef.current > i) i = litRef.current;
      // poda invisible (solo fuera de encuadre): si podó, la ventana cambió de
      // identidad y el efecto re-arranca con los índices ya reasentados
      if (pruneFront() > 0) return;
      if (i >= spans.length) {
        if (atWindowGap()) return;
        setBookDone(true);
        return;
      }
      // sin Auto: al alcanzar el final de la página el flujo espera la orden
      // (el gesto de página es del lector — no se anuncia la siguiente hasta
      // cruzar de verdad). La última página del libro no espera: bookDone arriba.
      if (!auto) {
        const end = pageOffsets[crossedRef.current + 1];
        if (end != null && i >= end) {
          setPageDone(true);
          return;
        }
      }
      // cruce de página: SOLO progreso y prefetch — la página nueva ya está
      // debajo, el texto leído sigue encima y el scroll lo va escondiendo
      crossBoundaries(i);
      // el título se enciende completo (fundido del bloque, no letra a letra)
      const heading = headingAt(i);
      const end = heading ? heading.start + heading.length : i + 1;
      for (let k = i; k < end; k++) spans[k]?.classList.add("on");
      if (heading) spans[i]?.closest<HTMLElement>(".tp-block")?.classList.add("on");
      if (stream.steps[i]?.char.trim()) tick();
      paintedRef.current = end;

      // la orden de vista de un título ancla el INICIO del bloque en la zona
      // cómoda: la cámara no se sumerge el alto del bloque entero
      scrollToChar(heading ? heading.start : end - 1);
      i = end;
      litRef.current = i;
      setLit(i);

      schedule(delayAt(i));
    };

    /** Espera planeada del paso que empieza en `idx`: unidades de tempo → ms
        con el wps ACTIVO (leído por ref: la velocidad se cambia en vivo), o
        la espera absoluta de una tarjeta de imagen. El cruce de página NO
        paga espera extra: corre al ritmo del carácter (flujo continuo, la
        página no es un evento — teleprompter-cruce-sin-evento) */
    function delayAt(idx: number) {
      const paso = stream.steps[idx];
      return (
        paso?.holdMs ??
        (paso ? paso.units * msPorUnidad(wpsRef.current ?? TELEPROMPTER_WPS_DEFAULT) : 40)
      );
    }

    /** Programa el próximo paso y anota cuándo vence (ver `dueRef`) */
    function schedule(delay: number) {
      dueRef.current = { at: performance.now() + delay, lit: i, win };
      timer = window.setTimeout(step, delay);
    }
    // arranque o reinicio del efecto: si el paso pendiente es el mismo, solo
    // espera lo que faltaba
    schedule(stepWait(delayAt(i), dueRef.current, i, win, performance.now()));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [win, stream, totalChars, pageOffsets, numPages, playing, pageDone, bookDone, auto, instante, tick, scrollToChar, pruneFront, crossBoundaries, scrollRef, spansRef]);

  // ---------- Auto: el revelado instantáneo descansa antes de seguir ----------
  useEffect(() => {
    if (!auto || !playing || bookDone) return;
    if (!pageDone) return;
    // Instantánea con Auto: la página ya está revelada y no hay ritmo de
    // letras que proteger — un compás de quietud antes de continuar. Con la
    // columna viva no hay cruce que dar: pasado el compás, el motor sigue con
    // los caracteres de la página siguiente, que ya están debajo.
    const delay = TELEPROMPTER_PAGE_TURN_MS;
    const timer = window.setTimeout(() => {
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
    // límite: el final de la página que el flujo tiene en curso — la frontera
    // se cruza con Shift+→ (o forward), no letra a letra
    const limit = pageOffsets[crossedRef.current + 1] ?? totalChars;
    if (spans.length === 0 || cur >= limit || cur >= spans.length) return;
    setPlaying(false);
    const heading = stream.blocks.find((b) => b.heading && cur >= b.start && cur < b.start + b.length);
    const end = heading ? heading.start + heading.length : cur + 1;
    for (let k = cur; k < end; k++) spans[k]?.classList.add("on");
    if (heading) spans[heading.start]?.closest<HTMLElement>(".tp-block")?.classList.add("on");
    litRef.current = end;
    paintedRef.current = end;
    setLit(end);
    scrollToChar(end - 1);
  }, [pageOffsets, scrollToChar, spansRef, stream, totalChars]);

  /** `Shift+→`: salto a la página siguiente. Sin cruce de DOM: enciende el
      resto de la página en curso (ya está en la columna), anuncia la
      siguiente y deja que el flujo continúe — la cámara lleva la vista al
      primer carácter sin encender y el texto saltado se va por el scroll. */
  const goToNextPage = useCallback(() => {
    const cur = winRef.current;
    if (!cur) return;
    // hueco de carga al final de la ventana: la orden se traga (como antes)
    // y el relleno relanza el flujo — milisegundos, no una página
    if (cur.pages[cur.pages.length - 1] == null && cur.start + cur.pages.length - 1 < numPages) {
      return;
    }
    const spans = spansRef.current;
    const end = Math.min(pageOffsets[crossedRef.current + 1] ?? totalChars, spans.length);
    for (let k = litRef.current; k < end; k++) spans[k]?.classList.add("on");
    for (const b of stream.blocks) {
      if (b.heading && end > b.start && b.start >= litRef.current) {
        spans[b.start]?.closest<HTMLElement>(".tp-block")?.classList.add("on");
      }
    }
    litRef.current = end;
    paintedRef.current = end;
    setLit(end);
    crossBoundaries(litRef.current);
    setPageDone(false);
    setPlaying(true);
  }, [crossBoundaries, numPages, pageOffsets, setLit, spansRef, stream, totalChars, winRef]);

  // ---------- rebobinado ----------
  const loadPreviousPage = useCallback(() => {
    const cur = winRef.current;
    if (!cur || cur.start <= 1) return;
    const prev = cur.start - 1;
    setPlaying(false);
    void (async () => {
      const blocks = await loadBlocks(prev);
      const all = teleprompterCharCount(blocks);
      // ancla del prepend: el PUNTO DE REANUDACIÓN (inicio de la página que
      // estaba en curso, índice `all` en la ventana nueva) aterriza donde está
      // ahora el carácter activo (zona cómoda) — la lectora vuelve una página
      // y la ve desde arriba, con la anterior encendida para releer
      stageViewAnchor(litRef.current, all);
      const next: StreamWindow = { start: prev, pages: [blocks, ...cur.pages] };
      winRef.current = next;
      litRef.current = all;
      // página PREPENDIDA: sus nodos son nuevos y salen apagados — hay que
      // encenderlos (relectura completa), forzar el repaso una vez
      paintedRef.current = -1;
      setWin(next);
      setLit(all);
      setPageDone(false);
      setBookDone(false);
      // el flujo queda al inicio de la página 1 de la ventana (la anterior
      // entera, encendida para releer): una frontera cruzada, la vista en prev
      crossedRef.current = 1;
      lastFiredRef.current = prev;
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
    paintedRef.current = to;
    setLit(to);
    // el encendido volvió atrás: las fronteras que quedaron por delante del
    // carácter activo se vuelven a cruzar (y a anunciar) al re-leerlas
    while (crossedRef.current > 0 && to <= (pageOffsets[crossedRef.current] ?? 0)) {
      crossedRef.current -= 1;
    }
    // rebobinado: cámara directa, sin la animación del avance (ver design.md)
    scrollToChar(Math.max(0, to - 1), { instant: true });
  }, [stream, loadPreviousPage, scrollToChar, spansRef, winRef, pageOffsets]);

  // ---------- avance ----------
  const forward = useCallback(() => {
    if (bookDone) return;
    if (pageDone) {
      // orden de cruce del lector: se anuncia la página nueva (ya está debajo)
      // y el flujo sigue — nada de DOM, nada de anclas
      crossBoundaries(litRef.current);
      setPageDone(false);
      setPlaying(true);
      return;
    }
    if (!playing) {
      setPlaying(true);
      return;
    }
    // en marcha: completar la página actual de golpe (el texto ya está en la
    // columna — completar es encender, no traer nada)
    const spans = spansRef.current;
    const end = Math.min(pageOffsets[crossedRef.current + 1] ?? totalChars, spans.length);
    for (let k = litRef.current; k < end; k++) spans[k]?.classList.add("on");
    for (const b of stream.blocks) {
      if (b.heading && end > b.start) {
        spans[b.start]?.closest<HTMLElement>(".tp-block")?.classList.add("on");
      }
    }
    litRef.current = end;
    paintedRef.current = end;
    setLit(end);
    // Revelado completo SIN orden de vista: el resto del texto se enciende
    // donde está y la columna queda donde el lector lee. Con Auto viene el
    // compás de quietud (pageDone) y el flujo sigue solo; sin Auto, espera.
    if (win && win.start + crossedRef.current < numPages) setPageDone(true);
    else setBookDone(true);
  }, [bookDone, pageDone, playing, win, crossBoundaries, numPages, pageOffsets, totalChars, stream, spansRef]);

  return { lit, playing, setPlaying, pageDone, bookDone, forward, rewindOne, stepForward, goToNextPage, goToPrevPage };
}
