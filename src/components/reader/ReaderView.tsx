"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useImmersiveWake } from "@/hooks/use-immersive-wake";
import { useReaderHotkeys } from "@/hooks/use-reader-hotkeys";
import { useBookExtras } from "@/hooks/use-book-extras";
import { useBookMilestones } from "@/hooks/use-book-milestones";
import { useReadingSession } from "@/hooks/use-reading-session";
import { useFinishBadge } from "@/hooks/use-finish-badge";
import { useMilestoneCelebration } from "@/hooks/use-milestone-celebration";
import { usePeekGesture } from "@/hooks/use-peek-gesture";
import { useImmerseHint } from "@/hooks/use-immerse-hint";
import { useFinishEta } from "@/hooks/use-finish-eta";
import { useZoomPreset } from "@/hooks/use-zoom-preset";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useEmbeddedFocus } from "@/hooks/use-embedded-focus";
import { useScrollStep } from "@/hooks/use-scroll-step";
import { usePdfTextMode } from "@/hooks/use-pdf-text-mode";
import { RailBar } from "@/components/rail/RailBar";
import { PdfViewport } from "@/components/reader/PdfViewport";
import { EpubViewport } from "@/components/reader/EpubViewport";
import { PdfTextView } from "@/components/reader/PdfTextView";
import { ConfigPanel } from "@/components/reader/ConfigPanel";
import { DictionaryPopover } from "@/components/reader/DictionaryPopover";
import { VocabularySheet } from "@/components/reader/VocabularySheet";
import { PagePeek } from "@/components/reader/PagePeek";
import { ModeDock } from "@/components/modes/ModeDock";
import { ReaderHeader } from "@/components/reader/ReaderHeader";
// El stage pesa (pdf.js y el motor epub viven dentro): carga perezosa —
// nada lo pide antes de abrir un libro. En dev self-host el boot de '/'
// no descarga los motores (0 peticiones, ver perf-dev-net); en el build
// prerenderizado de Turbopack siguen en el preload del HTML (design §3).
const ReaderStage = dynamic(() => import("@/components/reader/ReaderStage").then((m) => m.ReaderStage), { ssr: false });
import { PauseDialog } from "@/components/reader/PauseDialog";
import { TeleprompterOverlay } from "@/components/reader/TeleprompterOverlay";
import { ShortcutGhost, type ShortcutGhostEntry } from "@/components/reader/ShortcutGhost";
import { useSettings } from "@/lib/settings";
import { useI18n, formatDate } from "@/lib/i18n";
import { useEpubBook } from "@/hooks/use-epub-book";
import { epubPageText, type EpubPage } from "@/lib/epub";
import type { TeleprompterBlock } from "@/lib/teleprompter";
import { clampTeleprompterFontScale, TELEPROMPTER_FONT_STEP } from "@/lib/types";
import type { BookDTO } from "@/lib/types";
import type { RailPosition } from "@/lib/types";
import type { BookWithSessions } from "@/hooks/use-library-books";
import { cn } from "@/lib/utils";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface ReaderViewProps {
  /** el lector recibe el libro CON sus sesiones (runtime de /api/books) */
  book: BookWithSessions;
  onBack: () => void;
  /** sincroniza el libro activo (p. ej. hitos individuales) con el estado raíz */
  onBookChange?: (book: BookDTO) => void;
}

/** Estado del lector según formato: EPUB nace del hook, PDF del visor. */
function readerStatus(
  isEpub: boolean,
  epub: { pages: EpubPage[] | null; loading: boolean; error: string | null },
  pdf: { numPages: number; busy: boolean; error: string | null },
  fallbackPages: number
): { numPages: number; busy: boolean; error: string | null } {
  if (isEpub) {
    return { numPages: epub.pages?.length ?? fallbackPages, busy: epub.loading, error: epub.error };
  }
  return pdf;
}

/** Modo del toggle «Página | Texto»: null cuando no hay capa de texto real. */
function pdfModeFor(
  isEpub: boolean,
  hasTextLayer: boolean,
  textMode: boolean
): "page" | "text" | null {
  if (isEpub || !hasTextLayer) return null;
  return textMode ? "text" : "page";
}

