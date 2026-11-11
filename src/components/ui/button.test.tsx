import { expect, test, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { Button } from "@/components/ui/button";

// RTL cachea su auto-cleanup entre archivos de test: limpieza explícita por archivo
afterEach(() => {
  cleanup();
});

/**
 * Escala táctil del botón de la casa (pulido móvil).
 *
 * En pantalla de móvil (pointer: coarse) todo control primario mide 44 px
 * de alto REAL — no solo la zona caliente de .tap-44 — porque el dedo no
 * ve zonas invisibles. En escritorio (sm:) vuelve la escala compacta
 * original. Las barras que pinchan su altura con className explícito
 * siguen mandando sobre estos defaults.
 */

function clasesDe(name: string): string {
  return screen.getByRole("button", { name }).getAttribute("class") ?? "";
}

test("tamaño default: 44px en móvil, 36px en escritorio", () => {
  render(<Button>Primario</Button>);
  const c = clasesDe("Primario");
  expect(c).toContain("h-11");
  expect(c).toContain("sm:h-9");
});

test("tamaño sm: 44px en móvil, 32px en escritorio", () => {
  render(<Button size="sm">Compacto</Button>);
  const c = clasesDe("Compacto");
  expect(c).toContain("h-11");
  expect(c).toContain("sm:h-8");
});

test("tamaño lg: 48px en móvil, 40px en escritorio", () => {
  render(<Button size="lg">Grande</Button>);
  const c = clasesDe("Grande");
  expect(c).toContain("h-12");
  expect(c).toContain("sm:h-10");
});

test("tamaño icon: cuadrado de 44px en móvil, 36px en escritorio", () => {
  render(
    <Button size="icon" aria-label="Acción">
      <span aria-hidden>✓</span>
    </Button>
  );
  const c = clasesDe("Acción");
  expect(c).toContain("size-11");
  expect(c).toContain("sm:size-9");
});

test("la altura explícita del caller sobrevive al merge (patrón de barra)", () => {
  // Las barras densas (p. ej. la cabecera del lector) pinnean h-8 w-8 sobre
  // el size del variante y confían en el orden del CSS de Tailwind (h/w
  // mandan sobre size-*). El contrato de cn() es que esas clases NO se
  // pierdan en el merge.
  render(
    <Button size="icon" className="h-8 w-8" aria-label="En barra">
      <span aria-hidden>↩</span>
    </Button>
  );
  const c = clasesDe("En barra");
  expect(c).toContain("h-8");
  expect(c).toContain("w-8");
});
