"use client";

import { BookDTO, GlobalStats } from "@/lib/types";

/** Agrupa sesiones por día (YYYY-MM-DD) sumando páginas y minutos */
export function groupSessionsByDay(
  sessions: { pagesRead: number; minutes: number; date: string }[]
): Map<string, { pages: number; minutes: number }> {
  const map = new Map<string, { pages: number; minutes: number }>();
  for (const s of sessions) {
    const d = new Date(s.date);
    const key = dayKey(d);
    const prev = map.get(key) ?? { pages: 0, minutes: 0 };
    map.set(key, {
      pages: prev.pages + s.pagesRead,
      minutes: prev.minutes + s.minutes,
    });
  }
  return map;
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Racha de días consecutivos leyendo (hoy o ayer como último día válido) */
export function computeStreak(dayMap: Map<string, { pages: number; minutes: number }>): number {
  let streak = 0;
  const today = new Date();
  // Si hoy no leyó pero ayer sí, la racha sigue viva (empieza por ayer)
  let cursor = new Date(today);
  if (!dayMap.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dayMap.has(dayKey(cursor))) return 0;
  }
  while (dayMap.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Ritmo medio de páginas/día en los últimos 7 días */
export function computeDailyRate7d(dayMap: Map<string, { pages: number; minutes: number }>): number {
  let pages = 0;
  let activeDays = 0;
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const entry = dayMap.get(dayKey(d));
    if (entry && entry.pages > 0) {
      pages += entry.pages;
      activeDays++;
    }
  }
  return pages / 7; // promedio diario sobre 7 días naturales
}

/** Ritmo medio de páginas/día en los últimos 30 días */
export function computeDailyRate30d(dayMap: Map<string, { pages: number; minutes: number }>): number {
  let pages = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const entry = dayMap.get(dayKey(d));
    if (entry && entry.pages > 0) pages += entry.pages;
  }
  return pages / 30;
}

/** Ritmo de toda la historia: páginas totales / días activos distintos */
export function computeAllTimeRate(dayMap: Map<string, { pages: number; minutes: number }>): number {
  let pages = 0;
  let activeDays = 0;
  for (const entry of dayMap.values()) {
    if (entry.pages > 0) {
      pages += entry.pages;
      activeDays++;
    }
  }
  return activeDays > 0 ? pages / activeDays : 0;
}

export type DailyRate = { pages: number; source: "7d" | "30d" | "total" } | null;

/**
 * Ritmo con reserva: primero los 7 días recientes, si no los 30 días, y como
 * último recurso el promedio de toda la historia. null = nunca se leyó nada.
 */
export function pickDailyRate(dayMap: Map<string, { pages: number; minutes: number }>): DailyRate {
  const r7 = computeDailyRate7d(dayMap);
  if (r7 > 0) return { pages: r7, source: "7d" };
  const r30 = computeDailyRate30d(dayMap);
  if (r30 > 0) return { pages: r30, source: "30d" };
  const all = computeAllTimeRate(dayMap);
  if (all > 0) return { pages: all, source: "total" };
  return null;
}

/** Fecha estimada de fin a ritmo actual */
export function estimateFinishDate(
  book: Pick<BookDTO, "totalPages" | "currentPage">,
  rate: number
): Date | null {
  if (rate <= 0) return null;
  // quedan por leer las páginas desde la actual (sin contar la que estás leyendo)
  const remaining = book.totalPages - (book.currentPage - 1);
  if (remaining <= 0) return null;
  const days = Math.ceil(remaining / rate);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDateEs(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Porcentaje de progreso con semántica de «páginas leídas»: en la pág. 1 el
 * libro está al 0 % (riel vacío tras un reinicio) y al llegar a la última
 * página se considera terminado (100 %).
 */
export function progressPct(book: BookDTO): number {
  if (book.totalPages <= 0) return 0;
  if (book.currentPage >= book.totalPages) return 100;
  return Math.max(0, Math.round(((book.currentPage - 1) / book.totalPages) * 100));
}

/** Límites de página de cada tramo del riel (hitos) */
export function milestonePages(totalPages: number, segments: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= segments; i++) {
    out.push(Math.round((i * totalPages) / segments));
  }
  return out;
}
