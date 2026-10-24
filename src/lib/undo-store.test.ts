/**
 * Tests del candado de ids en la papelera (change papelera-blindada): un id
 * que no sea una fila (cuid/uuid) no arma rutas ni lee fuera de db/undo.
 * Correr con `bun test src/lib/undo-store.test.ts`.
 */
import { expect, test } from "bun:test";
import { esIdSeguro, readSnapshot } from "@/lib/undo-store";

test("esIdSeguro: cuides/uuid pasan, traversal no", () => {
  expect(esIdSeguro("cm3l0abc123def456ghi789")).toBe(true);
  expect(esIdSeguro("abc_-DEF123")).toBe(true);
  expect(esIdSeguro("../escape")).toBe(false);
  expect(esIdSeguro("../../../etc")).toBe(false);
  expect(esIdSeguro("")).toBe(false);
  expect(esIdSeguro("a/b")).toBe(false);
  expect(esIdSeguro(".oculto")).toBe(false);
});

test("readSnapshot con id travesío: null, sin leer nada fuera de db/undo", async () => {
  const snap = await readSnapshot("../dialect");
  expect(snap).toBeNull();
});
