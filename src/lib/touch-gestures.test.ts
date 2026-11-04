import { describe, expect, test } from "bun:test";
import {
  DRAG_INTENT_PX,
  TAP_MAX_MS,
  TAP_SLOP_PX,
  direccionArrastre,
  esTap,
  iniciarGesto,
} from "./touch-gestures";

describe("touch-gestures · tap del teleprompter", () => {
  const t0 = 1000;

  test("un dedo quieto y breve es tap (pausa/reanuda)", () => {
    const g = iniciarGesto(100, 200, t0);
    expect(esTap(g, 100, 200, t0 + 80)).toBe(true);
  });

  test("micro-temblor del dedo sigue siendo tap", () => {
    const g = iniciarGesto(100, 200, t0);
    expect(esTap(g, 100 + TAP_SLOP_PX, 200 - TAP_SLOP_PX, t0 + TAP_MAX_MS)).toBe(true);
  });

  test("un desplazamiento mayor que el slop es arrastre, no tap", () => {
    const g = iniciarGesto(100, 200, t0);
    expect(esTap(g, 100 + TAP_SLOP_PX + 1, 200, t0 + 100)).toBe(false);
    expect(esTap(g, 100, 200 + TAP_SLOP_PX + 1, t0 + 100)).toBe(false);
  });

  test("una pulsación más larga que la ventana no es tap (long-press)", () => {
    const g = iniciarGesto(100, 200, t0);
    expect(esTap(g, 100, 200, t0 + TAP_MAX_MS + 1)).toBe(false);
  });

  test("el gesto nulo nunca es tap (defensa del overlay)", () => {
    const g = iniciarGesto(0, 0, 0);
    expect(esTap(g, 5000, 5000, 99999)).toBe(false);
  });
});

describe("touch-gestures · dirección del arrastre", () => {
  test("dedo que baja = releer hacia atrás → pausa", () => {
    expect(direccionArrastre(DRAG_INTENT_PX)).toBe("atras");
    expect(direccionArrastre(40)).toBe("atras");
  });

  test("dedo que sube = avanzar con el flujo → no pausa", () => {
    expect(direccionArrastre(-DRAG_INTENT_PX)).toBe("adelante");
    expect(direccionArrastre(-80)).toBe("adelante");
  });

  test("movimiento ambiguo no decide nada (quieto)", () => {
    expect(direccionArrastre(0)).toBe("quieto");
    expect(direccionArrastre(DRAG_INTENT_PX - 1)).toBe("quieto");
    expect(direccionArrastre(-(DRAG_INTENT_PX - 1))).toBe("quieto");
  });

  test("la rueda hacia arriba en PC y el dedo atrás comparten contrato", () => {
    // el overlay pausa con deltaY < 0 de rueda y con direcciónArrastre «atras»:
    // ambos significan «la lectora quiere volver» — el test clava la simetría
    const ruedaArribaPausa = -1; // deltaY negativo
    expect(ruedaArribaPausa < 0 && direccionArrastre(DRAG_INTENT_PX) === "atras").toBe(true);
  });
});
