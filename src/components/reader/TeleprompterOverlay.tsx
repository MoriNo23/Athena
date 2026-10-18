"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tip } from "@/components/reader/ZoomControls";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  Maximize,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import {
  TELEPROMPTER_SPEED_PRESETS,
  teleprompterPresetById,
  clampTeleprompterFontScale,
  TELEPROMPTER_FONT_MAX,
  TELEPROMPTER_FONT_MIN,
  TELEPROMPTER_FONT_STEP,
} from "@/lib/types";
import {
  TELEPROMPTER_LETTERS_PER_WORD,
  buildTeleprompterStream,
  extractPdfPageBlocksForTeleprompter,
  teleprompterCharCount,
  teleprompterRewind,
  type TeleprompterBlock,
} from "@/lib/teleprompter";
import type { BookDTO } from "@/lib/types";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/utils";

interface TeleprompterOverlayProps {
  book: BookDTO;
  doc: PDFDocumentProxy | null;
  /** EPUB: bloques reales de la página (h1-h4 en el flujo) */
  getPageBlocks?: (page: number) => Promise<TeleprompterBlock[]>;
  pageNum: number;
  numPages: number;
  /**
   * Dominio de páginas que alimenta el flujo ("pdf" | "text" | "epub"): si
   * cambia con el overlay abierto, la ventana se reconstruye en la página
   * nueva aunque el número coincida (texto virtual y página real no son lo
   * mismo).
   */
  sourceKey: string;
  /** gira la página real del lector (cuenta como lectura y hitos) */
  onGoToPage: (page: number) => void;
  onClose: () => void;
}

/** Ventana de lectura: la página actual y la siguiente (DOM acotado a dos) */
interface StreamWindow {
  /** primera página de la ventana (1-based) */
  start: number;
  /** [página start, página start+1]; el segundo hueco puede no existir */
  pages: (TeleprompterBlock[] | null)[];
}

/** ms de quietud antes de que el teleprompter oculte su propia UI */
const TP_IDLE_MS = 3500;

/**
 * Modo teleprompter continuo: la página se lee como una columna única que sube
 * sola mientras las letras se encienden, con el carácter activo a ~40 % del
 * alto. La ventana mantiene dos páginas en el DOM: la actual y la siguiente,
 * así el encadenado con Auto no corta y el rebobinado puede volver atrás.
 */
