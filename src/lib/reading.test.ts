/**
 * Tests del riel (change primeros-tests-de-la-casa): matemática pura de hitos
 * y porcentaje de progreso. Correr con `bun test src/lib/reading.test.ts`.
 */
import { expect, test } from "bun:test";
import { milestonePages, progressPct } from "@/lib/reading";
import type { BookDTO } from "@/lib/types";

/** libro mínimo para progressPct: solo importan totalPages y currentPage */
function libro(totalPages: number, currentPage: number): BookDTO {
  return { totalPages, currentPage } as BookDTO;
}

test("milestonePages: reparte el total en tramos y el último es el total", () => {
  expect(milestonePages(280, 10)).toEqual([28, 56, 84, 112, 140, 168, 196, 224, 252, 280]);
  expect(milestonePages(100, 4)).toEqual([25, 50, 75, 100]);
});

test("milestonePages: redondeo round en tramos que no dividen exacto", () => {
  expect(milestonePages(7, 3)).toEqual([2, 5, 7]); // round(2.33)=2, round(4.67)=5
  expect(milestonePages(10, 3)).toEqual([3, 7, 10]);
});

test("milestonePages: segments raros no explotan", () => {
  expect(milestonePages(280, 0)).toEqual([]);
  expect(milestonePages(280, -3)).toEqual([]);
  expect(milestonePages(280, NaN)).toEqual([]);
  // no-entero: solo los enteros >= 1 cuentan
  expect(milestonePages(280, 2.9)).toEqual([97, 193]);
});

test("milestonePages: totalPages 0 o negativo con segments válidos da ceros", () => {
  expect(milestonePages(0, 4)).toEqual([0, 0, 0, 0]);
  // entrada absurda (páginas negativas): no explota; ojo que Math.round(-2.5)
  // es -2 (JS redondea .5 hacia arriba)
  expect(milestonePages(-5, 2)).toEqual([-2, -5]);
});

test("progressPct: página 1 es 0 % (riel vacío tras reinicio)", () => {
  expect(progressPct(libro(280, 1))).toBe(0);
});

test("progressPct: llegar a la última página es 100 %", () => {
  expect(progressPct(libro(280, 280))).toBe(100);
  expect(progressPct(libro(280, 281))).toBe(100); // pasarse no resta
});

test("progressPct: puntos intermedios", () => {
  expect(progressPct(libro(280, 2))).toBe(0); // round(1/280*100)=0
  expect(progressPct(libro(280, 71))).toBe(25);
  expect(progressPct(libro(280, 140))).toBe(50);
});

test("progressPct: totalPages inválido es 0 %", () => {
  expect(progressPct(libro(0, 5))).toBe(0);
  expect(progressPct(libro(-10, 1))).toBe(0);
});
