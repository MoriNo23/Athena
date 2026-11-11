/**
 * Tests del bbox de figuras pintadas bajo una CTM (teleprompter-images).
 * El atajo anterior (h = |b| si b ≠ 0) degeneraba la caja de las imágenes
 * ROTADAS: los collages de la pág. 42 del «70 años de humor» (inclinados
 * ~1°) daban cajas de 8 pt de alto y se descartaban; una portada a 90° daba
 * w = 0. Puro, sin pdf.js. Correr con `bun test src/lib/teleprompter-images.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { cajaImagenDeCtm } from "@/lib/teleprompter-images";

const H = 652;

describe("cajaImagenDeCtm", () => {
  test("imagen alineada a ejes (lámina de la pág. 41): igual que siempre", () => {
    // CTM real de la lámina grande de la pág. 41
    const caja = cajaImagenDeCtm([387.4, 0, 0, 547.5, 30.7, 32.3], H);
    expect(caja.x).toBeCloseTo(30.7, 1);
    expect(caja.y).toBeCloseTo(652 - (32.3 + 547.5), 1);
    expect(caja.w).toBeCloseTo(387.4, 1);
    expect(caja.h).toBeCloseTo(547.5, 1);
  });

  test("collage inclinado ~1° (pág. 42 real): bbox completo, no 8 pt de alto", () => {
    // CTM real del collage izquierdo de la pág. 42: [465.0, -8.1, 10.5, 603.2, 39.7, 8.4]
    const caja = cajaImagenDeCtm([465.0, -8.1, 10.5, 603.2, 39.7, 8.4], H);
    expect(caja.w).toBeCloseTo(465.0 + 10.5, 1);
    expect(caja.h).toBeCloseTo(8.1 + 603.2, 1); // antes: |b| = 8.1 → descartada
    expect(caja.x).toBeCloseTo(39.7, 1);
    expect(caja.y).toBeCloseTo(652 - (0.3 + 611.3), 1);
  });

  test("portada rotada 90°: bbox completo, no ancho cero", () => {
    // cuadrado unitario → [0, 200, -150, 0, 400, 50]: rota y escalada
    const caja = cajaImagenDeCtm([0, 200, -150, 0, 400, 50], H);
    expect(caja.w).toBeCloseTo(150, 1); // antes: |a| = 0
    expect(caja.h).toBeCloseTo(200, 1); // antes: |b| = 200 (a medias)
    expect(caja.x).toBeCloseTo(250, 1);
    expect(caja.y).toBeCloseTo(652 - 250, 1);
  });

  test("reflejo (escala negativa): la caja sigue siendo el bbox de esquinas", () => {
    const caja = cajaImagenDeCtm([-300, 0, 0, 400, 500, 100], H);
    expect(caja.w).toBeCloseTo(300, 1);
    expect(caja.h).toBeCloseTo(400, 1);
    expect(caja.x).toBeCloseTo(200, 1); // 500 + min(0, -300) = 200
    expect(caja.y).toBeCloseTo(652 - 500, 1);
  });
});
