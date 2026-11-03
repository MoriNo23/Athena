/**
 * Tests de migración del store de ajustes (change teleprompter-solo-continuo):
 * `migrateSettings` es la puerta de los estados persistidos viejos y el bloque
 * teleprompter lo rellena `teleprompterMigrado` (defaults de la casa + lo
 * guardado, sin los ajustes jubilados). Así una instalación v15 con
 * `flujoContinuo: false` migra al único camino (el continuo) sin perder NADA
 * de lo aprendido. Correr con `bun test src/lib/settings.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { migrateSettings } from "@/lib/settings";
import type { TeleprompterSettings } from "@/lib/types";

describe("migración del store (v16: − flujoContinuo, + descansoMin)", () => {
  test("un estado v15 con flujoContinuo false lo pierde sin perder lo aprendido", () => {
    const v15 = {
      teleprompter: { wps: 1.8, auto: true, sound: false, fontScale: 1.2, flujoContinuo: false },
    };
    const out = migrateSettings(v15, 15);
    const tp = out.teleprompter as TeleprompterSettings & { flujoContinuo?: unknown };
    // el ajuste jubilado no vuelve a persistirse: el continuo es EL camino
    expect("flujoContinuo" in tp).toBe(false);
    // lo que la lectora ya había afinado se conserva intacto
    expect(tp.wps).toBe(1.8);
    expect(tp.auto).toBe(true);
    expect(tp.sound).toBe(false);
    expect(tp.fontScale).toBe(1.2);
    // el descanso entra con el default de la casa (apagado: la dueña decide)
    expect(tp.descansoMin).toBe(0);
  });

  test("descansoMin guardado sobrevive a la migración", () => {
    const estado = {
      teleprompter: { wps: 2.5, descansoMin: 20 },
    };
    const out = migrateSettings(estado, 16);
    const tp = out.teleprompter as TeleprompterSettings;
    expect(tp.descansoMin).toBe(20);
    expect(tp.wps).toBe(2.5);
  });

  test("un estado sin bloque teleprompter cae en defaults de la casa", () => {
    const out = migrateSettings({}, 15);
    const tp = out.teleprompter as TeleprompterSettings;
    expect(tp.descansoMin).toBe(0);
    expect(tp.auto).toBe(false);
    expect(tp.instante).toBe(false);
  });

  test("un estado v10 con bloque `vn` también migra limpio", () => {
    const v10 = {
      vn: { wps: 3, flujoContinuo: true },
    };
    const out = migrateSettings(v10, 10);
    const tp = out.teleprompter as TeleprompterSettings & { flujoContinuo?: unknown };
    expect("flujoContinuo" in tp).toBe(false);
    expect(tp.wps).toBe(3);
    expect(tp.descansoMin).toBe(0);
  });
});