export function TeleprompterOverlay({
  book,
  doc,
  getPageBlocks,
  pageNum,
  numPages,
  sourceKey,
  onGoToPage,
  onClose,
}: TeleprompterOverlayProps) {
  const tpSet = useSettings((s) => s.teleprompter);
  const setTeleprompter = useSettings((s) => s.setTeleprompter);
  const { t } = useI18n();
  const preset = teleprompterPresetById(tpSet.speedPreset);
  const auto = tpSet.auto;
  const fontScale = clampTeleprompterFontScale(tpSet.fontScale);
  const speedLabel = t(`speed.${preset.id}`);

  const changeFont = useCallback(
    (delta: number) => {
      setTeleprompter({
        fontScale: clampTeleprompterFontScale(fontScale + delta * TELEPROMPTER_FONT_STEP),
      });
    },
    [fontScale, setTeleprompter]
  );

  const [win, setWin] = useState<StreamWindow | null>(null);
  const [lit, setLit] = useState(0);
  const [playing, setPlaying] = useState(true);
  /** la página actual se agotó: sin Auto espera la orden */
  const [pageDone, setPageDone] = useState(false);
  const [bookDone, setBookDone] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const winRef = useRef<StreamWindow | null>(null);
  const winSourceRef = useRef<string | null>(null);
  const litRef = useRef(0);
  const spansRef = useRef<HTMLSpanElement[]>([]);
  const cacheRef = useRef<Map<number, TeleprompterBlock[]>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const allowCrossRef = useRef(false);
  const speedOpenRef = useRef(false);

  // ---------- carga de bloques (PDF: heurística compartida con el modo texto) ----
  const loadBlocks = useCallback(
    async (page: number): Promise<TeleprompterBlock[]> => {
      if (page < 1 || page > numPages) return [];
      const cached = cacheRef.current.get(page);
      if (cached) return cached;
      const blocks = getPageBlocks
        ? await getPageBlocks(page)
        : doc
          ? await extractPdfPageBlocksForTeleprompter(doc, page)
          : [];
      cacheRef.current.set(page, blocks);
      return blocks;
    },
    [getPageBlocks, doc, numPages]
  );

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
  }, [pageNum, numPages, loadBlocks, onGoToPage, sourceKey]);

  const windowBlocks = useMemo(
    () => (win ? [...(win.pages[0] ?? []), ...(win.pages[1] ?? [])] : []),
    [win]
  );
  const stream = useMemo(() => buildTeleprompterStream(windowBlocks, preset.wps), [windowBlocks, preset.wps]);
  const firstLen = useMemo(() => teleprompterCharCount(win?.pages[0] ?? []), [win]);
  const totalChars = stream.steps.length;
  /** la página pedida aún no está en la ventana: abriendo (derivado, sin efectos) */
  const stale = !win || pageNum < win.start || pageNum > win.start + 1;

  // ---------- spans del DOM (para encendido, scroll y rebobinado) ----------
  useEffect(() => {
    spansRef.current = Array.from(
      scrollRef.current?.querySelectorAll<HTMLSpanElement>(".tp-ch") ?? []
    );
  }, [win]);

  /** deja el carácter `idx` a ~40 % del alto visible */
  const scrollToChar = useCallback((idx: number) => {
    const root = scrollRef.current;
    const el = spansRef.current[idx];
    if (!root || !el) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    root.scrollTop += r.top - rr.top - root.clientHeight * 0.4;
  }, []);

  // ---------- tic de tipeo (WebAudio, muy bajo) ----------
  const tick = useCallback(() => {
    if (!tpSet.sound) return;
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        void ctx.resume();
        return; // no sonar hasta que el contexto despierte
      }
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1500 + Math.random() * 400;
      gain.gain.setValueAtTime(0.014, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.024);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.026);
    } catch {
      /* el sonido nunca debe romper la lectura */
    }
  }, [tpSet.sound]);

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
    [loadBlocks, numPages, onGoToPage]
  );

  // ---------- motor de encendido ----------
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !win || totalChars === 0) return;
    const spans = Array.from(root.querySelectorAll<HTMLSpanElement>(".tp-ch"));
    if (spans.length === 0) return;
    spansRef.current = spans;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = preset.wps == null || reduced;
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
  }, [win, stream, totalChars, firstLen, playing, pageDone, bookDone, auto, preset.wps, tick, scrollToChar, slide]);

  // ---------- Auto: al agotar la página sigue sola ----------
  useEffect(() => {
    if (!auto || !playing || bookDone) return;
    if (!pageDone) return;
    const wps = preset.wps;
    const base = wps ? 1000 / (wps * TELEPROMPTER_LETTERS_PER_WORD) : 0;
    const delay = wps ? Math.min(1800, Math.max(650, base * 10)) : 380;
    const timer = window.setTimeout(() => {
      allowCrossRef.current = true;
      setPageDone(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [auto, playing, pageDone, bookDone, preset.wps]);

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
  }, [loadBlocks, onGoToPage, setPlaying]);

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
  }, [stream, loadPreviousPage, scrollToChar, setPlaying]);

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
  }, [bookDone, pageDone, playing, win, firstLen, totalChars, stream, scrollToChar, setPlaying]);

  // ---------- el overlay toma el foco (bloquea los atajos del lector) ----------
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  // ---------- inmersión propia ----------
  useEffect(() => {
    speedOpenRef.current = speedOpen;
  }, [speedOpen]);

  useEffect(() => {
    let hideTimer = 0;
    const arm = () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        if (!speedOpenRef.current) setUiHidden(true);
        else arm();
      }, TP_IDLE_MS);
    };
    const wake = () => {
      setUiHidden(false);
      arm();
    };
    const events: (keyof WindowEventMap)[] = ["pointermove", "pointerdown", "keydown", "wheel", "focus"];
    // CAPTURA: el manejador de teclas del overlay hace stopPropagation de las
    // teclas que consume; el despertar de la UI debe correr antes.
    events.forEach((ev) => window.addEventListener(ev, wake, { passive: true, capture: true }));
    arm();
    return () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      events.forEach((ev) => window.removeEventListener(ev, wake, { capture: true }));
    };
  }, []);

  // ---------- pantalla completa ----------
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  // ---------- teclado ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        forward();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        rewindOne();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setPlaying(false);
        const root = scrollRef.current;
        if (root) root.scrollTop -= Math.max(80, root.clientHeight * 0.15);
      } else if (e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (pageDone || bookDone) forward();
        else setPlaying((v) => !v);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        e.stopPropagation();
        changeFont(-1);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        e.stopPropagation();
        changeFont(1);
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        e.stopPropagation();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [forward, rewindOne, onClose, pageDone, bookDone, changeFont, toggleFullscreen]);

  const pct = firstLen > 0 ? Math.min(100, (lit / firstLen) * 100) : 0;
  const atEnd = bookDone || (!win?.pages[1] && lit >= totalChars && totalChars > 0);
  const nextLabel = atEnd ? t("tp.end") : pageDone ? t("tp.nextPage") : t("tp.next");

  const blocksJsx = useMemo(
    () =>
      stream.blocks.map((b, bi) => {
        const Tag = (b.heading ? (b.kind === "h4" ? "h4" : b.kind === "h3" ? "h3" : "h1" === b.kind ? "h1" : "h2") : "p") as
          | "h1"
          | "h2"
          | "h3"
          | "h4"
          | "p";
        return (
          <Tag
            key={bi}
            className={cn("tp-block", b.heading && "tp-block-h font-display")}
            data-block={bi}
          >
            {Array.from(b.text).map((ch, j) => (
              <span key={j} className="tp-ch">
                {ch}
              </span>
            ))}
          </Tag>
        );
      }),
    [stream.blocks]
  );

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={cn("tp-overlay fixed inset-0 z-[70] outline-none", uiHidden && "tp-immersed")}
      role="dialog"
      aria-modal="true"
      aria-label={t("tp.aria")}
      data-testid="tp-overlay"
      style={{ "--tp-font-scale": fontScale } as React.CSSProperties}
    >
      {/* Barra superior: identidad + progreso + controles (auto-ocultable) */}
      <div className="tp-chrome absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground/90">{book.title}</p>
          <p className="text-xs text-muted-foreground">
            {t("tp.status", {
              page: win?.start ?? pageNum,
              total: numPages,
              speed: speedLabel,
            })}
          </p>
        </div>
        <Tip label={t("tp.fontTip", { pct: Math.round(fontScale * 100) })}>
          <div className="flex items-center" data-testid="tp-font-group">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 font-display"
              onClick={() => changeFont(-1)}
              disabled={fontScale <= TELEPROMPTER_FONT_MIN}
              aria-label={t("tp.fontMinusAria")}
              data-testid="tp-font-minus"
            >
              <span aria-hidden>A−</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 font-display"
              onClick={() => changeFont(1)}
              disabled={fontScale >= TELEPROMPTER_FONT_MAX}
              aria-label={t("tp.fontPlusAria")}
              data-testid="tp-font-plus"
            >
              <span aria-hidden>A+</span>
            </Button>
          </div>
        </Tip>
        <Tip label={tpSet.sound ? t("tp.muteTip") : t("tp.unmuteTip")}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTeleprompter({ sound: !tpSet.sound })}
            aria-label={tpSet.sound ? t("tp.muteAria") : t("tp.unmuteAria")}
            data-testid="tp-sound"
          >
            {tpSet.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </Tip>
        <Tip label={isFullscreen ? t("tp.exitFullscreen") : t("tp.fullscreen")}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? t("tp.exitFullscreen") : t("tp.fullscreen")}
            data-testid="tp-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </Tip>
        <Tip label={auto ? t("tp.autoOnTip") : t("tp.autoOffTip")}>
          <Button
            variant={auto ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-8 gap-1.5 text-xs", auto && "text-primary")}
            onClick={() => setTeleprompter({ auto: !tpSet.auto })}
            aria-pressed={auto}
            aria-label={auto ? t("tp.autoOnAria") : t("tp.autoOffAria")}
            data-testid="tp-auto"
          >
            <Repeat className="h-4 w-4" /> {t("tp.auto")}
          </Button>
        </Tip>
        <Popover open={speedOpen} onOpenChange={setSpeedOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              aria-label={t("tp.speedAria")}
              data-testid="tp-speed"
            >
              <Gauge className="h-4 w-4" /> {speedLabel.split(" · ")[0]}
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="z-[80] w-64 p-2" data-testid="tp-speed-menu">
            <p className="px-2 pb-1.5 text-[11px] font-medium text-muted-foreground">
              {t("tp.speedTitle")}
            </p>
            {TELEPROMPTER_SPEED_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setTeleprompter({ speedPreset: p.id })}
                data-testid={`tp-speed-preset-${p.id}`}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors",
                  p.id === tpSet.speedPreset
                    ? "bg-primary/15 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <span>{t(`speed.${p.id}`)}</span>
                {p.id === tpSet.speedPreset && (
                  <span className="text-[10px] font-bold uppercase">{t("tp.activeTag")}</span>
                )}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Tip label={playing ? t("tp.pauseTip") : t("tp.playTip")}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? t("tp.pauseAria") : t("tp.playAria")}
            data-testid="tp-play"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </Tip>
        <Tip label={t("tp.exitTip")}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label={t("tp.exitAria")}
            data-testid="tp-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </Tip>
      </div>

      {/* Progreso de la página (auto-ocultable) */}
      <div className="tp-chrome absolute inset-x-0 top-[52px] z-20 px-5">
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-foreground/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          data-testid="tp-progress"
        >
          <div className="tp-progress-fill h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Escenario: columna única con scroll real */}
      <div className="tp-stage absolute inset-0 z-10" data-testid="tp-stage" onClick={forward}>
        {stale ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("tp.opening")}
          </p>
        ) : !win || totalChars === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="max-w-md" data-testid="tp-empty">
              <p className="font-display text-lg font-semibold">{t("tp.emptyTitle")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("tp.emptyBody")}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>
                {t("tp.backToReader")}
              </Button>
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="tp-scroll h-full overflow-y-auto px-6 pb-28 pt-24"
            data-testid="tp-scroll"
            onWheel={(e) => {
              // releer hacia arriba pausa el avance; no apaga el texto
              if (e.deltaY < 0) setPlaying(false);
            }}
          >
            <div
              className="tp-stream mx-auto w-full max-w-[780px]"
              data-testid="tp-stream"
              data-page-start={win.start}
              data-pages={win.pages.filter(Boolean).length}
            >
              {blocksJsx}
            </div>
          </div>
        )}
      </div>

      {/* Controles inferiores (auto-ocultables) */}
      <div className="tp-chrome absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 px-5 pb-4">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={rewindOne}
          disabled={!win || (win.start <= 1 && lit <= 0)}
          aria-label={t("tp.rewind")}
          data-testid="tp-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={forward}
          disabled={atEnd}
          aria-label={atEnd ? t("tp.end") : pageDone ? t("tp.nextPageAria") : t("tp.nextAria")}
          data-testid="tp-next"
        >
          {nextLabel}
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{t("tp.hint")}</span>
      </div>
    </div>
  );
}