/** Propiedades del teleprompter según el dominio activo: página real, texto virtual o EPUB. */
function teleprompterSourceFor(args: {
  isEpub: boolean;
  tpTextMode: boolean;
  doc: PDFDocumentProxy | null;
  tpVirtualBlocks: ((v: number) => Promise<TeleprompterBlock[]>) | undefined;
  epubGetPageBlocks: ((page: number) => Promise<TeleprompterBlock[]>) | undefined;
  textVirtual: number;
  pageNum: number;
  textPages: number;
  numPages: number;
  /** DEBE ser estable entre renders: el motor del teleprompter depende de él */
  onGoToPage: (page: number, opts?: { silent?: boolean }) => void;
}) {
  const {
    isEpub,
    tpTextMode,
    doc,
    tpVirtualBlocks,
    epubGetPageBlocks,
    textVirtual,
    pageNum,
    textPages,
    numPages,
    onGoToPage,
  } = args;
  return {
    doc: isEpub || tpTextMode ? null : doc,
    getPageBlocks: tpTextMode ? tpVirtualBlocks : isEpub ? epubGetPageBlocks : undefined,
    pageNum: tpTextMode ? textVirtual : pageNum,
    numPages: tpTextMode ? textPages : numPages,
    sourceKey: tpTextMode ? "text" : isEpub ? "epub" : "pdf",
    onGoToPage,
  } as const;
}

/** Mapa de teclas del lector para el recordatorio fantasma (pantalla completa) */
function readerGhostEntriesFor(
  t: (k: string) => string,
  toggleKey: string
): ShortcutGhostEntry[] {
  return [
    { keys: "←/→", action: t("ghost.reader.pages") },
    { keys: "↑/↓", action: t("ghost.reader.scroll") },
    { keys: "+/−", action: t("ghost.reader.zoom") },
    { keys: "F", action: t("ghost.reader.fitPage") },
    { keys: "O", action: t("ghost.reader.fitOptimal") },
    { keys: "M", action: t("ghost.reader.fullscreen") },
    ...(toggleKey ? [{ keys: toggleKey.toUpperCase(), action: t("ghost.reader.hideUi") }] : []),
  ];
}

/** Recordatorio de teclas del lector: cada transición del chrome en pantalla
    completa (tecla o inactividad); fuera de ella no existe. */
function ReaderShortcutGhost(props: {
  isFullscreen: boolean;
  chromeHidden: boolean;
  entries: ShortcutGhostEntry[];
}) {
  if (!props.isFullscreen) return null;
  return <ShortcutGhost signal={props.chromeHidden} entries={props.entries} testId="reader-shortcut-ghost" />;
}

/** El riel donde lo pida el ajuste: lateral estrecho (64px + %) o franja
    horizontal del borde. Se retira a null si su lado no es el activo — así
    los cuatro condicionales del cuerpo del lector viven en un solo lugar. */
function ReaderRail({
  edge,
  position,
  pct,
  children,
}: {
  edge: RailPosition;
  position: RailPosition;
  pct: number;
  children: React.ReactNode;
}) {
  if (position !== edge) return null;
  if (edge === "left")
    return (
      <aside data-chrome data-chrome-kind="aside" className="flex w-16 flex-col border-r border-border/60 bg-card/40 py-5">
        <div className="min-h-0 flex-1">{children}</div>
        <div className="mt-3 text-center text-xs tabular-nums text-muted-foreground">
          {pct}%
        </div>
      </aside>
    );
  if (edge === "right")
    return (
      <aside data-chrome data-chrome-kind="aside" className="flex w-16 flex-col border-l border-border/60 bg-card/40 py-5">
        <div className="min-h-0 flex-1">{children}</div>
        <div className="mt-3 text-center text-xs tabular-nums text-muted-foreground">
          {pct}%
        </div>
      </aside>
    );
  if (edge === "top")
    return (
      <div data-chrome data-chrome-kind="railbar" className="border-b border-border/60 bg-card/40 px-10 pb-4 pt-3">
        {children}
      </div>
    );
  return (
    <div data-chrome data-chrome-kind="railbar" className="border-t border-border/60 bg-card/40 px-10 pb-4 pt-2">
      {children}
    </div>
  );
}

