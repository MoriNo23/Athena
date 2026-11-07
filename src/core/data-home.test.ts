/**
 * Pruebas del resolver de ATHENA_HOME (change athena-home-cli).
 * resuelveCasa es puro: no toca env ni disco, así que los casos se describen
 * con entradas literales. Correr con `bun test src/lib/data-home.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { resuelveCasa } from "@/core/data-home";

const legacy = { hayLegacy: true, esDocker: false, esTest: false };
const limpio = { hayLegacy: false, esDocker: false, esTest: false };

describe("resuelveCasa (ATHENA_HOME)", () => {
  test("ATHENA_HOME explícita gana a todo (y absolutiza)", () => {
    expect(resuelveCasa({ ...legacy, athenaHome: "/datos/athena" })).toBe("/datos/athena");
    expect(resuelveCasa({ ...limpio, athenaHome: "relativa/casa", home: "/h" })).toMatch(
      /relativa\/casa$/,
    );
  });

  test("ATHENA_HOME vacía o de espacios no cuenta como explícita", () => {
    expect(resuelveCasa({ ...legacy, athenaHome: "   " })).toBeNull();
    expect(resuelveCasa({ ...limpio, athenaHome: "" })).not.toBeNull();
  });

  test("en tests: siempre legacy relativo (sandbox con chdir)", () => {
    expect(resuelveCasa({ hayLegacy: false, esDocker: false, esTest: true })).toBeNull();
    expect(resuelveCasa({ hayLegacy: true, esDocker: false, esTest: true })).toBeNull();
  });

  test("instalación legacy en el repo no se mueve sola", () => {
    expect(resuelveCasa(legacy)).toBeNull();
  });

  test("en Docker se respeta el DATABASE_URL/volúmenes del compose", () => {
    expect(resuelveCasa({ hayLegacy: false, esDocker: true, esTest: false })).toBeNull();
  });

  test("default XDG: $XDG_DATA_HOME/athena, o ~/.local/share/athena", () => {
    expect(resuelveCasa({ ...limpio, xdgDataHome: "/xdg", home: "/h" })).toBe("/xdg/athena");
    expect(resuelveCasa({ ...limpio, home: "/h" })).toBe("/h/.local/share/athena");
    expect(resuelveCasa({ ...limpio })).toMatch(/\.local\/share\/athena$/);
  });
});
