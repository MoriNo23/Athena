"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tip } from "@/components/reader/ZoomControls";
import { TeleprompterSettingsSheet } from "@/components/reader/TeleprompterSettingsSheet";
import { ShortcutGhost, type ShortcutGhostEntry } from "@/components/reader/ShortcutGhost";
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  Gauge,
  Maximize,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Settings2,
  Target,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { teleprompterPageContaining } from "@/core/teleprompter";
import { direccionArrastre, esTap, iniciarGesto, type GestoActivo } from "@/core/touch-gestures";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
  useTeleprompterWindow,
} from "@/hooks/use-teleprompter-window";
import { useTeleprompterPlayer } from "@/hooks/use-teleprompter-player";
import {
  clampTeleprompterDescanso,
  clampTeleprompterFontScale,
  clampTeleprompterImagenHold,
  clampTeleprompterWps,
  TELEPROMPTER_DESCANSO_S,
  TELEPROMPTER_FONT_MAX,
  TELEPROMPTER_FONT_MIN,
  TELEPROMPTER_FONT_STEP,
  TELEPROMPTER_WPS_MAX,
  TELEPROMPTER_WPS_MIN,
  TELEPROMPTER_WPS_STEP,
  fondoUrlDe,
} from "@/core/types";
import type { BookDTO } from "@/core/types";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/utils";
import type { StreamWindow } from "@/hooks/use-teleprompter-window";

interface TeleprompterOverlayProps {
  book: BookDTO;
  doc: PDFDocumentProxy | null;
  /** EPUB: bloques reales de la página (h1-h4 en el flujo) */
  getPageBlocks?: (page: number) => Promise<import("@/core/teleprompter").TeleprompterBlock[]>;
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
  onGoToPage: (page: number, opts?: { silent?: boolean }) => void;
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
  return !win || pageNum < win.start || pageNum > win.start + win.pages.length - 1;
}

/** avance DENTRO de la página que contiene el carácter activo, en % (0 sin
    página medible). Con la columna viva el progreso es por página real: los
    offsets dicen dónde empieza y acaba cada una dentro del flujo. Al filo del
    final (o página muda contenedora) se camina atrás a la última con texto. */
function pagePct(lit: number, offsets: number[]): number {
  if (offsets.length < 2) return 0;
  let k = teleprompterPageContaining(offsets, lit);
  while (k > 0 && (offsets[k + 1] ?? 0) - (offsets[k] ?? 0) <= 0) k -= 1;
  const from = offsets[k] ?? 0;
  const len = (offsets[k + 1] ?? 0) - from;
  if (len <= 0) return 0;
  return Math.min(100, Math.max(0, ((lit - from) / len) * 100));
}

/** el flujo llegó al final del libro (última página del libro ya encendida) */
function isAtEnd(
  bookDone: boolean,
  win: StreamWindow | null,
  lit: number,
  totalChars: number,
  numPages: number
): boolean {
  if (bookDone) return true;
  if (!win) return false;
  const last = win.start + win.pages.length - 1;
  // hueco de carga: la siguiente aún no entró en la ventana pero existe
  if (win.pages[win.pages.length - 1] == null && last < numPages) return false;
  return lit >= totalChars && totalChars > 0 && last >= numPages;
}

/** etiqueta del botón de avance según el estado de la reproducción */
function nextLabelFor(atEnd: boolean, pageDone: boolean, t: (k: string) => string): string {
  if (atEnd) return t("tp.end");
  return pageDone ? t("tp.nextPage") : t("tp.next");
}

/**
 * Modo teleprompter continuo: la página se lee como una columna única que sube
 * sola mientras las letras se encienden, con el carácter activo a ~40 % del
 * alto. La ventana es una COLUMNA VIVA (teleprompter-cruce-sin-evento): la
 * página nueva se añade DEBAJO al cruzar —sin evento visual— y las ya leídas
 * permanecen encima hasta que el scroll las saca de vista; la poda frontal
 * (fuera de encuadre, con compensación de scroll) es imperceptible.
 *
 * Composición visual: la capa de datos/DOM vive en `use-teleprompter-window`
 * y el control de reproducción (motor, pausa, rebobinado, cruce, poda) en
 * `use-teleprompter-player`.
 */
/** memo: el cronómetro del lector re-renderiza cada segundo; el overlay solo
    debe repintarse si cambian sus props memoizadas (página, fuente, cierre). */