export function ReaderView({ book, onBack, onBookChange }: ReaderViewProps) {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const rail = useSettings((s) => s.rail);
  const dailyGoal = useSettings((s) => s.reading.dailyGoal);
  const scrollStepPct = useSettings((s) => s.reading.scrollStepPct);
  const readerFont = useSettings((s) => s.reading.font);
  const setReading = useSettings((s) => s.setReading);
  const toggleKey = useSettings((s) => s.immersion.toggleKey);
  const vocabularyCount = useSettings((s) => s.vocabulary.length);
  const immersion = useSettings((s) => s.immersion);
  const tpFontScale = useSettings((s) => s.teleprompter.fontScale);
  const setTeleprompter = useSettings((s) => s.setTeleprompter);

  /** EPUB: el libro reflowable se lee en páginas virtuales de texto */
  const isEpub = book.filePath.toLowerCase().endsWith(".epub");
  const epub = useEpubBook(isEpub ? book.filePath : null);

  // Hitos individuales del libro (null → hereda el global)
  const segments = Math.max(2, Math.min(40, book.milestones ?? rail.segments));

  // Estado del visor de PDF: para EPUB se deriva del hook (sin espejos en efectos)
  const [pdfNumPages, setPdfNumPages] = useState(book.totalPages);
  const [pageNum, setPageNum] = useState(book.currentPage);
  const [pdfBusy, setPdfBusy] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [vocabOpen, setVocabOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [tpOpen, setTpOpen] = useState(false);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);

  // ---------- Inmersión (ocultar UI por inactividad del mouse o con la tecla) ----------
  const [chromeHidden, setChromeHidden] = useState(false);
  const chromeHiddenRef = useRef(false);
  const hiddenByKeyRef = useRef(false); // la UI la escondió la tecla: el mouse no la despierta
  const wakeRearmRef = useRef<(() => void) | null>(null);
  const pointerOnChromeRef = useRef(false);
  const overlaysOpenRef = useRef(false);
  const pageNumRef = useRef(book.currentPage);

  const { extras, extrasRef, bookRef, patchExtras, dockOpen, setDockOpen, modes } = useBookExtras({
    book,
    onBookChange,
  });

  const status = readerStatus(
    isEpub,
    { pages: epub.pages, loading: epub.loading, error: epub.error },
    { numPages: pdfNumPages, busy: pdfBusy, error: pdfError },
    book.totalPages
  );
  const { numPages, busy, error } = status;

  const {
    sessionSeconds,
    todayStats,
    bookPagesToday,
    pauseArmed,
    pauseDialogOpen,
    pauseDraft,
    setPauseDraft,
    dismissPause,
    openPauseDialog,
    flushSave,
    cancelScheduledSave,
    scheduleSave,
    turn,
  } = useReadingSession({
    bookId: book.id,
    initialPage: book.currentPage,
    pauseEnabled: modes.toggles.naturalPauses,
    pauseMinutes: modes.pauseMinutes,
  });

  const { registerFinish } = useFinishBadge({
    bookId: book.id,
    bookTitle: book.title,
    bookRef,
    onBookChange,
  });

  const handleFinish = useCallback(() => {
    void registerFinish();
  }, [registerFinish]);

  const { commit: commitMilestones } = useMilestoneCelebration({
    bookTotalPages: book.totalPages,
    bookCurrentPage: book.currentPage,
    numPages,
    segments,
    celebrate: rail.celebrate,
    bookTitle: book.title,
    onFinish: handleFinish,
  });

  const goToPage = useCallback(
    (target: number, opts?: { silent?: boolean; noPause?: boolean }) => {
      const clamped = Math.min(Math.max(1, Math.round(target)), numPages);
      const prev = pageNumRef.current;
      if (clamped === prev) return;
      pageNumRef.current = clamped;
      setPageNum(clamped);
      const silent = opts?.silent ?? false;
      turn(clamped, prev, silent, () => extrasRef.current.pause?.recap ?? "", opts?.noPause ?? false);
      commitMilestones(clamped, silent);
      scheduleSave(clamped);
    },
    [numPages, setPageNum, turn, commitMilestones, scheduleSave, extrasRef]
  );

  // ---------- Modo texto del PDF (Página | Texto) ----------
  // El toggle solo se ofrece con capa de texto real y el modo se recuerda en el
  // libro (`extras.readerMode`). El visor de páginas queda montado debajo
  // (tapado) para no perder el documento ni sus paneles. El dominio completo
  // del reflujo (sondeo de capa, extracción, paginación y navegación virtual)
  // vive en el hook `use-pdf-text-mode`.
  const {
    hasTextLayer,
    textMode,
    textReady,
    textTotal,
    textIndex,
    textVirtual,
    waitingReal,
    goToVirtual,
    jumpOutsideText,
    setPdfReadingMode,
    tpTextMode,
    tpVirtualBlocks,
    textEmptyNotice,
  } = usePdfTextMode({
    book,
    doc,
    isEpub,
    pageNum,
    goToPage,
    patchExtras,
    readerMode: extras.readerMode,
  });

  const silentJumpTo = useCallback(
    (p: number) => jumpOutsideText(p, { silent: true }),
    [jumpOutsideText]
  );

  /**
   * Giro de página del teleprompter. Los giros CUENTAN como lectura (páginas de
   * hoy, hitos, fin de libro) en PDF, EPUB y modo texto; sin diálogo de pausa
   * (quedaría tras la capa inmersiva). IMPORTANTE: `useCallback` — el motor del
   * teleprompter lo tiene entre sus dependencias, y el lector se re-renderiza
   * cada segundo (cronómetro): una identidad nueva por render reiniciaba el
   * temporizador de las pausas largas (títulos) y el Auto se quedaba clavado.
   */
  const tpGoToPage = useCallback(
    (page: number, opts?: { silent?: boolean }) => {
      const o = { silent: opts?.silent ?? false, noPause: true };
      if (tpTextMode) goToVirtual(page, o);
      else jumpOutsideText(page, o);
    },
    [tpTextMode, goToVirtual, jumpOutsideText]
  );

  /** Extracto de texto de la página p para el carrusel peek (EPUB). */
  const epubTextPreview = useCallback(
    (p: number) => {
      const pages = epub.pages;
      if (!pages) return "";
      const page = pages[Math.min(Math.max(1, p), pages.length) - 1];
      return epubPageText(page);
    },
    [epub.pages]
  );

  // ---------- Peek: carrusel de páginas desde el borde inferior ----------
  const peek = usePeekGesture({
    initialPage: book.currentPage,
    numPages,
    getPage: () => pageNumRef.current,
    onJump: silentJumpTo,
  });

  // ---------- Zoom ----------
  const {
    setBaseWidth,
    setBaseHeight,
    setContainerW,
    setContainerH,
    effectiveScale,
    activeZoom,
    fitMode,
    zoomBy,
    applyZoomPreset,
  } = useZoomPreset();

  /** Tamaño de letra del lector (EPUB): mismo multiplicador global que el modo cinematográfico */
  const fontDelta = useCallback(
    (dir: 1 | -1) => {
      setTeleprompter({ fontScale: clampTeleprompterFontScale(tpFontScale + dir * TELEPROMPTER_FONT_STEP) });
    },
    [tpFontScale, setTeleprompter]
  );

  // Dominio reflow (EPUB nativo o modo texto del PDF): en él «zoom» = tamaño
  // de letra y los presets del visor de PDF no aplican.
  const reflowMode = isEpub || textMode;

  // En EPUB o modo texto, «zoom» = tamaño de letra (teclas +/− y Ctrl+rueda)
  const hotkeyZoomBy = useCallback(
    (factor: number) => {
      if (reflowMode) fontDelta(factor > 1 ? 1 : -1);
      else zoomBy(factor);
    },
    [reflowMode, fontDelta, zoomBy]
  );
  const noopPreset = useCallback(() => {}, []);
  const noopZoomBy = useCallback(() => {}, []);

  // ---------- Pantalla completa ----------
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Pantalla despierta mientras la lectura está en pantalla completa.
  useWakeLock(isFullscreen);

  // ---------- Inmersión: la UI se desvanece si el mouse queda quieto ----------
  useEffect(() => {
    overlaysOpenRef.current =
      panelOpen || pauseDialogOpen || vocabOpen || peek.peekOpen || syncOpen;
  }, [panelOpen, pauseDialogOpen, vocabOpen, peek.peekOpen, syncOpen]);

  // Inmersión: oculta tras idleSeconds; SOLO el mouse despierta (teclas/rueda ejecutan en silencio).
  // Si la UI la ocultó la tecla, el mouse NO la despierta: la misma tecla la devuelve.
  useImmersiveWake({
    enabled: immersion.enabled,
    idleSeconds: immersion.idleSeconds,
    chromeHiddenRef,
    hiddenByKeyRef,
    pointerOnChromeRef,
    overlaysOpenRef,
    setChromeHidden,
    rearmRef: wakeRearmRef,
  });

  // ---------- Pista única de inmersión (P0 #2, extraída a hook): la primera
  // vez POR DISPOSITIVO que el chrome se esconde solo, cómo vuelve. El encendido
  // es solo por auto-ocultado de inactividad — el mensaje «mover el mouse»
  // sería falso si la UI la escondió la tecla (ahí el mouse no despierta).
  const immerseHint = useImmerseHint(chromeHidden, hiddenByKeyRef);

  // ---------- Inmersión manual: la tecla configurada oculta/muestra la UI al instante ----------
  const toggleHideUi = useCallback(() => {
    if (chromeHiddenRef.current) {
      // mostrar de nuevo y rearmar el auto-ocultado por inactividad
      hiddenByKeyRef.current = false;
      chromeHiddenRef.current = false;
      setChromeHidden(false);
      wakeRearmRef.current?.();
    } else {
      // con paneles/diálogos abiertos no escondemos nada por tecla
      if (overlaysOpenRef.current) return;
      hiddenByKeyRef.current = true;
      chromeHiddenRef.current = true;
      setChromeHidden(true);
    }
  }, [setChromeHidden]);

  // ---------- Salto vertical con ↑/↓ (fracción del visor configurable) ----------
  const scrollByStep = useScrollStep(scrollStepPct);

  // Atajos de teclado del lector (hook dedicado, spec crapper).
  // En modo texto, la unidad de navegación es la página VIRTUAL.
  useReaderHotkeys({
    goToPage: textMode ? goToVirtual : goToPage,
    pageNum: textMode ? textVirtual : pageNum,
    zoomBy: hotkeyZoomBy,
    toggleFullscreen,
    applyZoomPreset: reflowMode ? noopPreset : applyZoomPreset,
    peekOpenRef: peek.peekOpenRef,
    scrollByStep,
    toggleHideUi,
    toggleKey,
  });

  // ---------- Foco del teclado en contextos embebidos (preview en iframe) ----------
  const embeddedNoFocus = useEmbeddedFocus();

  // ---------- Hitos individuales del libro ----------
  const { patchBook } = useBookMilestones({ book, onBookChange });

  // ---------- "¿En qué día acabo este libro?" (a mi ritmo real) ----------
  const etaDate = useFinishEta({ bookId: book.id, livePage: pageNum, totalPages: numPages });
  const etaLabel = etaDate ? t("reader.eta", { date: formatDate(etaDate, lang) }) : null;

  const handleDocReady = useCallback(
    (n: number, w: number, h: number) => {
      setPdfNumPages(n);
      setBaseWidth(w);
      setBaseHeight(h);
    },
    [setPdfNumPages, setBaseWidth, setBaseHeight]
  );

  const railNode = (
    <RailBar
      totalPages={numPages}
      currentPage={pageNum}
      settings={{ ...rail, segments }}
      onSeek={silentJumpTo}
    />
  );

  const pct = Math.round((pageNum / numPages) * 100);
  const sessionMin = Math.floor(sessionSeconds / 60);
  // «Hoy» de ESTE libro (base de montaje + contador vivo) contra su meta efectiva:
  // la meta propia del libro manda; sin ella, el mínimo global de ajustes.
  const effectiveGoal = book.dailyGoal ?? dailyGoal;
  const todayPagesShown = bookPagesToday; // vivo durante la sesión: sube con cada giro contable

  // Mapa de teclas del lector para el recordatorio fantasma (pantalla completa)
  const readerGhostEntries = useMemo(() => readerGhostEntriesFor(t, toggleKey), [t, toggleKey]);

  // Lectura dual activa: toggle + PDF compañero cargado
  const dualActive = modes.toggles.dualRead && !!book.companionPath && !!book.companionPages;
  const dockVisible = dockOpen;

  const takePause = () => {
    const recap = pauseDraft.trim() || extrasRef.current.pause?.recap || "";
    patchExtras({ pause: { recap, pausesTaken: (extrasRef.current.pause?.pausesTaken ?? 0) + 1 } });
    dismissPause();
    toast({
      title: t("rv.pauseToastTitle"),
      description: t("rv.pauseToastBody"),
      duration: 3500,
    });
  };

  const pdfViewport = (
    <PdfViewport
      key={book.filePath}
      filePath={book.filePath}
      pageNum={pageNum}
      scale={effectiveScale}
      onDocReady={handleDocReady}
      onContainerWidth={setContainerW}
      onContainerHeight={setContainerH}
      bleed={fitMode}
      center={activeZoom === "page"}
      onZoomGesture={zoomBy}
      onBusyChange={setPdfBusy}
      onError={setPdfError}
      onDoc={setDoc}
      suspended={textMode}
    />
  );

  // Modo texto: reflujo sobre el visor de páginas (que sigue montado debajo)
  const pdfTextView = (
    <PdfTextView
      index={textIndex}
      virtualPage={textVirtual}
      waitingReal={waitingReal}
      notice={textEmptyNotice}
      ready={textReady}
      total={textTotal}
      fontScale={tpFontScale}
      onFontDelta={fontDelta}
    />
  );

  // EPUB: visor de páginas virtuales (el zoom de PDF no aplica; la letra manda)
  const epubViewport = (
    <EpubViewport
      key={book.filePath}
      pages={epub.pages}
      pageNum={pageNum}
      fontScale={tpFontScale}
      onFontDelta={fontDelta}
    />
  );

  const viewport = isEpub ? epubViewport : pdfViewport;

  return (
    <div
      data-reader-font={readerFont}
      className={cn(
        "flex h-screen flex-col overflow-hidden",
        chromeHidden && "chrome-immersed"
      )}
    >
      {/* Riel superior (se retira a null si el ajuste lo pone en otro lado) */}
      <ReaderRail edge="top" position={rail.position} pct={pct}>{railNode}</ReaderRail>

      <div className="flex min-h-0 flex-1">
        {/* Riel lateral izquierdo */}
        <ReaderRail edge="left" position={rail.position} pct={pct}>{railNode}</ReaderRail>

        <div className="flex min-w-0 flex-1 flex-col">
          <ReaderHeader
            book={book}
            numPages={numPages}
            pageNum={pageNum}
            goToPage={jumpOutsideText}
            onBack={onBack}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            effectiveScale={effectiveScale}
            activeZoom={activeZoom}
            onZoomBy={isEpub ? noopZoomBy : zoomBy}
            onPreset={isEpub ? noopPreset : applyZoomPreset}
            isEpub={isEpub}
            epubFontScale={tpFontScale}
            onEpubFontDelta={fontDelta}
            pdfMode={pdfModeFor(isEpub, hasTextLayer, textMode)}
            onPdfModeChange={setPdfReadingMode}
            readerFont={readerFont}
            onReaderFontChange={(f) => setReading({ font: f })}
            dockVisible={dockVisible}
            onToggleDock={() => setDockOpen((v) => !v)}
            tpOpen={tpOpen}
            onToggleTeleprompter={() => setTpOpen((v) => !v)}
            vocabularyCount={vocabularyCount}
            onOpenVocabulary={() => setVocabOpen(true)}
            todayStreak={todayStats.streak}
            pagesToday={todayPagesShown}
            dailyGoal={effectiveGoal}
            sessionMinutes={sessionMin}
            etaLabel={etaLabel}
            onOpenSettings={() => setPanelOpen(true)}
            syncOpen={syncOpen}
            onSyncOpenChange={setSyncOpen}
            currentPageRef={pageNumRef}
            onSilentJump={silentJumpTo}
            onCancelScheduledSave={cancelScheduledSave}
            onFlushSave={(p) => void flushSave(p)}
          />

          {/* --- Visor + dock de modos --- */}
          <div className="flex min-h-0 flex-1">
            <ReaderStage
              error={error}
              onBack={onBack}
              dualActive={dualActive}
              book={book}
              pageNum={pageNum}
              numPages={numPages}
              viewport={viewport}
              overlay={textMode ? pdfTextView : undefined}
              pauseArmed={pauseArmed}
              pauseDialogOpen={pauseDialogOpen}
              onOpenPause={() => openPauseDialog(() => extrasRef.current.pause?.recap ?? "")}
            />

            {/* Dock de modos de lectura */}
            {dockVisible && (
              <div data-chrome data-chrome-kind="dock" className="flex min-h-0 shrink-0">
                <ModeDock
                  book={book}
                  onBookChange={onBookChange}
                  extras={extras}
                  onPatch={patchExtras}
                  goToPage={silentJumpTo}
                  pageNum={pageNum}
                  numPages={numPages}
                  doc={isEpub ? null : doc}
                  epubChapters={isEpub ? epub.chapters : undefined}
                  sessionSeconds={sessionSeconds}
                  onClose={() => setDockOpen(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Riel lateral derecho */}
        <ReaderRail edge="right" position={rail.position} pct={pct}>{railNode}</ReaderRail>
      </div>

      {/* Riel inferior */}
      <ReaderRail edge="bottom" position={rail.position} pct={pct}>{railNode}</ReaderRail>

      {/* Zona caliente inferior: presionar + arrastrar hacia arriba = hojear páginas */}
      <div
        className="peek-hotzone fixed inset-x-0 bottom-0 z-40 h-5 select-none"
        onPointerDown={peek.onPeekDown}
        onPointerMove={peek.onPeekMove}
        onPointerUp={peek.onPeekUp}
        onPointerCancel={peek.onPeekCancel}
        data-testid="peek-hotzone"
      >
        <div className="peek-hint pointer-events-none absolute inset-x-0 bottom-0.5 mx-auto w-fit rounded-full border border-border/60 bg-card/90 px-3 py-0.5 text-xs text-muted-foreground opacity-0 shadow-lg backdrop-blur transition-opacity duration-300">
          {t("rv.peekHint")}
        </div>
      </div>

      {/* Carrusel de páginas (peek): miniaturas de PDF o extractos de texto EPUB */}
      <PagePeek
        open={peek.peekOpen}
        doc={isEpub ? null : doc}
        textPreview={isEpub ? epubTextPreview : undefined}
        totalPages={numPages}
        sel={peek.peekSel}
        originPage={pageNum}
        onSelect={(p) => {
          peek.setPeek(false);
          silentJumpTo(p);
        }}
        onScrub={peek.setPeekSel}
        onCancel={peek.onPeekCancel}
      />

      <ConfigPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        book={book}
        onPatchBook={patchBook}
      />

      {/* Diccionario por selección de palabra (se cierra al cambiar de página vía key) */}
      <DictionaryPopover
        key={`dict-${pageNum}`}
        enabled={modes.toggles.dictionary}
        bookId={book.id}
        bookTitle={book.title}
        page={pageNum}
      />

      {/* Vocabulario global */}
      <VocabularySheet open={vocabOpen} onOpenChange={setVocabOpen} />

      {/* Diálogo de pausa en corte natural */}
      <PauseDialog
        open={pauseDialogOpen}
        pageNum={pageNum}
        pauseMinutes={modes.pauseMinutes}
        draft={pauseDraft}
        onDraftChange={setPauseDraft}
        onClose={dismissPause}
        onTake={takePause}
      />

      {/* Modo teleprompter: la página se enciende letra a letra a pantalla
          completa, con su propia inmersión y pantalla completa. En modo texto
          lo alimentan las páginas VIRTUALES del PDF (mismo contrato que el
          EPUB); en modo página, las páginas reales. */}
      {tpOpen && (
        <TeleprompterOverlay
          book={book}
          {...teleprompterSourceFor({
            isEpub,
            tpTextMode,
            doc,
            tpVirtualBlocks,
            epubGetPageBlocks: epub.getPageBlocks,
            textVirtual,
            pageNum,
            textPages: textIndex?.pages.length ?? 0,
            numPages,
            onGoToPage: tpGoToPage,
          })}
          onClose={() => setTpOpen(false)}
          todayPages={todayPagesShown}
          todayGoal={effectiveGoal}
        />
      )}

      {/* Aviso de foco embebido: teclado inactivo hasta click dentro de la app */}
      {embeddedNoFocus && (
        <div
          className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/40 bg-card/95 px-3 py-1 text-xs text-foreground shadow-lg backdrop-blur"
          data-testid="kbd-focus-hint"
        >
          {t("rv.kbdHint")}
        </div>
      )}

      {/* Pista única de inmersión: la primera vez que el chrome se esconde
          solo, cómo vuelve (retirada a los ~4 s o al despertar) */}
      {immerseHint && chromeHidden && (
        <div
          className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/40 bg-card/95 px-3 py-1 text-xs text-foreground shadow-lg backdrop-blur"
          data-testid="immerse-hint"
        >
          {t("rv.immerseHint")}
        </div>
      )}

      {/* Recordatorio de teclas del lector: solo existe en pantalla completa */}
      <ReaderShortcutGhost
        isFullscreen={isFullscreen}
        chromeHidden={chromeHidden}
        entries={readerGhostEntries}
      />

      {/* Indicador sutil de guardado */}
      {busy && (
        <div data-chrome className="pointer-events-none fixed bottom-3 right-3 z-40 rounded-full border border-border/60 bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-lg">
          {t("rv.loadingPage")}
        </div>
      )}
    </div>
  );
}
