"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tip } from "@/components/reader/ZoomControls";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useSettings } from "@/lib/settings";
import { VN_SPEED_PRESETS, vnPresetById, clampVnFontScale, VN_FONT_MAX, VN_FONT_MIN, VN_FONT_STEP } from "@/lib/types";
import {
  VN_LETTERS_PER_WORD,
  buildVnTimeline,
  extractVnPageText,
  vnCardsFromPageText,
} from "@/lib/vn";
import type { BookDTO } from "@/lib/types";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/utils";

interface VisualNovelOverlayProps {
  book: BookDTO;
  doc: PDFDocumentProxy | null;
  /** EPUB: proveedor de texto de página (sustituye a la extracción del PDF) */
  getPageText?: (page: number) => Promise<string>;
  pageNum: number;
  numPages: number;
  /** gira la página real del lector (cuenta como lectura y hitos) */
  onGoToPage: (page: number) => void;
  onClose: () => void;
}

/** Capa saliente congelada durante la disolvencia cruzada */
interface Leaving {
  html: string;
  seq: number;
}

/**
 * Modo novela visual: tarjetas a pantalla completa con el texto de la página
 * actual encendido letra a letra, respetando el ritmo de la puntuación
 * (pausa corta en «,» y larga en «.»), con disolvencia cruzada Ren'Py entre
 * tarjetas (la tarjeta saliente queda congelada mientras se desvanece).
 */
