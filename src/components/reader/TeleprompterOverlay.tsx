"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tip } from "@/components/reader/ZoomControls";
import { ShortcutGhost, type ShortcutGhostEntry } from "@/components/reader/ShortcutGhost";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  Maximize,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Target,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
  useTeleprompterWindow,
} from "@/hooks/use-teleprompter-window";
import { useTeleprompterPlayer } from "@/hooks/use-teleprompter-player";
import {
  TELEPROMPTER_SPEED_PRESETS,
  teleprompterPresetById,
  clampTeleprompterFontScale,
  TELEPROMPTER_FONT_MAX,
  TELEPROMPTER_FONT_MIN,
  TELEPROMPTER_FONT_STEP,
} from "@/lib/types";
import type { BookDTO } from "@/lib/types";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/utils";
import type { StreamWindow } from "@/hooks/use-teleprompter-window";

interface TeleprompterOverlayProps {
  book: BookDTO;
  doc: PDFDocumentProxy | null;
  /** EPUB: bloques reales de la página (h1-h4 en el flujo) */
  getPageBlocks?: (page: number) => Promise<import("@/lib/teleprompter").TeleprompterBlock[]>;
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
  /** páginas de hoy de ESTE libro (mismo conteo que la cabecera del lector) */
  todayPages: number;
  /** meta efectiva del libro (propia o global) para el par de hoy */
  todayGoal: number;
  onClose: () => void;
}

/** ms de quietud antes de que el teleprompter oculte su propia UI */
const TP_IDLE_MS = 3500;

/** la página pedida aún no está en la ventana: abriendo (derivado, sin efectos) */
function isStaleWindow(win: StreamWindow | null, pageNum: number): boolean {
  return !win || pageNum < win.start || pageNum > win.start + 1;
}

/** avance de la página actual en % (0 sin primera página medible) */
function pagePct(lit: number, firstLen: number): number {
  return firstLen > 0 ? Math.min(100, (lit / firstLen) * 100) : 0;
}

/** el flujo llegó al final del libro (última página sin siguiente encadenada) */
function isAtEnd(
  bookDone: boolean,
  win: StreamWindow | null,
  lit: number,
  totalChars: number,
  numPages: number
): boolean {
  if (bookDone) return true;
  if (!win) return false;
  // hueco del cruce atómico: la siguiente aún no entró en la ventana pero existe
  if (!win.pages[1] && win.start < numPages) return false;
  return !win.pages[1] && lit >= totalChars && totalChars > 0;
}

/** etiqueta del botón de avance según el estado de la reproducción */
function nextLabelFor(atEnd: boolean, pageDone: boolean, t: (k: string) => string): string {
  if (atEnd) return t("tp.end");
  return pageDone ? t("tp.nextPage") : t("tp.next");
}

/**
 * Modo teleprompter continuo: la página se lee como una columna única que sube
 * sola mientras las letras se encienden, con el carácter activo a ~40 % del
 * alto. La ventana mantiene dos páginas en el DOM: la actual y la siguiente,
 * así el encadenado con Auto no corta y el rebobinado puede volver atrás.
 *
 * Composición visual: la capa de datos/DOM vive en `use-teleprompter-window`
 * y el control de reproducción (motor, pausa, rebobinado, encadenado) en
 * `use-teleprompter-player`.
 */
