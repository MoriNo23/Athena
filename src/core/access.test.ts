/**
 * Pruebas del candado (change candado-completo-y-athena):
 * reglas de contraseña efectiva, identidad renombrada con fallback legado,
 * y helpers puros que consumen middleware y /login.
 * Correr con `bun test src/lib/access.test.ts`.
 * Los tests de fichero usan un sandbox en tests/.sandbox (jamás el db/ real).
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import {
  COOKIE_SESION,
  archivoContraseña,
  contraseñaEfectiva,
  esRecursoEstático,
  igualEnTiempoConstante,
  siguienteSeguro,
} from "@/core/access";

const SANDBOX = "tests/.sandbox";

/** guarda/limpia process.env alrededor de cada test */
let copiaEnv: NodeJS.ProcessEnv;
const cwdOriginal = process.cwd();
initEnv();
beforeEach(() => {
  initEnv();
});
afterEach(() => {
  process.chdir(cwdOriginal);
  rmSync(SANDBOX, { recursive: true, force: true });
  Object.assign(process.env, copiaEnv);
  for (const k of Object.keys(process.env)) {
    if (!(k in copiaEnv)) delete process.env[k];
  }
});

function initEnv() {
  copiaEnv = { ...process.env };
  for (const k of [
    "ATHENA_PASSWORD",
    "ATHENA_MODO",
    "ATHENA_ABIERTO",
    "ATENA_PASSWORD",
    "ATENA_MODO",
    "ATENA_ABIERTO",
  ]) {
    delete process.env[k];
  }
}

function sandbox() {
  rmSync(SANDBOX, { recursive: true, force: true });
  mkdirSync(`${SANDBOX}/db`, { recursive: true });
  process.chdir(SANDBOX);
}

test("identidad renombrada: cookie y fichero nuevos", () => {
  expect(COOKIE_SESION).toBe("athena_session");
  // legacy: ruta relativa que se re-resuelve contra el cwd (sandbox con chdir);
  // con ATHENA_HOME se vuelve <casa>/db/athena-lock (ver data-home.ts)
  expect(archivoContraseña()).toBe("db/athena-lock");
});

test("ATHENA_PASSWORD manda", () => {
  process.env.ATHENA_PASSWORD = "faro";
  process.env.ATENA_MODO = "lan";
  expect(contraseñaEfectiva()).toBe("faro");
});

test("fallback legado: ATENA_PASSWORD cuenta si ATHENA no está", () => {
  process.env.ATENA_PASSWORD = "cañón";
  expect(contraseñaEfectiva()).toBe("cañón");
});

test("la contraseña explícita gana aunque haya ABIERTO=1", () => {
  process.env.ATHENA_PASSWORD = "faro";
  process.env.ATHENA_ABIERTO = "1";
  process.env.ATHENA_MODO = "lan";
  expect(contraseñaEfectiva()).toBe("faro");
});

test("modo lan abierta a elección: ATHENA_ABIERTO=1 → sin candado", () => {
  process.env.ATHENA_MODO = "lan";
  process.env.ATHENA_ABIERTO = "1";
  expect(contraseñaEfectiva()).toBe("");
});

test("ABIERTO y MODO por nombres legados también cuentan", () => {
  process.env.ATENA_MODO = "lan";
  process.env.ATENA_ABIERTO = "1";
  expect(contraseñaEfectiva()).toBe("");
});

test("modo normal sin contraseña → abierto y sin fichero", () => {
  sandbox();
  expect(contraseñaEfectiva()).toBe("");
  expect(existsSync("db/athena-lock")).toBe(false);
});

test("modo lan sin elección → autogenerada persistida en athena-lock", () => {
  sandbox();
  process.env.ATHENA_MODO = "lan";
  const pw = contraseñaEfectiva();
  expect(pw.length).toBeGreaterThan(0);
  expect(readFileSync("db/athena-lock", "utf8").trim()).toBe(pw);
});

test("instalación vieja: db/atena-lock legado se respeta y se transcribe", () => {
  sandbox();
  writeFileSync("db/atena-lock", "vieja123");
  process.env.ATHENA_MODO = "lan";
  expect(contraseñaEfectiva()).toBe("vieja123");
  expect(readFileSync("db/athena-lock", "utf8").trim()).toBe("vieja123");
});

test("siguienteSeguro: solo rutas relativas internas", () => {
  expect(siguienteSeguro("/libro/1?x=2")).toBe("/libro/1?x=2");
  expect(siguienteSeguro("/")).toBe("/");
  expect(siguienteSeguro("/login")).toBe("/login");
  expect(siguienteSeguro("//evil.com")).toBeNull();
  expect(siguienteSeguro("https://evil.com")).toBeNull();
  // barra invertida: new URL("", base) la normaliza a "/" y navega fuera
  expect(siguienteSeguro("/\\evil.com")).toBeNull();
  expect(siguienteSeguro("/\\\\evil.com")).toBeNull();
  // caracteres de control: nada de URL que no sea visible tecleada
  expect(siguienteSeguro("/libro\x00a")).toBeNull();
  expect(siguienteSeguro("nota-relativa")).toBeNull();
  expect(siguienteSeguro("")).toBeNull();
  expect(siguienteSeguro(null)).toBeNull();
});

test("esRecursoEstático: ficheros con extensión, rutas de página no", () => {
  expect(esRecursoEstático("/login")).toBe(false);
  expect(esRecursoEstático("/libro/3")).toBe(false);
  expect(esRecursoEstático("/api/books")).toBe(false);
  expect(esRecursoEstático("/favicon.ico")).toBe(true);
  expect(esRecursoEstático("/_next/static/chunk.js")).toBe(true);
  expect(esRecursoEstático("/pdfjs/pdf.worker.min.mjs")).toBe(true);
  // los ficheros propios de la biblioteca NO son público estático: bajo candado
  // viajan por /api/books/[id]/file y /cover; sin sesión no deben servirse
  expect(esRecursoEstático("/uploads/portada.png")).toBe(false);
  expect(esRecursoEstático("/uploads/libro.epub")).toBe(false);
});

test("contraseña de solo espacios = sin contraseña definida", () => {
  process.env.ATHENA_PASSWORD = "   ";
  expect(contraseñaEfectiva()).toBe(""); // modo normal: casa abierta
  sandbox();
  process.env.ATHENA_MODO = "lan";
  const pw = contraseñaEfectiva(); // lan: autogenerada y persistida
  expect(pw.length).toBeGreaterThan(0);
  expect(readFileSync("db/athena-lock", "utf8").trim()).toBe(pw);
});

test("igualEnTiempoConstante no cambió su contrato", () => {
  expect(igualEnTiempoConstante("a", "a")).toBe(true);
  expect(igualEnTiempoConstante("a", "b")).toBe(false);
});