export const TeleprompterOverlay = memo(function TeleprompterOverlay({
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
  // control DIRECTO de velocidad: sin presets (la dueña manda, 24-10)
  const wps = clampTeleprompterWps(tpSet.wps);
  const instante = tpSet.instante;
  const wpsActivo = instante ? null : wps;
  const auto = tpSet.auto;
  const fontScale = clampTeleprompterFontScale(tpSet.fontScale);
  const speedLabel = instante
    ? t("tp.instantLabel")
    : t("tp.wpsLabel", {
        wps: wps.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      });
  // fondo del escenario: portada del libro o imagen propia, siempre filtrada
  const fondoImg =
    tpSet.fondo === "portada"
      ? book.coverUrl ?? null
      : tpSet.fondo === "imagen"
        ? tpSet.fondoRuta ? fondoUrlDe(tpSet.fondoRuta) : null
        : null;
  const fondoFiltro = Math.round(tpSet.fondoFiltro);

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
  /** P4: ajustes del teleprompter DENTRO del modo (tecla A) */
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Pantalla despierta: el teleprompter es el caso de uso de la lectura larga;
  // el overlay existe solo mientras el modo está abierto (con o sin F11).
  useWakeLock(true);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const speedOpenRef = useRef(false);
  const settingsOpenRef = useRef(false);
  // ---------- tacto (APK): tap = pausa/reanuda, arrastrar atrás = pausa -----
  // Decisiones puras en lib/touch-gestures (testeado); aquí solo registro
  // puntos. El tap NUNCA avanza página (regla de la dueña) — es el equivalente
  // táctil de la barra espaciadora. La cámara cede ante el dedo (mismo
  // contrato que con la rueda: el desplazamiento manual manda).
  const gestoRef = useRef<GestoActivo | null>(null);
  const ultimoYRef = useRef(0);

  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);

  // el navegador topa los AudioContext vivos: al cerrar el teleprompter se
  // suelta el suyo (si no, tras unas cuantas aperturas el tic se apaga solo)
  useEffect(() => {
    return () => {
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

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

  const tpWin = useTeleprompterWindow({
    doc,
    getPageBlocks,
    numPages,
    wps: wpsActivo,
    porFrase: tpSet.tarjetasPorFrase,
    pausaImagen: tpSet.pausaImagen,
    imagenHoldMs: clampTeleprompterImagenHold(tpSet.imagenHoldMs),
  });
  const {
    win,
    setWin,
    winRef,
    winSourceRef,
    loadBlocks,
    scrollRef,
    stream,
    pageOffsets,
    pruneMeasure,
    totalChars,
    cancelViewAnim,
    stageViewAnchor,
  } = tpWin;

  // El cruce de página virtual NO es un evento (teleprompter-cruce-sin-evento):
  // la página nueva se AÑADE debajo de la columna y el texto leído permanece
  // encima hasta que el scroll lo saca de vista; la poda frontal ocurre fuera
  // de encuadre, con compensación de scroll imperceptible. La única espera con
  // Auto es la del revelado instantáneo (pageDone), en el player: ahí no hay
  // ritmo de letras que proteger.

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
    pageOffsets,
    pruneMeasure,
    totalChars,
    spansRef: tpWin.spansRef,
    scrollRef,
    scrollToChar: tpWin.scrollToChar,
    stageViewAnchor,
    auto,
    wps: wps,
    tick: tpTick,
  });

  const { lit, playing, setPlaying, pageDone, bookDone, forward, rewindOne, stepForward, goToNextPage, goToPrevPage } = player;

  // ---------- aviso de descanso (change teleprompter-descanso-lectura) ----------
  // Lectura sostenida en pantalla se degrada: atención en piloto automático,
  // más regresiones, fatiga ocular. Tras `descansoMin` minutos de LECTURA
  // REAL (pausa no cuenta, pestaña oculta tampoco) el aviso se arma y aparece
  // en el PRÓXIMO corte natural —pausa de la lectora o cruce de página—,
  // nunca a mitad de frase. No pausa sola: sugiere. Aceptar detiene el flujo
  // y abre 20 s de descanso (regla 20-20-20); al terminar, la reanudación es
  // explícita (la lectora puede estar mirando por la ventana).
  const descansoMin = clampTeleprompterDescanso(tpSet.descansoMin);
  const [descansoSeg, setDescansoSeg] = useState(0);
  const descansoSegRef = useRef(0);
  const [descansoVisible, setDescansoVisible] = useState(false);
  const [descansoActivo, setDescansoActivo] = useState(false);
  const [descansoRestante, setDescansoRestante] = useState(TELEPROMPTER_DESCANSO_S);
  const descansoActivoRef = useRef(false);
  useEffect(() => {
    descansoActivoRef.current = descansoActivo;
  }, [descansoActivo]);

  // contador de lectura real: corre solo en marcha y con la pestaña visible
  useEffect(() => {
    if (descansoMin <= 0 || !playing) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      descansoSegRef.current += 1;
      setDescansoSeg(descansoSegRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [descansoMin, playing]);

  const descansoArmado = descansoMin > 0 && descansoSeg >= descansoMin * 60;

  // Cortes naturales: pausa de la lectora o cruce de página. Se detectan
  // AJUSTANDO ESTADO DURANTE EL RENDER (patrón de la casa —ver el aviso de
  // llegada que fue—): comparar lo que ya sabemos en render evita efectos
  // que encadenen renders (react-hooks/set-state-in-effect). La apertura no
  // cuenta como cruce y el descanso ya activo no reabre nada.
  const [descansoPausaVisto, setDescansoPausaVisto] = useState(false);
  const [descansoPaginaVista, setDescansoPaginaVista] = useState<number | null>(pageNum);
  if (descansoArmado && !playing && !descansoPausaVisto) {
    // corte natural 1: la lectora ya se pausó (rueda arriba, rebobinado, botón)
    setDescansoPausaVisto(true);
    if (!descansoActivo) setDescansoVisible(true);
  } else if ((!descansoArmado || playing) && descansoPausaVisto) {
    setDescansoPausaVisto(false);
  }
  if (pageNum !== descansoPaginaVista) {
    // corte natural 2: cruce de página con el aviso armado (prev == null: apertura)
    setDescansoPaginaVista(pageNum);
    if (descansoPaginaVista != null && descansoArmado && !descansoActivo) {
      setDescansoVisible(true);
    }
  }

  /** cierra aviso y velo, y pone el contador a cero (se rearma al cumplir de nuevo) */
  const descansoCerrar = useCallback(() => {
    setDescansoVisible(false);
    setDescansoActivo(false);
    setDescansoRestante(TELEPROMPTER_DESCANSO_S);
    descansoSegRef.current = 0;
    setDescansoSeg(0);
  }, []);

  /** aceptar el descanso: el flujo se detiene y entra el velo con la cuenta */
  const descansarAhora = useCallback(() => {
    setPlaying(false);
    setDescansoVisible(false);
    setDescansoRestante(TELEPROMPTER_DESCANSO_S);
    setDescansoActivo(true);
  }, [setPlaying]);

  /** terminar el descanso (cuenta completa, «terminar antes» o Esc): reanuda */
  const descansoTerminar = useCallback(() => {
    descansoCerrar();
    setPlaying(true);
  }, [descansoCerrar, setPlaying]);

  // cuenta atrás del descanso activo (timeout encadenado: un tic por segundo)
  useEffect(() => {
    if (!descansoActivo || descansoRestante <= 0) return;
    const id = window.setTimeout(() => setDescansoRestante((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [descansoActivo, descansoRestante]);

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
        // con la sheet de ajustes abierta la UI no se esconde (sería niebla
        // para quien está tocando controles)
        if (!speedOpenRef.current && !settingsOpenRef.current) setUiHidden(true);
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
      // descanso activo: el teclado es del descanso — Esc lo termina antes
      // (y reanuda); el resto de teclas no toca nada bajo el velo
      if (descansoActivoRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          descansoTerminar();
        }
        return;
      }
      // Jerarquía de Escape (change teleprompter-ajustes-inmode): con la sheet
      // de ajustes abierta, Esc LA CIERRA (Radix) y las demás teclas son suyas
      // — el overlay no debe salir del modo por debajo de la sheet.
      if (settingsOpenRef.current) return;
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
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        e.stopPropagation();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [forward, rewindOne, stepForward, goToNextPage, goToPrevPage, onClose, pageDone, bookDone, changeFont, toggleFullscreen, setPlaying, scrollRef, cancelViewAnim, descansoTerminar]);

  const stale = isStaleWindow(win, pageNum);
  const atEnd = isAtEnd(bookDone, win, lit, totalChars, numPages);
  const nextLabel = nextLabelFor(atEnd, pageDone, t);
  const pct = pagePct(lit, pageOffsets);

  const tpGhostEntries = useMemo<ShortcutGhostEntry[]>(
    () => [
      { keys: "→", action: t("ghost.tp.next") },
      { keys: "←", action: t("ghost.tp.rewind") },
      { keys: "Shift+→ / ←", action: t("ghost.tp.page") },
      { keys: "↑", action: t("ghost.tp.up") },
      { keys: "Espacio", action: t("ghost.tp.pause") },
      { keys: "−/+", action: t("ghost.tp.font") },
      { keys: "A", action: t("ghost.tp.settings") },
      { keys: "M", action: t("ghost.tp.fullscreen") },
      { keys: "Esc", action: t("ghost.tp.exit") },
    ],
    [t]
  );

  /** La columna viva se renderiza POR PÁGINAS: cada página es un wrapper
      (data-page) que el flujo añade debajo al cruzar y poda por delante
      cuando su pie sale del encuadre. Las claves son el número de página
      real — estables al añadir y al podar: los bloques NO se re-montan. */
  const pagesJsx = useMemo(() => {
    if (!win) return null;
    return win.pages.map((blocks, k) => {
      const pageNo = win.start + k;
      return (
        <div key={pageNo} className="tp-page" data-page={pageNo}>
          {(blocks ?? []).map((b, bi) => {
            // tarjeta de imagen (P2): UN span revelable que contiene la figura;
            // el encendido (.on) la desvela como el resto de letras
            if (b.image) {
              return (
                <p key={`${pageNo}-${bi}`} className="tp-block tp-img-block" data-block={bi}>
                  <span className="tp-ch tp-img">
                    <img src={b.image} alt="" draggable={false} decoding="async" />
                  </span>
                </p>
              );
            }
            // h1-h4 son títulos (mismo criterio que buildTeleprompterStream):
            // se presentan con su etiqueta y estilo de título
            const esTitulo = b.kind === "h1" || b.kind === "h2" || b.kind === "h3" || b.kind === "h4";
            const Tag = (esTitulo ? b.kind : "p") as "h1" | "h2" | "h3" | "h4" | "p";
            return (
              <Tag
                key={`${pageNo}-${bi}`}
                className={cn("tp-block", esTitulo && "tp-block-h font-display")}
                data-block={bi}
              >
                {Array.from(b.text).map((ch, j) => (
                  <span key={j} className="tp-ch">
                    {ch}
                  </span>
                ))}
              </Tag>
            );
          })}
        </div>
      );
    });
  }, [win]);

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
      {/* Fondo del escenario: portada del libro o imagen propia, SIEMPRE con
          filtro en runtime (oscurecer + desaturar + contraste) para que las
          letras se lean. «tema» no pinta nada: el color de la casa manda.
          La imagen NUNCA se modifica: el filtro es de la app. */}
      {fondoImg && (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden data-testid="tp-background">
          <img
            src={fondoImg}
            alt=""
            className="h-full w-full object-cover"
            style={{
              filter: `saturate(${100 - 0.8 * fondoFiltro}%) contrast(${100 + 0.25 * fondoFiltro}%) brightness(${100 - 0.45 * fondoFiltro}%)`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{ background: `rgb(4 8 20 / ${Math.min(88, 22 + 0.62 * fondoFiltro)}%)` }}
          />
        </div>
      )}

      {/* Recordatorio de teclas del teleprompter: aparece una vez al volver a
          la pestaña (ya no vigila el mouse, ver ShortcutGhost) */}
      <ShortcutGhost entries={tpGhostEntries} testId="tp-shortcut-ghost" />

      {/* Aviso de descanso (teleprompter-descanso-lectura): píldora con
          acciones en un corte natural — nunca a mitad de frase; no pausa
          sola, sugiere. Con acciones SÍ captura el puntero (.tp-rest-card). */}
      {descansoVisible && !descansoActivo && descansoMin > 0 && (
        <div
          className="tp-notice tp-rest-card"
          role="status"
          aria-live="polite"
          data-testid="tp-rest-notice"
        >
          <Coffee className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {t("tp.rest.suggest", { minutes: descansoMin })} · {t("tp.rest.ask")}
          </span>
          <Button size="sm" className="h-7 px-3 text-xs" onClick={descansarAhora} data-testid="tp-rest-take">
            {t("tp.rest.take")}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-3 text-xs" onClick={descansoCerrar} data-testid="tp-rest-skip">
            {t("tp.rest.skip")}
          </Button>
        </div>
      )}

      {/* Barra superior: identidad + progreso + controles (auto-ocultable).
          Con fondo (peticion de la duena): la banda .tp-header da armonia con
          la lectura y el texto no compite con el libro. */}
      <div className="tp-chrome tp-header absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground/90">{book.title}</p>
          <p className="text-xs text-muted-foreground">
            {t("tp.status", {
              page: pageNum,
              total: numPages,
              speed: speedLabel,
            })}
          </p>
        </div>
        {/* Hoy de ESTE libro: mismo conteo que la cabecera del lector, vivo.
            En móvil se esconde (el dato vive en el lector y la barra no cabe). */}
        <span
          className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex"
          title={t("reader.goalBookTitle")}
          data-testid="tp-today"
        >
          <Target className="h-3.5 w-3.5" />
          {todayPages}/{todayGoal}
        </span>
        {/* Tamaño de letra vive en la sheet de ajustes (tecla A / botón): en
            móvil el par A−/A+ sobra y despeja la barra para el tacto. */}
        <Tip label={t("tp.fontTip", { pct: Math.round(fontScale * 100) })}>
          <div className="hidden items-center sm:flex" data-testid="tp-font-group">
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
        {/* Auto también vive en la sheet: en móvil fuera de la barra */}
        <Tip label={auto ? t("tp.autoOnTip") : t("tp.autoOffTip")}>
          <Button
            variant={auto ? "secondary" : "ghost"}
            size="sm"
            className={cn("hidden h-8 gap-1.5 text-xs sm:inline-flex", auto && "text-primary")}
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
              <Gauge className="h-4 w-4" /> {speedLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="z-[80] w-72 p-3" data-testid="tp-speed-menu">
            <p className="pb-2 text-[11px] font-medium text-muted-foreground">
              {t("tp.speedTitle")}
            </p>
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">{t("tp.instant")}</Label>
                <Switch
                  checked={instante}
                  onCheckedChange={(v) => setTeleprompter({ instante: v })}
                  aria-label={t("tp.instantAria")}
                  data-testid="tp-instant-switch"
                />
              </div>
              <div className={cn("grid gap-1.5", instante && "pointer-events-none opacity-40")}>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("tp.wps")}</Label>
                  <span className="text-xs font-medium tabular-nums text-foreground">{speedLabel}</span>
                </div>
                <Slider
                  min={TELEPROMPTER_WPS_MIN}
                  max={TELEPROMPTER_WPS_MAX}
                  step={TELEPROMPTER_WPS_STEP}
                  value={[wps]}
                  onValueChange={([v]) => setTeleprompter({ wps: clampTeleprompterWps(v) })}
                  aria-label={t("tp.wpsAria")}
                  data-testid="tp-wps-slider"
                />
                <p className="text-[11px] text-muted-foreground">{t("tp.wpsHint")}</p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Tip label={playing ? t("tp.pauseTip") : t("tp.playTip")}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-8 sm:w-8"
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? t("tp.pauseAria") : t("tp.playAria")}
            data-testid="tp-play"
          >
            {playing ? <Pause className="h-5 w-5 sm:h-4 sm:w-4" /> : <Play className="h-5 w-5 sm:h-4 sm:w-4" />}
          </Button>
        </Tip>
        <Tip label={t("tp.settingsTip")}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSettingsOpen(true)}
            aria-label={t("tp.settingsAria")}
            aria-haspopup="dialog"
            data-testid="tp-settings"
          >
            <Settings2 className="h-4 w-4" />
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

      {/* Descanso activo: velo con cuenta atrás (regla 20-20-20). La
          reanudación es explícita: la lectora puede estar lejos del teclado. */}
      {descansoActivo && (
        <div
          className="tp-rest-veil"
          role="dialog"
          aria-modal="true"
          aria-label={t("tp.rest.aria")}
          data-testid="tp-rest-overlay"
        >
          <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
            <Coffee className="h-6 w-6 text-primary" aria-hidden="true" />
            {descansoRestante > 0 ? (
              <>
                <p
                  className="font-display text-6xl font-semibold tabular-nums"
                  data-testid="tp-rest-count"
                >
                  {descansoRestante}
                </p>
                <p className="text-sm text-foreground/90">{t("tp.rest.tip")}</p>
              </>
            ) : (
              <p className="font-display text-lg font-semibold" data-testid="tp-rest-done">
                {t("tp.rest.done")}
              </p>
            )}
            <Button size="sm" onClick={descansoTerminar} data-testid="tp-rest-continue">
              {t("tp.rest.continue")}
            </Button>
          </div>
        </div>
      )}

      {/* P4: ajustes del teleprompter, en modo (tecla A). Radix lo saca a
          portal: la jerarquía de Escape la gobierna settingsOpenRef arriba. */}
      <TeleprompterSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} book={book} />

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
      {/* El escenario NO avanza al hacer click (la dueña: «que no salte a la
          siguiente página»): avanzar es cosa del botón, la barra espaciadora
          o las flechas. En táctil: un TAP pausa/reanuda y arrastrar hacia
          atrás (releer) pausa — la simetría de la rueda hacia arriba. */}
      <div
        className="tp-stage absolute inset-0 z-10"
        data-testid="tp-stage"
        onPointerDown={(e) => {
          gestoRef.current = iniciarGesto(e.clientX, e.clientY, e.timeStamp);
        }}
        onPointerUp={(e) => {
          const g = gestoRef.current;
          gestoRef.current = null;
          if (!g) return;
          if (esTap(g, e.clientX, e.clientY, e.timeStamp)) {
            // mismo contrato que la barra espaciadora: en el corte de página
            // (pageDone) el tap CRUZA como el botón; fuera de él, pausa/reanuda
            if (pageDone || bookDone) forward();
            else setPlaying((v) => !v);
          }
        }}
        onPointerCancel={() => {
          gestoRef.current = null;
        }}
        onTouchStart={(e) => {
          const t0 = e.touches[0];
          if (!t0) return;
          ultimoYRef.current = t0.clientY;
          // el dedo agarra la columna: la cámara en vuelo se detiene (cede)
          cancelViewAnim();
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (!t) return;
          const dy = t.clientY - ultimoYRef.current;
          ultimoYRef.current = t.clientY;
          // releer hacia atrás pausa el flujo (mismo contrato que la rueda
          // arriba en PC); arrastrar adelante deja seguir
          if (direccionArrastre(dy) === "atras") setPlaying(false);
        }}
        onTouchCancel={() => {
          gestoRef.current = null;
        }}
      >
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
              // Si había una transición en vuelo, se fija el scrollTop actual: así
              // se detiene también un scroll suave del compositor que la cámara
              // hubiera dejado en marcha (solo la primera vez, no en cada giro).
              if (cancelViewAnim()) e.currentTarget.scrollTop = e.currentTarget.scrollTop;
              if (e.deltaY < 0) setPlaying(false);
            }}
          >
            <div
              className="tp-stream mx-auto w-full max-w-[780px]"
              data-testid="tp-stream"
              data-page-start={win.start}
              data-pages={win.pages.length}
            >
              {pagesJsx}
            </div>
          </div>
        )}
      </div>

      {/* Controles inferiores (auto-ocultables). Con la misma banda que la
          cabecera (peticion de la duena: armonia arriba y abajo). En el centro,
          pausa/reanudar GRANDE: en el APK es el gesto del día a día y el botón
          pequeño de la cabecera se quedaba corto para el pulgar (44 px+). */}
      <div className="tp-chrome tp-footer absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 px-5 pb-4">
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 sm:h-9 sm:w-9"
          onClick={rewindOne}
          disabled={!win || (win.start <= 1 && lit <= 0)}
          aria-label={t("tp.rewind")}
          data-testid="tp-prev"
        >
          <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          size="icon"
          className="h-14 w-14 shadow-[var(--brutal-shadow)] sm:h-11 sm:w-11"
          onClick={() => {
            // barra espaciadora táctil: en corte de página o final, AVANZA
            if (pageDone || bookDone) forward();
            else setPlaying((v) => !v);
          }}
          disabled={atEnd}
          aria-label={playing && !pageDone && !bookDone ? t("tp.pauseAria") : t("tp.nextPageAria")}
          data-testid="tp-play-footer"
        >
          {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-11 gap-1.5 px-4 text-xs sm:h-9 sm:px-3"
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
});
