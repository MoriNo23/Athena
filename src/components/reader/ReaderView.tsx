"use client";

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
import { useFinishEta } from "@/hooks/use-finish-eta";
import { useZoomPreset } from "@/hooks/use-zoom-preset";
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
import { ReaderStage } from "@/components/reader/ReaderStage";
import { PauseDialog } from "@/components/reader/PauseDialog";
import { TeleprompterOverlay } from "@/components/reader/TeleprompterOverlay";
import { useSettings } from "@/lib/settings";
import { useI18n, formatDate } from "@/lib/i18n";
import { useEpubBook } from "@/hooks/use-epub-book";
import { usePdfText } from "@/hooks/use-pdf-text";
import { epubPageText, type EpubPage } from "@/lib/epub";
import { paginatePdfText, type PdfTextIndex } from "@/lib/pdf-text";
import { probePdfTextLayer } from "@/lib/pdf-text-index";
import type { TeleprompterBlock } from "@/lib/teleprompter";
import { clampTeleprompterFontScale, TELEPROMPTER_FONT_STEP } from "@/lib/types";
import type { BookDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface ReaderViewProps {
  book: BookDTO;
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [vocabOpen, setVocabOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [tpOpen, setTpOpen] = useState(false);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  // true cuando corremos embebidos (iframe del preview) y el teclado está en el padre
  const [embeddedNoFocus, setEmbeddedNoFocus] = useState(false);

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
    (target: number, opts?: { silent?: boolean }) => {
      const clamped = Math.min(Math.max(1, Math.round(target)), numPages);
      const prev = pageNumRef.current;
      if (clamped === prev) return;
      pageNumRef.current = clamped;
      setPageNum(clamped);
      const silent = opts?.silent ?? false;
      turn(clamped, prev, silent, () => extrasRef.current.pause?.recap ?? "");
      commitMilestones(clamped, silent);
      scheduleSave(clamped);
    },
    [numPages, setPageNum, turn, commitMilestones, scheduleSave, extrasRef]
  );

  // ---------- Modo texto del PDF (Página | Texto) ----------
  // El toggle solo se ofrece con capa de texto real y el modo se recuerda en el
  // libro (`extras.readerMode`). El visor de páginas queda montado debajo
  // (tapado) para no perder el documento ni sus paneles.
  const [hasTextLayer, setHasTextLayer] = useState(false);

  useEffect(() => {
    if (isEpub || !doc) return;
    let alive = true;
    probePdfTextLayer(doc)
      .then((ok) => alive && setHasTextLayer(ok))
      .catch(() => alive && setHasTextLayer(false));
    return () => {
      alive = false;
    };
  }, [isEpub, doc]);

  const textMode = !isEpub && hasTextLayer && extras.readerMode === "text";

  // Extracción en segundo plano: la lectura arranca con el prefijo ya listo
  const {
    ready: textReady,
    total: textTotal,
    page: textPage,
    ensurePage: textEnsure,
  } = usePdfText(textMode ? book.id : null, textMode ? doc : null);

  /** páginas virtuales del prefijo extraído (null mientras no hay nada paginable) */
  const textIndex = useMemo<PdfTextIndex | null>(() => {
    if (!textMode || textReady === 0) return null;
    const realPages = Array.from({ length: textReady }, (_, i) => textPage(i + 1) ?? []);
    return paginatePdfText(realPages);
  }, [textMode, textReady, textPage]);

  // Navegación virtual: la elección local solo vale dentro de su página real;
  // lo demás se deriva de `pageNum` (nada de espejos en efectos).
  const [localVirtual, setLocalVirtual] = useState<number | null>(null);
  const textLastReal =
    textIndex && textIndex.pages.length > 0 ? textIndex.pageStart[textIndex.pages.length - 1] : 0;
  /** página real pedida por el riel que aún no es paginable (el visor espera con indicador) */
  const waitingReal = textMode && textIndex !== null && pageNum > textLastReal ? pageNum : null;
  /** página virtual actual (1-based) */
  const textVirtual = useMemo(() => {
    if (!textIndex || textIndex.pages.length === 0) return 1;
    if (
      localVirtual !== null &&
      localVirtual >= 1 &&
      localVirtual <= textIndex.pages.length &&
      textIndex.pageStart[localVirtual - 1] === pageNum
    ) {
      return localVirtual;
    }
    const v = textIndex.realToVirtual[pageNum - 1] ?? -1;
    return v >= 0 ? v + 1 : 1;
  }, [textIndex, pageNum, localVirtual]);

  // La página que espera el riel se adelanta en la extracción (prioridad)
  useEffect(() => {
    if (waitingReal === null) return;
    void textEnsure(waitingReal);
  }, [waitingReal, textEnsure]);

  /** Navegación virtual: la página real de origen manda para riel, hitos y ETA */
  const goToVirtual = useCallback(
    (v: number, opts?: { silent?: boolean }) => {
      if (!textIndex || textIndex.pages.length === 0) return;
      const clamped = Math.max(1, Math.min(textIndex.pages.length, Math.round(v)));
      setLocalVirtual(clamped);
      goToPage(textIndex.pageStart[clamped - 1], opts);
    },
    [textIndex, goToPage]
  );

  /** Saltos de fuera del reflujo (riel, número de página, peek): sin ancla local */
  const jumpOutsideText = useCallback(
    (p: number, opts?: { silent?: boolean }) => {
      setLocalVirtual(null);
      goToPage(p, opts);
    },
    [goToPage]
  );

  const setPdfReadingMode = useCallback(
    (mode: "page" | "text") => {
      patchExtras({ readerMode: mode });
    },
    [patchExtras]
  );

  const silentJumpTo = useCallback(
    (p: number) => jumpOutsideText(p, { silent: true }),
    [jumpOutsideText]
  );

  /** modo texto con páginas virtuales listas: el teleprompter las consume */
  const tpTextMode = textMode && textIndex !== null && textIndex.pages.length > 0;

  /** bloques de una página virtual para el teleprompter (mismo contrato que el EPUB) */
  const tpVirtualBlocks = useCallback(
    async (v: number): Promise<TeleprompterBlock[]> => {
      const pages = textIndex?.pages;
      if (!pages || pages.length === 0) return [];
      const page = pages[Math.min(Math.max(1, Math.round(v)), pages.length) - 1];
      return page.blocks.map((b) => ({ kind: b.kind, text: b.text }));
    },
    [textIndex]
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

  // En EPUB o modo texto, «zoom» = tamaño de letra (teclas +/− y Ctrl+rueda)
  const hotkeyZoomBy = useCallback(
    (factor: number) => {
      if (isEpub || textMode) fontDelta(factor > 1 ? 1 : -1);
      else zoomBy(factor);
    },
    [isEpub, textMode, fontDelta, zoomBy]
  );
  const noopPreset = useCallback(() => {}, []);
  const noopZoomBy = useCallback(() => {}, []);

  // ---------- Pantalla completa ----------
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
  // Devuelve false cuando no puede desplazarse (ya en el borde o página entera
  // visible): el llamador interpreta eso como «gira la página».
  const scrollByStep = useCallback(
    (dir: 1 | -1): boolean => {
      const el = document.querySelector<HTMLElement>('[data-viewport="pdf"]');
      if (!el) return false;
      const maxTop = el.scrollHeight - el.clientHeight;
      if (maxTop <= 1) return false;
      if (dir === 1 && el.scrollTop >= maxTop - 2) return false;
      if (dir === -1 && el.scrollTop <= 2) return false;
      const step = el.clientHeight * (scrollStepPct / 100);
      el.scrollBy({ top: dir * step, behavior: "smooth" });
      return true;
    },
    [scrollStepPct]
  );

  // Atajos de teclado del lector (hook dedicado, spec crapper).
  // En modo texto, la unidad de navegación es la página VIRTUAL.
  useReaderHotkeys({
    goToPage: textMode ? goToVirtual : goToPage,
    pageNum: textMode ? textVirtual : pageNum,
    zoomBy: hotkeyZoomBy,
    toggleFullscreen,
    applyZoomPreset: isEpub || textMode ? noopPreset : applyZoomPreset,
    peekOpenRef: peek.peekOpenRef,
    scrollByStep,
    toggleHideUi,
    toggleKey,
  });

  // ---------- Foco del teclado en contextos embebidos (preview en iframe) ----------
  // Si la app corre dentro de un iframe, las teclas van al documento padre hasta
  // que el usuario hace click dentro de la app (limitación del navegador). En
  // cada interacción reclamamos el foco y mostramos una pastilla sutil mientras
  // el teclado no sea nuestro, para que el usuario sepa qué hacer.
  useEffect(() => {
    let embedded = false;
    try {
      embedded = window.self !== window.top;
    } catch {
      embedded = true; // acceso entre marcos bloqueado ⇒ embebidos
    }
    if (!embedded) return;
    const claim = () => window.focus();
    const sync = () => setEmbeddedNoFocus(!document.hasFocus());
    window.addEventListener("pointerdown", claim, { capture: true, passive: true });
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    sync();
    return () => {
      window.removeEventListener("pointerdown", claim, { capture: true });
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
    };
  }, []);

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
  const todayPagesShown = todayStats.pagesToday; // se actualiza al entrar; el guardado frecuente lo refleja al volver

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

  // Aviso de página sin texto: el riel pidió una página vacía y el flujo
  // continúa en la siguiente con contenido (realToVirtual ya la mapeó).
  const textEmptyNotice = useMemo(() => {
    if (!textMode || !textIndex || waitingReal !== null) return null;
    const page = textIndex.pages[textVirtual - 1];
    if (!page || page.realPage <= pageNum) return null;
    return t("reader.textEmptyPage", { n: pageNum, m: page.realPage });
  }, [textMode, textIndex, textVirtual, pageNum, waitingReal, t]);

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
      {/* --- Riel superior --- */}
      {rail.position === "top" && (
        <div data-chrome data-chrome-kind="railbar" className="border-b border-border/60 bg-card/40 px-10 pb-4 pt-3">
          {railNode}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* --- Riel lateral izquierdo --- */}
        {rail.position === "left" && (
          <aside data-chrome data-chrome-kind="aside" className="flex w-16 flex-col border-r border-border/60 bg-card/40 py-5">
            <div className="min-h-0 flex-1">{railNode}</div>
            <div className="mt-3 text-center text-xs tabular-nums text-muted-foreground">
              {pct}%
            </div>
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <ReaderHeader
            book={book}
            pct={pct}
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
            pdfMode={!isEpub && hasTextLayer ? (textMode ? "text" : "page") : null}
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
            dailyGoal={dailyGoal}
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

        {/* --- Riel lateral derecho --- */}
        {rail.position === "right" && (
          <aside data-chrome data-chrome-kind="aside" className="flex w-16 flex-col border-l border-border/60 bg-card/40 py-5">
            <div className="min-h-0 flex-1">{railNode}</div>
            <div className="mt-3 text-center text-xs tabular-nums text-muted-foreground">
              {pct}%
            </div>
          </aside>
        )}
      </div>

      {/* --- Riel inferior --- */}
      {rail.position === "bottom" && (
        <div data-chrome data-chrome-kind="railbar" className="border-t border-border/60 bg-card/40 px-10 pb-4 pt-2">
          {railNode}
        </div>
      )}

      {/* Zona caliente inferior: presionar + arrastrar hacia arriba = hojear páginas */}
      <div
        className="peek-hotzone fixed inset-x-0 bottom-0 z-40 h-5 select-none"
        onPointerDown={peek.onPeekDown}
        onPointerMove={peek.onPeekMove}
        onPointerUp={peek.onPeekUp}
        onPointerCancel={peek.onPeekCancel}
        data-testid="peek-hotzone"
      >
        <div className="peek-hint pointer-events-none absolute inset-x-0 bottom-0.5 mx-auto w-fit rounded-full border border-border/60 bg-card/90 px-3 py-0.5 text-[10px] text-muted-foreground opacity-0 shadow-lg backdrop-blur transition-opacity duration-300">
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
          doc={isEpub || tpTextMode ? null : doc}
          getPageBlocks={tpTextMode ? tpVirtualBlocks : isEpub ? epub.getPageBlocks : undefined}
          pageNum={tpTextMode ? textVirtual : pageNum}
          numPages={tpTextMode ? textIndex!.pages.length : numPages}
          sourceKey={tpTextMode ? "text" : isEpub ? "epub" : "pdf"}
          onGoToPage={tpTextMode ? goToVirtual : silentJumpTo}
          onClose={() => setTpOpen(false)}
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

      {/* Indicador sutil de guardado */}
      {busy && (
        <div data-chrome className="pointer-events-none fixed bottom-3 right-3 z-40 rounded-full border border-border/60 bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-lg">
          {t("rv.loadingPage")}
        </div>
      )}
    </div>
  );
}
