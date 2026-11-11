import { beforeEach, afterEach, expect, jest, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { useImmersiveWake } from "@/hooks/use-immersive-wake";

/**
 * Inmersión de lectura en táctil (pulido móvil, P0).
 *
 * En un teléfono no hay mouse: el chrome dormido no volvía nunca. El
 * contrato nuevo se prueba aquí de punta a punta:
 *   - sin actividad, la UI se esconde sola tras idleSeconds;
 *   - un TAP (dedo quieto y breve) la despierta;
 *   - un arrastre NO la despierta (solo rearma, como la rueda en PC);
 *   - si la escondió la tecla del usuario, ni el tap la devuelve.
 */

function Arnes(props: { enabled?: boolean; overlaysAbierto?: boolean }) {
  const chromeHiddenRef = useRef(false);
  const hiddenByKeyRef = useRef(false);
  const pointerOnChromeRef = useRef(false);
  const overlaysOpenRef = useRef(props.overlaysAbierto ?? false);
  const [chromeHidden, setChromeHidden] = useState(false);
  useImmersiveWake({
    enabled: props.enabled ?? true,
    idleSeconds: 2, // mínimo del clamp interno: avance rápido en el test
    chromeHiddenRef,
    hiddenByKeyRef,
    pointerOnChromeRef,
    overlaysOpenRef,
    setChromeHidden,
  });
  return (
    <div>
      <span data-testid="chrome" data-hidden={String(chromeHidden)} />
      {/* palancas del arnes: simulan los caminos que en la app real toca ReaderView */}
      <button
        data-testid="esconder-con-tecla"
        onClick={() => {
          hiddenByKeyRef.current = true;
          chromeHiddenRef.current = true;
          setChromeHidden(true);
        }}
      >
        tecla
      </button>
    </div>
  );
}

/** touchstart/touchend crudos: el hook solo lee touches[0]/changedTouches[0] */
function toque(
  tipo: "touchstart" | "touchend",
  puntos: { x: number; y: number }[],
  destino: HTMLElement = document.body
) {
  const ev = new Event(tipo, { bubbles: true, cancelable: true });
  const dedos = puntos.map((p) => ({ clientX: p.x, clientY: p.y }));
  Object.defineProperty(ev, "touches", { value: dedos });
  Object.defineProperty(ev, "changedTouches", { value: dedos });
  destino.dispatchEvent(ev);
}

const oculto = () => screen.getByTestId("chrome").getAttribute("data-hidden");

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

test("tras idleSeconds sin actividad, el chrome se esconde solo", () => {
  render(<Arnes />);
  expect(oculto()).toBe("false");
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(oculto()).toBe("true");
});

test("un tap despierta el chrome escondido", () => {
  render(<Arnes />);
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(oculto()).toBe("true");

  // dedo quieto: baja y sube en el mismo punto (esTap = true);
  // dentro de act() para que el setState del wake se vuelque al DOM
  act(() => {
    toque("touchstart", [{ x: 100, y: 300 }]);
    toque("touchend", [{ x: 100, y: 300 }]);
  });
  expect(oculto()).toBe("false");
});

test("un arrastre NO despierta: solo rearma el temporizador", () => {
  render(<Arnes />);
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(oculto()).toBe("true");

  // el dedo viaja 80px: no es tap — la lectura con gestos sigue inmersa
  act(() => {
    toque("touchstart", [{ x: 100, y: 300 }]);
    toque("touchend", [{ x: 180, y: 300 }]);
  });
  expect(oculto()).toBe("true");

  // y el rearme deja la UI escondida tras otro ciclo de inactividad
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(oculto()).toBe("true");
});

test("si la escondió la tecla del usuario, el tap no la devuelve", () => {
  render(<Arnes />);
  act(() => {
    screen.getByTestId("esconder-con-tecla").click();
  });
  expect(oculto()).toBe("true");

  act(() => {
    toque("touchstart", [{ x: 50, y: 50 }]);
    toque("touchend", [{ x: 50, y: 50 }]);
  });
  expect(oculto()).toBe("true");
});

test("con un overlay abierto, la inactividad nunca esconde el chrome", () => {
  render(<Arnes overlaysAbierto />);
  act(() => {
    jest.advanceTimersByTime(5000);
  });
  expect(oculto()).toBe("false");
});

test("inmersión desactivada: el chrome se queda siempre visible", () => {
  render(<Arnes enabled={false} />);
  act(() => {
    jest.advanceTimersByTime(5000);
  });
  expect(oculto()).toBe("false");
});
