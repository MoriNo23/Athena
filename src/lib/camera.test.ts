import { describe, expect, test } from "bun:test";
import { createCameraController, CAMERA_TAU_MS } from "./camera";

/**
 * Banco de pruebas de la cámara (change teleprompter-camara-estable).
 * El controlador toma schedule/now inyectables: aquí se bombea el bucle a
 * mano, sin rAF ni DOM, para auditar la trayectoria exacta cuadro a cuadro.
 */

class FakeScroll {
  scrollTop = 0;
  connected = true;
}

function rig() {
  const el = new FakeScroll();
  const pending = new Map<number, (now: number) => void>();
  let nextId = 1;
  let now = 1_000;
  const cam = createCameraController({
    el: () => el,
    now: () => now,
    schedule: (cb) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancel: (id) => {
      pending.delete(id);
    },
    attached: (e) => e.connected,
  });
  /** avanza `frames` cuadros de 16 ms (60 Hz) */
  const pump = (frames = 1, dtMs = 16) => {
    for (let f = 0; f < frames; f++) {
      now += dtMs;
      const vivos = [...pending.entries()];
      pending.clear();
      for (const [, cb] of vivos) cb(now);
    }
  };
  const vivosRestantes = () => pending.size;
  return { el, cam, pump, vivosRestantes };
}

describe("camera: modo automático sin brincos", () => {
  test("avanza hacia el objetivo de forma monótona y asienta exacto", () => {
    const { el, cam, pump } = rig();
    el.scrollTop = 500;
    cam.order(560);
    expect(cam.isActive()).toBe(true);
    let previo = el.scrollTop;
    let maximo = previo;
    for (let i = 0; i < 120 && cam.isActive(); i++) {
      pump();
      const d0 = 560 - previo;
      const d1 = 560 - el.scrollTop;
      // monótono: la distancia al objetivo NUNCA crece (sin rebotes)
      expect(Math.abs(d1)).toBeLessThanOrEqual(Math.abs(d0) + 1e-6);
      maximo = Math.max(maximo, el.scrollTop);
      previo = el.scrollTop;
    }
    expect(el.scrollTop).toBe(560); // asentado exacto, no ≈
    expect(maximo).toBeLessThanOrEqual(560); // nunca sobrepasa el destino
    expect(cam.isActive()).toBe(false);
  });

  test("retarget a mitad de vuelo: continuidad de velocidad (el fix del rebote)", () => {
    const { el, cam, pump } = rig();
    el.scrollTop = 0;
    cam.order(300);
    pump(3); // volando hacia 300…
    // la cámara vieja REINICIABA una curva ease-out por orden: cada reinicio
    // partía con velocidad máxima (brincos). La nueva solo cambia el destino.
    const pasoVivo = () => {
      const antes = el.scrollTop;
      pump();
      return Math.abs(el.scrollTop - antes);
    };
    const pasosAntes: number[] = [];
    for (let i = 0; i < 5; i++) pasosAntes.push(pasoVivo());
    cam.order(900); // retarget en pleno vuelo
    const pasosDespues: number[] = [];
    for (let i = 0; i < 5; i++) pasosDespues.push(pasoVivo());
    // el primer cuadro tras el retarget NO puede ser un salto brutal: la
    // velocidad por cuadro queda del mismo orden que los pasos previos
    const maxPrevio = Math.max(...pasosAntes);
    expect(pasosDespues[0]).toBeLessThan(maxPrevio * 4);
    // y sigue avanzando hacia el destino nuevo sin retroceder
    expect(el.scrollTop).toBeGreaterThan(0);
  });

  test("la cesión manda: un scroll externo duerme la cámara y no pelea", () => {
    const { el, cam, pump } = rig();
    cam.order(400);
    pump(2);
    expect(cam.isActive()).toBe(true);
    el.scrollTop += 80; // la rueda del lector
    pump();
    expect(cam.isActive()).toBe(false); // cedió
    const trasCeder = el.scrollTop;
    pump(10);
    expect(el.scrollTop).toBe(trasCeder); // ya no escribe
  });

  test("instant: escribe exacto sin bucle (rebobinado)", () => {
    const { el, cam } = rig();
    cam.order(777, { instant: true });
    expect(el.scrollTop).toBe(777);
    expect(cam.isActive()).toBe(false);
  });

  test("desmontaje: el bucle muere si el host se desconecta", () => {
    const { el, cam, pump, vivosRestantes } = rig();
    cam.order(400);
    el.connected = false;
    pump();
    expect(cam.isActive()).toBe(false);
    expect(vivosRestantes()).toBe(0);
  });

  test("cancel: detiene el vuelo y ordena limpio después", () => {
    const { el, cam, pump } = rig();
    el.scrollTop = 100;
    cam.order(400);
    pump(2);
    cam.cancel();
    expect(cam.isActive()).toBe(false);
    el.scrollTop = 200; // el lector movió mientras dormida
    cam.order(500); // arranca desde DONDE ESTÁ, no desde una posición vieja
    pump();
    expect(el.scrollTop).toBeGreaterThanOrEqual(200);
  });

  test("τ constante razonable: ~68 % del tramo en un τ", () => {
    // el suavizado exponencial con dt = tau avanza 1 - 1/e ≈ 63.2 % del resto
    const { el, cam, pump } = rig();
    el.scrollTop = 0;
    cam.order(100);
    pump(Math.round(CAMERA_TAU_MS / 16));
    const avanzado = el.scrollTop / 100;
    expect(avanzado).toBeGreaterThan(0.4);
    expect(avanzado).toBeLessThan(0.85);
  });
});
