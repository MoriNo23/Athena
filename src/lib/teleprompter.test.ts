import { describe, expect, test } from "bun:test";
import {
  buildTeleprompterStream,
  msPorUnidad,
  teleprompterCharCount,
  teleprompterRewind,
  TELEPROMPTER_COMMA_PAUSE_LETTERS,
  TELEPROMPTER_HEADING_PAUSE_LETTERS,
  TELEPROMPTER_IMAGE_CHAR,
  TELEPROMPTER_LETTERS_PER_WORD,
  TELEPROMPTER_PERIOD_PAUSE_LETTERS,
  type TeleprompterBlock,
} from "./teleprompter";
import { plannedStepDelay, stepWait } from "./step-timer";

/**
 * Timeline en UNIDADES (change fluidez-velocidad): el flujo es el MISMO a
 * cualquier velocidad — el wps solo entra vía msPorUnidad al programar cada
 * paso. Cambiar la velocidad en marcha no reconstruye nada.
 */

const texto = (t: string): TeleprompterBlock => ({ kind: "p", text: t });

describe("stream en unidades de tempo", () => {
  test("cada letra paga 1 unidad; la puntuación respira en unidades", () => {
    const s = buildTeleprompterStream([texto("Hola.")], false);
    expect(s.steps).toHaveLength(5);
    expect(s.steps.every((p) => p.units >= 1)).toBe(true);
    expect(s.steps[3].char).toBe("a");
    expect(s.steps[4].char).toBe(".");
    const conCola = buildTeleprompterStream([texto("A. B")], false);
    // A(1) .(1) → B paga 1 + PAUSA_PUNTO
    expect(conCola.steps[2].units).toBe(1 + TELEPROMPTER_PERIOD_PAUSE_LETTERS);
    expect(conCola.steps[2].holdMs).toBeUndefined();
  });

  test("coma: el siguiente carácter paga PAUSA_COMA", () => {
    const s = buildTeleprompterStream([texto("A, B")], false);
    expect(s.steps[2].units).toBe(1 + TELEPROMPTER_COMMA_PAUSE_LETTERS);
  });

  test("títulos: se encienden de golpe y el cuerpo paga el respiro", () => {
    const s = buildTeleprompterStream(
      [
        { kind: "h2", text: "Capítulo" },
        texto("El cuerpo."),
      ],
      false
    );
    const titulo = s.steps.slice(0, 8);
    expect(titulo[0].units).toBe(1 + TELEPROMPTER_HEADING_PAUSE_LETTERS);
    expect(titulo.slice(1).every((p) => p.units === 0)).toBe(true);
    const cuerpo = s.steps[8];
    expect(cuerpo.units).toBe(1 + TELEPROMPTER_HEADING_PAUSE_LETTERS);
  });

  test("las unidades NO dependen de la velocidad (sin parámetro wps a propósito)", () => {
    const a = buildTeleprompterStream([texto("Tres palabras aquí.")], false);
    const b = buildTeleprompterStream([texto("Tres palabras aquí.")], false);
    expect(a.totalUnits).toBe(b.totalUnits);
  });

  test("msPorUnidad: 1000 / (wps · 6)", () => {
    expect(msPorUnidad(2.5)).toBeCloseTo(1000 / (2.5 * TELEPROMPTER_LETTERS_PER_WORD), 10);
    expect(msPorUnidad(4)).toBeCloseTo(41.666666666666664, 8);
  });

  test("rebobinado intacto tras la refactor", () => {
    expect(teleprompterRewind({ page: 3, lit: 2 })).toEqual({ page: 3, lit: 1 });
    expect(teleprompterRewind({ page: 3, lit: 0 })).toEqual({ page: 2, lit: -1 });
    expect(teleprompterRewind({ page: 1, lit: 0 })).toBeNull();
  });
});

describe("tarjetas de imagen (P2)", () => {
  test("una figura = UN paso con espera absoluta (holdMs), sin unidades de tempo", () => {
    const s = buildTeleprompterStream(
      [texto("Antes."), { kind: "p", text: "", image: "data:image/png;base64,xx" }, texto("Después.")],
      false,
      7000
    );
    const img = s.steps[6]; // A n t e s . → 6 pasos de texto + imagen
    expect(img.char).toBe(TELEPROMPTER_IMAGE_CHAR);
    expect(img.units).toBe(0);
    expect(img.holdMs).toBe(7000);
    const siguiente = s.steps[7];
    expect(siguiente.char).toBe("D");
    // el flujo no hereda pausas de la imagen (la espera ya fue absoluta)
    expect(siguiente.units).toBe(1);
    expect(s.blocks.some((b) => b.image === "data:image/png;base64,xx")).toBe(true);
  });

  test("el hold se satura abajo (500 ms mínimo) y el texto pure no produce tarjetas", () => {
    const s = buildTeleprompterStream([{ kind: "p", text: "", image: "data:x" }], true, 100);
    expect(s.steps[0].holdMs).toBe(500);
    const sinImg = buildTeleprompterStream([texto("solo texto")], true);
    expect(sinImg.steps.every((p) => p.holdMs === undefined)).toBe(true);
  });

  test("teleprompterCharCount: la figura cuenta como 1 (página ilustrada ≠ página muda)", () => {
    expect(teleprompterCharCount([{ kind: "p", text: "", image: "data:x" }])).toBe(1);
    expect(teleprompterCharCount([texto("Hola"), { kind: "p", text: "", image: "data:x" }])).toBe(5);
    expect(teleprompterCharCount([{ kind: "p", text: "   " }])).toBe(0);
  });
});

describe("step-timer: espera del paso", () => {
  test("cruce con Auto: la pausa del giro manda en el borde de página", () => {
    const espera = plannedStepDelay({
      lit: 100,
      firstLen: 100,
      hasNext: true,
      auto: true,
      allowCross: false,
      stepDelay: 50,
      turnMs: 2000,
    });
    expect(espera).toBe(2000);
  });

  test("sin Auto (o cruce autorizado): el retardo normal", () => {
    const base = { lit: 100, firstLen: 100, hasNext: true, stepDelay: 50, turnMs: 2000 };
    expect(plannedStepDelay({ ...base, auto: false, allowCross: false })).toBe(50);
    expect(plannedStepDelay({ ...base, auto: true, allowCross: true })).toBe(50);
  });

  test("stepWait: un reinicio del motor no repite la espera completa", () => {
    const now = 5_000;
    const pending = { at: now + 900, lit: 3, win: {} };
    // programado a los 900 ms desde `now`; al reiniciar en now+100 quedan 800
    expect(stepWait(1000, pending, 3, pending.win, now + 100)).toBe(800);
    // otro paso (lit distinto): espera completa
    expect(stepWait(1000, pending, 4, pending.win, now)).toBe(1000);
    // sin pendiente: espera completa
    expect(stepWait(1000, null, 3, null, now)).toBe(1000);
  });
});
