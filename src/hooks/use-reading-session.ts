"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeStreak, groupSessionsByDay, dayKey } from "@/lib/reading";

type Pending = { pages: number; seconds: number };

/**
 * Extrae lo pendiente y decide si vale la pena enviar; muta los refs
 * (páginas a cero, última página enviada alineada). currentPage solo se marca
 * como cambiado si difiere del último flush: así un cliente inactivo (u otro
 * tab abierto) nunca revierte el progreso guardado por otro lado.
 */
function takePending(
  pending: Pending,
  page: number,
  lastFlushedPage: { current: number | null }
): { pagesRead: number; minutes: number; pageChanged: boolean; nothingNew: boolean } {
  const minutes = Math.floor(pending.seconds / 60);
  const pagesRead = pending.pages;
  pending.pages = 0;
  pending.seconds -= minutes * 60;
  const pageChanged = page !== lastFlushedPage.current;
  const nothingNew = pagesRead === 0 && minutes === 0 && !pageChanged;
  if (pageChanged) lastFlushedPage.current = page;
  return { pagesRead, minutes, pageChanged, nothingNew };
}

/**
 * Motor de sesión de lectura: cronómetro con volcado periódico, guardado con
 * debounce (y fire-and-forget al desmontar), stats de hoy (racha/páginas/
 * minutos) y pausas en cortes naturales (se arma al cumplir la sesión
 * objetivo; el diálogo abre al girar página con la sesión cumplida).
 */