export function VisualNovelOverlay({
  book,
  doc,
  getPageText,
  pageNum,
  numPages,
  onGoToPage,
  onClose,
}: VisualNovelOverlayProps) {
  const vnSet = useSettings((s) => s.vn);
  const setVn = useSettings((s) => s.setVn);
  const preset = vnPresetById(vnSet.speedPreset);
  const auto = vnSet.auto;
  const fontScale = clampVnFontScale(vnSet.fontScale);

  const changeFont = useCallback(
    (delta: number) => {
      setVn({ fontScale: clampVnFontScale(fontScale + delta * VN_FONT_STEP) });
    },
    [fontScale, setVn]
  );

  const [cards, setCards] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardIdx, setCardIdx] = useState(0);
  const [litCount, setLitCount] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const [atEnd, setAtEnd] = useState(false); // última tarjeta completada
  const [leaving, setLeaving] = useState<Leaving | null>(null);

  const cardBoxRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const litRef = useRef(0);
  const cardIdxRef = useRef(0);
  const transSeqRef = useRef(0);
  const cacheRef = useRef<Map<number, string[]>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  // ref espejo del avance: el motor de encendido la usa sin depender de él
  const advanceRef = useRef<() => void>(() => {});
  // temporizador del modo auto (única fuente de avance automático)
  const autoTimerRef = useRef(0);
  const clearAuto = useCallback(() => {
    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = 0;
    }
  }, []);

  const cardText = cards[cardIdx] ?? "";
  const timeline = useMemo(
    () => buildVnTimeline(cardText, preset.wps),
    [cardText, preset.wps]
  );
  const totalSteps = timeline.steps.length;

  // Los spans se renderizan una vez por tarjeta (el encendido es imperativo,
  // añadiendo la clase .on: re-renderizar mil spans por letra sería un desperdicio)
  const charSpans = useMemo(
    () =>
      Array.from(cardText).map((ch, i) => (
        <span key={i} className="vn-ch">
          {ch}
        </span>
      )),
    [cardText]
  );

  // ---------- tic de tipeo (WebAudio, muy bajo) ----------
  const tick = useCallback(() => {
    if (!vnSet.sound) return;
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
  }, [vnSet.sound]);

  // ---------- carga del texto de la página (con caché y precarga) ----------
  // PDF: extracción de la capa de texto. EPUB: proveedor de texto de página.
  const loadPageText = useCallback(
    (p: number): Promise<string> => {
      if (getPageText) return getPageText(p);
      if (doc) return extractVnPageText(doc, p);
      return Promise.resolve("");
    },
    [getPageText, doc]
  );

  useEffect(() => {
    let alive = true;
    const cached = cacheRef.current.get(pageNum);
    if (cached) {
      setCards(cached);
      setCardIdx(0);
      cardIdxRef.current = 0;
      litRef.current = 0;
      setLitCount(0);
      setFinished(false);
      setAtEnd(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (!doc && !getPageText) {
      setCards([]);
      setLoading(false);
      return;
    }
    loadPageText(pageNum)
      .then((text) => {
        if (!alive) return;
        const next = vnCardsFromPageText(text);
        cacheRef.current.set(pageNum, next);
        setCards(next);
        setCardIdx(0);
        cardIdxRef.current = 0;
        litRef.current = 0;
        setLitCount(0);
        setFinished(false);
        setAtEnd(false);
        setLoading(false);
        // precarga silenciosa de la página siguiente
        if (pageNum + 1 <= numPages && !cacheRef.current.has(pageNum + 1)) {
          void loadPageText(pageNum + 1).then((t2) => {
            if (alive) cacheRef.current.set(pageNum + 1, vnCardsFromPageText(t2));
          });
        }
      })
      .catch(() => {
        if (!alive) return;
        cacheRef.current.set(pageNum, []);
        setCards([]);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [doc, getPageText, pageNum, numPages, loadPageText]);

  // ---------- motor de encendido letra a letra ----------
  useEffect(() => {
    const box = cardBoxRef.current;
    if (!box) return;
    const spans = Array.from(box.querySelectorAll<HTMLSpanElement>(".vn-ch"));
    if (spans.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Instantánea o reduced-motion: todo encendido de golpe.
    // El AVANCE ya no vive aquí: el modo auto (efecto de abajo) es la única
    // fuente de avance automático — así Instantánea también gira la página.
    if (preset.wps == null || reduced) {
      spans.forEach((s) => s.classList.add("on"));
      litRef.current = spans.length;
      setLitCount(spans.length);
      setFinished(true);
      return;
    }

    if (!playing) {
      // reanudar después: repinta lo ya encendido por si el DOM se recreó
      spans.forEach((s, i) => s.classList.toggle("on", i < litRef.current));
      return;
    }

    let cancelled = false;
    let timer = 0;
    let i = Math.min(litRef.current, spans.length);
    // repinta el estado actual (p. ej. tras pausar/reanudar)
    spans.forEach((s, k) => s.classList.toggle("on", k < i));

    const step = () => {
      if (cancelled) return;
      if (i < spans.length) {
        spans[i].classList.add("on");
        if (timeline.steps[i]?.char && timeline.steps[i].char.trim()) tick();
        i += 1;
        litRef.current = i;
        setLitCount(i);
      }
      if (i >= spans.length) {
        setFinished(true);
        return;
      }
      timer = window.setTimeout(step, Math.max(8, timeline.steps[i]?.delay ?? 40));
    };

    if (i >= spans.length) {
      setFinished(true);
    } else {
      timer = window.setTimeout(step, Math.max(8, timeline.steps[i]?.delay ?? 40));
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cardIdx, cards, playing, preset.wps, timeline, tick]);

  // ---------- modo auto: al terminar la tarjeta avanza solo ----------
  // Única fuente de avance automático. Respeta pausa (playing) y loading.
  // En la última tarjeta gira la página de verdad (cuenta como lectura).
  useEffect(() => {
    if (!auto || !playing || loading || cards.length === 0) return;
    if (!finished && !atEnd) return;
    const wps = preset.wps;
    const base = wps ? 1000 / (wps * VN_LETTERS_PER_WORD) : 0;
    // respiro tras terminar la tarjeta: proporcional al ritmo, con suelo y techo
    const delay = wps ? Math.min(1800, Math.max(650, base * 10)) : 380;
    const t = window.setTimeout(() => {
      autoTimerRef.current = 0;
      if (atEnd) {
        if (pageNum < numPages) onGoToPage(pageNum + 1);
      } else {
        advanceRef.current();
      }
    }, delay);
    autoTimerRef.current = t;
    return () => {
      window.clearTimeout(t);
      if (autoTimerRef.current === t) autoTimerRef.current = 0;
    };
  }, [auto, playing, loading, cards.length, finished, atEnd, preset.wps, pageNum, numPages, onGoToPage]);

  // ---------- disolvencia cruzada: limpieza de la capa saliente ----------
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      setLeaving((cur) => (cur && cur.seq === leaving.seq ? null : cur));
    }, 520);
    return () => window.clearTimeout(t);
  }, [leaving]);

  // el overlay toma el foco: así las teclas del lector quedan bloqueadas por
  // su guard de [role="dialog"] y no giran páginas debajo del modo novela
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  const finishedRefReset = useCallback(() => {
    setFinished(false);
    setAtEnd(false);
  }, []);

  // ---------- avance / retroceso ----------
  const advance = useCallback(() => {
    clearAuto();
    const box = cardBoxRef.current;
    const seq = ++transSeqRef.current;
    if (box && box.innerHTML) setLeaving({ html: box.innerHTML, seq });
    finishedRefReset();
    litRef.current = 0;
    setLitCount(0);
    if (cardIdxRef.current < cards.length - 1) {
      cardIdxRef.current += 1;
      setCardIdx(cardIdxRef.current);
      setPlaying(true);
    } else {
      setAtEnd(true);
    }
  }, [cards.length, finishedRefReset, clearAuto]);

  const stepBack = useCallback(() => {
    clearAuto();
    if (cardIdxRef.current <= 0) return;
    const box = cardBoxRef.current;
    const seq = ++transSeqRef.current;
    if (box && box.innerHTML) setLeaving({ html: box.innerHTML, seq });
    finishedRefReset();
    litRef.current = 0;
    setLitCount(0);
    setAtEnd(false);
    cardIdxRef.current -= 1;
    setCardIdx(cardIdxRef.current);
    setPlaying(true);
  }, [finishedRefReset, clearAuto]);

  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  /** click / → / Espacio: completar tarjeta → siguiente → página siguiente */
  const forward = useCallback(() => {
    if (loading) return;
    if (!finished) {
      // completar la tarjeta al instante
      const box = cardBoxRef.current;
      box?.querySelectorAll<HTMLSpanElement>(".vn-ch").forEach((s) => s.classList.add("on"));
      litRef.current = totalSteps;
      setLitCount(totalSteps);
      setFinished(true);
      return;
    }
    if (atEnd) {
      if (pageNum < numPages) onGoToPage(pageNum + 1);
      return;
    }
    advance();
  }, [loading, finished, atEnd, pageNum, numPages, onGoToPage, advance, totalSteps]);

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
        stepBack();
      } else if (e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (finished) forward();
        else setPlaying((v) => !v);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        e.stopPropagation();
        changeFont(-1);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        e.stopPropagation();
        changeFont(1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [forward, stepBack, onClose, finished, changeFont]);

  const pct =
    cards.length > 0 && totalSteps > 0
      ? Math.min(100, ((cardIdx + (finished ? 1 : litCount / totalSteps)) / cards.length) * 100)
      : 0;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="vn-overlay fixed inset-0 z-[70] outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Modo novela visual"
      data-testid="vn-overlay"
      style={{ "--vn-font-scale": fontScale } as React.CSSProperties}
    >
      {/* Barra superior: identidad + progreso + controles */}
      <div className="vn-top absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground/90">
            {book.title}
          </p>
          <p className="text-xs text-muted-foreground">
            Página {pageNum} de {numPages} · tarjeta {Math.min(cardIdx + 1, Math.max(cards.length, 1))}/
            {Math.max(cards.length, 1)} · {preset.label}
          </p>
        </div>
        <Tip label={`Tamaño de letra ${Math.round(fontScale * 100)}% (− y + también funcionan)`}>
          <div className="flex items-center" data-testid="vn-font-group">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 font-display"
              onClick={() => changeFont(-1)}
              disabled={fontScale <= VN_FONT_MIN}
              aria-label="Reducir tamaño de letra"
              data-testid="vn-font-minus"
            >
              <span aria-hidden>A−</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 font-display"
              onClick={() => changeFont(1)}
              disabled={fontScale >= VN_FONT_MAX}
              aria-label="Aumentar tamaño de letra"
              data-testid="vn-font-plus"
            >
              <span aria-hidden>A+</span>
            </Button>
          </div>
        </Tip>
        <Tip label={vnSet.sound ? "Silenciar tipeo" : "Activar tipeo"}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setVn({ sound: !vnSet.sound })}
            aria-label={vnSet.sound ? "Silenciar sonido de tipeo" : "Activar sonido de tipeo"}
            data-testid="vn-sound"
          >
            {vnSet.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </Tip>
        <Tip label={auto ? "Auto activo: avanza solo" : "Auto: avanzar solo tarjeta a tarjeta"}>
          <Button
            variant={auto ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-8 gap-1.5 text-xs", auto && "text-primary")}
            onClick={() => setVn({ auto: !vnSet.auto })}
            aria-pressed={auto}
            aria-label={auto ? "Desactivar modo auto" : "Activar modo auto"}
            data-testid="vn-auto"
          >
            <Repeat className="h-4 w-4" /> Auto
          </Button>
        </Tip>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              aria-label="Velocidad de encendido"
              data-testid="vn-speed"
            >
              <Gauge className="h-4 w-4" /> {preset.label.split(" · ")[0]}
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="z-[80] w-64 p-2" data-testid="vn-speed-menu">
            <p className="px-2 pb-1.5 text-[11px] font-medium text-muted-foreground">
              Velocidad de encendido
            </p>
            {VN_SPEED_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setVn({ speedPreset: p.id })}
                data-testid={`vn-speed-preset-${p.id}`}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors",
                  p.id === vnSet.speedPreset
                    ? "bg-primary/15 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <span>{p.label}</span>
                {p.id === vnSet.speedPreset && (
                  <span className="text-[10px] font-bold uppercase">activa</span>
                )}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Tip label={playing ? "Pausar" : "Reanudar"}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? "Pausar encendido" : "Reanudar encendido"}
            data-testid="vn-play"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </Tip>
        <Tip label="Salir (Escape)">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Salir del modo novela visual"
            data-testid="vn-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </Tip>
      </div>

      {/* Progreso de la página */}
      <div className="absolute inset-x-0 top-[52px] z-20 px-5">
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-foreground/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          data-testid="vn-progress"
        >
          <div
            className="vn-progress-fill h-full rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Escenario: capa saliente congelada + tarjeta viva */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center px-6 pb-20 pt-20"
        data-testid="vn-stage"
        onClick={() => forward()}
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Abriendo la página…</p>
        ) : cards.length === 0 ? (
          <div className="max-w-md text-center" data-testid="vn-empty">
            <p className="font-display text-lg font-semibold">Página sin texto seleccionable</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta página parece escaneada. Vuelve al lector y usa el OCR para extraer su texto.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>
              Volver al lector
            </Button>
          </div>
        ) : (
          <>
            {leaving && (
              <div
                key={`out-${leaving.seq}`}
                className="vn-card vn-card--out absolute inset-0 z-0 flex items-center justify-center px-6 pb-20 pt-20"
                aria-hidden
                data-testid="vn-card-leaving"
              >
                <div
                  className="vn-card-box vn-paragraph w-full max-w-[780px]"
                  dangerouslySetInnerHTML={{ __html: leaving.html }}
                />
              </div>
            )}
            <div key={cardIdx} className="vn-card relative z-10 w-full max-w-[780px]">
              <div className="vn-card-box" data-testid="vn-card-box" ref={cardBoxRef}>
                <span className="vn-rule" aria-hidden />
                {charSpans}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controles inferiores */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 px-5 pb-4">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={stepBack}
          disabled={cardIdx <= 0}
          aria-label="Tarjeta anterior"
          data-testid="vn-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={forward}
          aria-label={atEnd ? "Página siguiente" : "Tarjeta siguiente"}
          data-testid="vn-next"
        >
          {atEnd ? (pageNum < numPages ? "Página siguiente" : "Fin del libro") : "Siguiente"}
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
          click o → continuar · Espacio pausa · Auto avanza solo · −/+ letra · Escape sale
        </span>
      </div>
    </div>
  );
}
