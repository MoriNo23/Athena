import { expect, test, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { BookCard } from "@/components/library/BookCard";
import type { BookWithSessions } from "@/hooks/use-library-books";
import type { RailTheme } from "@/core/types";

// RTL cachea su auto-cleanup entre archivos de test: limpieza explícita por archivo
afterEach(() => {
  cleanup();
});

/**
 * Tarjeta de libro de la biblioteca (pulido móvil).
 *
 * El caso de oro es el estado «terminado»: finishedAt es la fuente de
 * verdad (el reinicio la limpia). Antes el alta solo comparaba páginas y un
 * libro terminado con finishedAt pero currentPage por debajo del total
 * seguía ofreciendo «Continuar» + ETA — exactamente el estado que la dueña
 * veía en su teléfono. Aquí se clava el contrato para siempre.
 */

const propsBase = {
  segments: 10,
  theme: "egeo" as RailTheme,
  onOpen: () => {},
  onDelete: () => {},
  onEdit: () => {},
  onReset: () => {},
};

function libro(patch: Partial<BookWithSessions> = {}): BookWithSessions {
  return {
    id: "libro-1",
    title: "La casa de la sabiduría",
    author: "Ada de Mileto",
    fileName: "casa.epub",
    filePath: "/biblioteca/casa.epub",
    coverPath: null,
    totalPages: 120,
    currentPage: 43,
    milestones: null,
    dailyGoal: null,
    companionPath: null,
    companionPages: null,
    extras: null,
    finishedAt: null,
    readCount: 0,
    badge: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastReadAt: null,
    sessions: [],
    ...patch,
  };
}

test("terminado por finishedAt (aunque queden páginas): CTA «Volver a leer» y sin ETA", () => {
  render(
    <BookCard
      {...propsBase}
      book={libro({ finishedAt: "2026-11-01T22:00:00.000Z", currentPage: 118, totalPages: 120 })}
    />
  );
  // la insignia de terminado sobre la portada
  expect(screen.queryByTestId("card-today-summary") == null).toBe(true);
  const cta = screen.getByRole("button", { name: /volver a leer/i });
  expect(cta != null).toBe(true);
  // nada de promesas de fecha de fin para un libro ya terminado
  expect(screen.queryByText(/a tu ritmo, terminas/i) == null).toBe(true);
});

test("terminado por páginas (sin finishedAt): también «Volver a leer»", () => {
  render(<BookCard {...propsBase} book={libro({ currentPage: 120, totalPages: 120 })} />);
  expect(screen.getByRole("button", { name: /volver a leer/i }) != null).toBe(true);
});

test("en plena lectura: CTA «Continuar» y ETA visible con ritmo", () => {
  const hoy = new Date().toISOString();
  render(
    <BookCard
      {...propsBase}
      book={libro({
        currentPage: 43,
        sessions: [{ pagesRead: 12, minutes: 20, date: hoy }],
      })}
    />
  );
  expect(screen.getByRole("button", { name: /continuar/i }) != null).toBe(true);
  expect(screen.queryByText(/a tu ritmo, terminas/i) != null).toBe(true);
});

test("recién llegado (página 1, sin sesiones): CTA «Empezar a leer»", () => {
  render(<BookCard {...propsBase} book={libro({ currentPage: 1 })} />);
  expect(screen.getByRole("button", { name: /empezar a leer/i }) != null).toBe(true);
});

test("las acciones de tarjeta exponen 44px táctiles en móvil", () => {
  render(<BookCard {...propsBase} book={libro()} />);
  const editar = screen.getByTestId("card-edit");
  expect(editar.getAttribute("class")).toContain("h-11");
  expect(editar.getAttribute("class")).toContain("w-11");
  expect(editar.getAttribute("class")).toContain("sm:h-8");
  const reiniciar = screen.getByTestId("card-reset");
  expect(reiniciar.getAttribute("class")).toContain("h-11");
  // el borrado no lleva data-testid: se alcanza por su nombre accesible
  const borrar = screen.getByRole("button", { name: /eliminar/i });
  expect(borrar.getAttribute("class")).toContain("h-11");
});

test("la fila de metadatos apila en móvil y despliega en escritorio", () => {
  render(<BookCard {...propsBase} book={libro()} />);
  const paginas = screen.getByText(/pág\. 43 de 120/i).closest("div");
  const c = paginas?.getAttribute("class") ?? "";
  expect(c).toContain("flex-col");
  expect(c).toContain("sm:flex-row");
});

test("meta diaria cumplida: el resumen de hoy nombra las páginas", () => {
  const hoy = new Date().toISOString();
  render(
    <BookCard
      {...propsBase}
      book={libro({
        currentPage: 43,
        sessions: [{ pagesRead: 25, minutes: 40, date: hoy }],
      })}
    />
  );
  // meta global por defecto: 20 páginas; hoy lleva 25
  expect(screen.getByTestId("card-today-summary").textContent).toContain("25/20");
  expect(screen.getByTestId("card-today-summary").textContent).toContain("pág");
});