export function useReadingSession(opts: {
  bookId: string;
  initialPage: number;
  pauseEnabled: boolean;
  pauseMinutes: number;
}) {
  const { bookId, initialPage, pauseEnabled, pauseMinutes } = opts;

  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [todayStats, setTodayStats] = useState({ streak: 0, pagesToday: 0, minutesToday: 0 });
  /** páginas de hoy de ESTE libro: base del servidor + contador vivo de la sesión */
  const [bookPagesToday, setBookPagesToday] = useState(0);

  // ---------- Guardado de progreso ----------
  const pending = useRef<Pending>({ pages: 0, seconds: 0 });
  const lastSavedPage = useRef(initialPage);
  const lastFlushedPage = useRef<number | null>(null); // última página ENVIADA al servidor
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionSecRef = useRef(0);
  // «Hoy del libro»: base inmutable leída al montar + contador monótono de la
  // sesión. El contador propio NO es pending.pages: pending se vacía con cada
  // volcado al servidor y el par de la cabecera no puede menguar al guardar.
  const bookBaseRef = useRef(0);
  const bookLiveRef = useRef(0);

  // ---------- Pausas en cortes naturales ----------
  const [pauseArmed, setPauseArmed] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [pauseDraft, setPauseDraft] = useState("");
  const pauseArmedRef = useRef(pauseArmed);
  const pauseDialogRef = useRef(pauseDialogOpen);
  const pauseCfgRef = useRef({ enabled: pauseEnabled, minutes: pauseMinutes });

  useEffect(() => {
    pauseArmedRef.current = pauseArmed;
    pauseDialogRef.current = pauseDialogOpen;
  }, [pauseArmed, pauseDialogOpen]);
  useEffect(() => {
    pauseCfgRef.current = { enabled: pauseEnabled, minutes: pauseMinutes };
  }, [pauseEnabled, pauseMinutes]);

  const dismissPause = useCallback(() => {
    sessionSecRef.current = 0;
    setSessionSeconds(0);
    setPauseArmed(false);
    setPauseDialogOpen(false);
  }, []);

  /** Abre el diálogo de pausa precargando el recordatorio guardado */
  const openPauseDialog = useCallback((getRecap: () => string) => {
    setPauseDraft(getRecap());
    setPauseDialogOpen(true);
  }, []);

  const flushSave = useCallback(
    async (pageOverride?: number) => {
      const page = pageOverride ?? lastSavedPage.current;
      const { pagesRead, minutes, pageChanged, nothingNew } = takePending(
        pending.current,
        page,
        lastFlushedPage
      );
      lastSavedPage.current = page;
      if (nothingNew) return;
      try {
        await fetch(`/api/books/${bookId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // currentPage solo se envía si cambió desde el último flush: así un
            // cliente inactivo (u otro tab abierto) nunca revierte el progreso
            // guardado por otro lado (p. ej. una sincronización manual).
            ...(pageChanged ? { currentPage: page } : {}),
            pagesRead,
            minutes,
          }),
          keepalive: true,
        });
      } catch (e) {
        console.warn("No se pudo guardar el progreso", e);
      }
    },
    [bookId]
  );

  /** Cancela el guardado con debounce pendiente (p. ej. antes de un salto manual) */
  const cancelScheduledSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  /** Guardado con debounce tras girar página */
  const scheduleSave = useCallback(
    (page: number) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushSave(page), 700);
    },
    [flushSave]
  );

  /** Registro de un giro de página: cuenta páginas leídas y arma el diálogo de pausa */
  const turn = useCallback((page: number, prev: number, silent: boolean, getRecap: () => string) => {
    if (silent) {
      // Salto silencioso (riel, peek, input, sync): no cuenta páginas leídas
      lastSavedPage.current = page;
      pending.current.pages = 0;
    } else {
      // registrar delta positivo desde la marca alta: solo cuentan páginas nuevas
      const delta = page - lastSavedPage.current;
      if (delta > 0) {
        pending.current.pages += delta;
        // La marca alta avanza AQUÍ y no solo en el volcado: dos giros dentro de
        // la ventana de debounce cuentan 1+1 (no el delta acumulado 1+2).
        lastSavedPage.current = page;
        // hoy del libro: mismas reglas de conteo (los saltos silenciosos no suman)
        bookLiveRef.current += delta;
        setBookPagesToday(bookBaseRef.current + bookLiveRef.current);
      }
    }

    // pausa en corte natural: al girar la página con la sesión cumplida
    // (los saltos silenciosos no abren el diálogo)
    if (!silent && pauseArmedRef.current && page > prev && !pauseDialogRef.current) {
      setPauseDraft(getRecap());
      setPauseDialogOpen(true);
    }
  }, []);

  // Stats de hoy (racha, páginas, minutos) + base de hoy de ESTE libro, al montar
  useEffect(() => {
    fetch("/api/books", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const books = data.books ?? [];
        const all = books.flatMap(
          (b: { sessions: { pagesRead: number; minutes: number; date: string }[] }) => b.sessions
        );
        const dayMap = groupSessionsByDay(all);
        const today = dayMap.get(dayKey(new Date())) ?? { pages: 0, minutes: 0 };
        setTodayStats({
          streak: computeStreak(dayMap),
          pagesToday: today.pages,
          minutesToday: today.minutes,
        });
        // base de hoy del libro abierto: sesiones de hoy de SU historial
        const mine = books.find((b: { id: string }) => b.id === bookId);
        const myToday = groupSessionsByDay(mine?.sessions ?? []).get(dayKey(new Date()));
        bookBaseRef.current = myToday?.pages ?? 0;
        setBookPagesToday(bookBaseRef.current + bookLiveRef.current);
      })
      .catch(() => undefined);
  }, [bookId]);

  // Cronómetro de sesión activa + volcado periódico de minutos + armado de pausa
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      pending.current.seconds += 1;
      const next = sessionSecRef.current + 1;
      sessionSecRef.current = next;
      setSessionSeconds(next);

      // pausa en cortes naturales: se arma al cumplir la sesión objetivo
      const cfg = pauseCfgRef.current;
      if (!cfg.enabled) {
        if (pauseArmedRef.current) setPauseArmed(false);
      } else if (next >= cfg.minutes * 60 && !pauseArmedRef.current) {
        setPauseArmed(true);
      }

      // Volcado parcial cada 5 min de minutos acumulados
      if (pending.current.seconds >= 300) {
        flushSave();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [flushSave]);

  // Guardar al salir del lector
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // fire-and-forget al desmontar; currentPage solo si cambió (ver takePending)
      const page = lastSavedPage.current;
      const { pagesRead, minutes, nothingNew } = takePending(pending.current, page, lastFlushedPage);
      if (nothingNew) return;
      fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagesRead, minutes }),
        keepalive: true,
      }).catch(() => undefined);
    };
  }, [bookId]);

  return {
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
  };
}
