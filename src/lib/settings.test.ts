/**
 * Tests de migración del store de ajustes (change teleprompter-flujo-continuo):
 * `migrateSettings` es la puerta de los estados persistidos viejos y el bloque
 * teleprompter lo rellena `teleprompterMigrado` (defaults de la casa + lo
 * guardado). Así una instalación v14 sin el ajuste nuevo arranca en lectura
 * continua sin perder NADA de lo aprendido. Correr con `bun test src/lib/settings.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { migrateSettings } from "@/lib/settings";
import type { TeleprompterSettings } from "@/lib/types";

describe("migración del store (v15: + flujoContinuo)", () => {
  test("un estado v14 sin flujoContinuo arranca en continuo, sin perder lo aprendido", () => {
    const v14 = {
      teleprompter: { wps: 1.8, auto: true, sound: false, fontScale: 1.2 },
    };
    const out = migrateSettings(v14, 14);
    const tp = out.teleprompter as TeleprompterSettings;
    // el default de la casa: la columna nunca se interrumpe
    expect(tp.flujoContinuo).toBe(true);
    // lo que la lectora ya había afinado se conserva intacto
    expect(tp.wps).toBe(1.8);
    expect(tp.auto).toBe(true);
    expect(tp.sound).toBe(false);
    expect(tp.fontScale).toBe(1.2);
  });

  test("la elección guardada manda: flujoContinuo false sobrevive a la migración", () => {
    const estado = {
      teleprompter: { wps: 2.5, flujoContinuo: false },
    };
    const out = migrateSettings(estado, 15);
    const tp = out.teleprompter as TeleprompterSettings;
    expect(tp.flujoContinuo).toBe(false);
    expect(tp.wps).toBe(2.5);
  });

  test("un estado sin bloque teleprompter cae en defaults de la casa", () => {
    const out = migrateSettings({}, 15);
    const tp = out.teleprompter as TeleprompterSettings;
    expect(tp.flujoContinuo).toBe(true);
    expect(tp.auto).toBe(false);
    expect(tp.instante).toBe(false);
  });
});
