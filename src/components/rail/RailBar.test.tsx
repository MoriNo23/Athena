import { expect, test, afterEach } from "bun:test";
import { render, cleanup } from "@testing-library/react";
import { RailBar } from "@/components/rail/RailBar";
import type { RailSettings } from "@/core/types";

// RTL cachea su auto-cleanup entre archivos de test: limpieza explícita por archivo
afterEach(() => {
  cleanup();
});

/**
 * Riel de progreso (pulido móvil).
 *
 * Dos reglas visuales que en un teléfono de 412px marcan la diferencia
 * entre «veo que avanza» y «no veo nada»:
 *   1. la pista compacta de las tarjetas mide 8px (antes 6px, casi invisible);
 *   2. el relleno tiene un mínimo de 8px: con 1 página leída de 400 el
 *      porcentaje era una astilla de 1px.
 */

const settings = (patch: Partial<RailSettings> = {}): RailSettings => ({
  position: "bottom",
  segments: 10,
  theme: "egeo",
  showLabels: false,
  celebrate: false,
  ...patch,
});

test("la pista compacta horizontal mide 8px (h-2)", () => {
  const { container } = render(
    <RailBar totalPages={400} currentPage={10} settings={settings()} compact />
  );
  const pista = container.querySelector(".rail-track");
  expect(pista?.getAttribute("class")).toContain("h-2");
  expect(pista?.getAttribute("class")).not.toContain("h-1.5");
});

test("la pista compacta vertical mide 8px (w-2)", () => {
  const { container } = render(
    <RailBar totalPages={400} currentPage={10} settings={settings({ position: "left" })} compact />
  );
  const pista = container.querySelector(".rail-track");
  expect(pista?.getAttribute("class")).toContain("w-2");
});

test("el relleno tiene mínimo de 8px aunque el progreso sea mínimo", () => {
  const { container } = render(
    <RailBar totalPages={400} currentPage={2} settings={settings()} compact />
  );
  const relleno = container.querySelector(".rail-fill") as HTMLElement;
  // 1 página de 400 ≈ 0.25% ≈ 1px de ancho: sin el mínimo sería invisible
  expect(relleno.getAttribute("style")).toContain("width: 0.25%");
  expect(relleno.getAttribute("style")).toContain("min-width: 8px");
});

test("el relleno mínimo también aplica al riel vertical", () => {
  const { container } = render(
    <RailBar totalPages={400} currentPage={2} settings={settings({ position: "left" })} compact />
  );
  const relleno = container.querySelector(".rail-fill") as HTMLElement;
  expect(relleno.getAttribute("style")).toContain("min-height: 8px");
});

test("con libro terminado el relleno llega al 100%", () => {
  const { container } = render(
    <RailBar totalPages={400} currentPage={400} settings={settings()} compact />
  );
  const relleno = container.querySelector(".rail-fill") as HTMLElement;
  expect(relleno.getAttribute("style")).toContain("width: 100%");
});

test("se anuncia como progressbar con la página actual", () => {
  const { container } = render(
    <RailBar totalPages={120} currentPage={7} settings={settings()} compact />
  );
  const barra = container.querySelector('[role="progressbar"]') as HTMLElement;
  expect(barra?.getAttribute("aria-valuenow")).toBe("7");
  expect(barra?.getAttribute("aria-valuemax")).toBe("120");
});