export function TeleprompterOverlay({
  book,
  doc,
  getPageBlocks,
  pageNum,
  numPages,
  sourceKey,
  onGoToPage,
  todayPages,
  todayGoal,
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

  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [uiHidden, setUiHidden] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);

  // Pantalla despierta: el teleprompter es el caso de uso de la lectura larga;
  // el overlay existe solo mientras el modo está abierto (con o sin F11).
  useWakeLock(true);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const speedOpenRef = useRef(false);

  // ---------- tic de tipeo (WebAudio, muy bajo) ----------
  const tpTick = useCallback(() => {
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
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1500 + Math.random() * 400;
      gain.gain.setValueAtTime(0.014, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.026);
    } catch {
      /* el sonido nunca debe romper la lectura */
    }
  }, [tpSet.sound]);

  const tpWin = useTeleprompterWindow({ doc, getPageBlocks, numPages, presetWps: preset.wps });
  const {
    win,
    setWin,
    winRef,
    winSourceRef,
    loadBlocks,
    scrollRef,
    stream,
    firstLen,
    totalChars,
    cancelViewAnim,
    stageViewAnchor,
  } = tpWin;

  const player = useTeleprompterPlayer({
    pageNum,
    win,
    setWin,
    winRef,
    winSourceRef,
    loadBlocks,
    numPages,
    sourceKey,
    hasSource: !!doc || !!getPageBlocks,
    onGoToPage,
    stream,
    firstLen,
    totalChars,
    spansRef: tpWin.spansRef,
    scrollRef,
    scrollToChar: tpWin.scrollToChar,
    stageViewAnchor,
    auto,
    presetWps: preset.wps,
    tick: tpTick,
  });

  const { lit, playing, setPlaying, pageDone, bookDone, forward, rewindOne, stepForward, goToNextPage, goToPrevPage } = player;

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
        // → avanza una letra; Shift+→ cambia de página
        if (e.shiftKey) goToNextPage();
        else stepForward();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        // ← retrocede una letra; Shift+← vuelve a la página anterior
        if (e.shiftKey) goToPrevPage();
        else rewindOne();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setPlaying(false);
        cancelViewAnim(); // el desplazamiento manual manda: el seguimiento se re-ancla al reanudar
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
  }, [forward, rewindOne, stepForward, goToNextPage, goToPrevPage, onClose, pageDone, bookDone, changeFont, toggleFullscreen, setPlaying, scrollRef, cancelViewAnim]);

  const stale = isStaleWindow(win, pageNum);
  const atEnd = isAtEnd(bookDone, win, lit, totalChars, numPages);
  const nextLabel = nextLabelFor(atEnd, pageDone, t);
  const pct = pagePct(lit, firstLen);

  // Mapa de teclas del teleprompter para el recordatorio fantasma
  const tpGhostEntries = useMemo<ShortcutGhostEntry[]>(
    () => [
      { keys: "→", action: t("ghost.tp.next") },
      { keys: "←", action: t("ghost.tp.rewind") },
      { keys: "Shift+→ / ←", action: t("ghost.tp.page") },
      { keys: "↑", action: t("ghost.tp.up") },
      { keys: "Espacio", action: t("ghost.tp.pause") },
      { keys: "−/+", action: t("ghost.tp.font") },
      { keys: "M", action: t("ghost.tp.fullscreen") },
      { keys: "Esc", action: t("ghost.tp.exit") },
    ],
    [t]
  );

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
      {/* Recordatorio de teclas de la inmersión: cada transición de visibilidad
          de la interfaz (ocultarse por quietud o despertar) lo despliega */}
      <ShortcutGhost signal={uiHidden} entries={tpGhostEntries} testId="tp-shortcut-ghost" />

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
        {/* Hoy de ESTE libro: mismo conteo que la cabecera del lector, vivo */}
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
          title={t("reader.goalBookTitle")}
          data-testid="tp-today"
        >
          <Target className="h-3.5 w-3.5" />
          {todayPages}/{todayGoal}
        </span>
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
            variant="outline"
            size="icon"
            className="h-8 w-8 border-primary/40 bg-primary/10 text-primary-on-tint shadow-none hover:border-primary/60 hover:bg-primary/20 dark:border-primary/40 dark:bg-primary/10 dark:hover:border-primary/60 dark:hover:bg-primary/20"
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
                    ? "bg-primary/15 font-medium text-primary-on-tint"
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
            className="tp-scroll h-full overflow-y-auto px-6 pb-28"
            data-testid="tp-scroll"
            onWheel={(e) => {
              // releer hacia arriba pausa el avance; no apaga el texto.
              // Cualquier giro manual cancela la transición de vista: el objetivo
              // se recalcula contra el DOM real al reanudar el seguimiento.
              cancelViewAnim();
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
