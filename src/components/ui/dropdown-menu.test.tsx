import { expect, test, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

// RTL cachea su auto-cleanup entre archivos de test: limpieza explícita por archivo
afterEach(() => {
  cleanup();
});

/**
 * Altura táctil de los ítems del menú desplegable (pulido móvil).
 *
 * Un ítem de menú de 32 px es un blanco diminuto para un dedo: en pointer
 * coarse sube a 44 px reales (min-h-11) y en escritorio vuelve a su altura
 * natural (sm:min-h-0). Se comprueba sobre el menú ABIERTO porque las
 * clases viven en el nodo renderizado vía portal.
 */

const menu = (
  <DropdownMenu open>
    <DropdownMenuTrigger asChild>
      <button>Acciones</button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem data-testid="dd-item">Abrir libro</DropdownMenuItem>
      <DropdownMenuCheckboxItem data-testid="dd-check" checked={false}>
        Marcar
      </DropdownMenuCheckboxItem>
      <DropdownMenuRadioGroup>
        <DropdownMenuRadioItem data-testid="dd-radio" value="uno">
          Uno
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger data-testid="dd-sub">Más</DropdownMenuSubTrigger>
      </DropdownMenuSub>
    </DropdownMenuContent>
  </DropdownMenu>
);

test("los ítems del menú miden 44px en móvil y altura natural en escritorio", () => {
  render(menu);
  for (const id of ["dd-item", "dd-check", "dd-radio", "dd-sub"]) {
    const c = screen.getByTestId(id).getAttribute("class") ?? "";
    expect(c).toContain("min-h-11");
    expect(c).toContain("sm:min-h-0");
  }
});

test("el menú abierto expone sus ítems al árbol accesible", () => {
  render(menu);
  expect(screen.getByTestId("dd-item").textContent).toContain("Abrir libro");
});
