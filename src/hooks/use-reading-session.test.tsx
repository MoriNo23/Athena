import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useReadingSession } from "@/hooks/use-reading-session";

/**
 * Conteo honesto (change honest-reading-teleprompter): girar mueve la
 * posición, marcar cuenta. Antes `turn()` sumaba el delta de `currentPage`,
 * así que hojear inflaba la racha y la primera página nunca contaba.
 */

type Escritura = { url: string; body: { currentPage?: number; pagesRead: number; minutes: number } };
const escrituras: Escritura[] = [];
const fetchReal = globalThis.fetch;

beforeEach(() => {
  escrituras.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/books") {
      return { ok: true, json: async () => ({ books: [] }) } as Response;
    }
    if (init?.method === "PATCH") {
      escrituras.push({ url, body: JSON.parse(String(init.body)) });
    }
    return { ok: true, json: async () => ({ ok: true }) } as Response;
  }) as typeof fetch;
  jest.useFakeTimers();
});

afterEach(() => {
  globalThis.fetch = fetchReal;
  jest.useRealTimers();
  cleanup();
});

function montar(currentPage = 7, dwellEnabled = false) {
  return renderHook(() =>
    useReadingSession({
      bookId: "b1",
      initialPage: 7,
      currentPage,
      dwellEnabled,
      pauseEnabled: false,
      pauseMinutes: 10,
    })
  );
}

async function arrancar() {
  await act(async () => {
    await Promise.resolve();
  });
}

test("girar guarda currentPage sin subir pagesRead", async () => {
  const { result } = montar();
  await arrancar();
  await act(async () => {
    result.current.turn(8, 7, false, () => "", true);
    await result.current.flushSave(8);
  });
  const patch = escrituras.find((e) => e.url.includes("/api/books/b1"));
  expect(patch?.body.currentPage).toBe(8);
  expect(patch?.body.pagesRead).toBe(0);
});

test("el dwell cuenta la página tras el tiempo mínimo con la pestaña visible", async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  const { result } = montar(7, true);
  await arrancar();
  await act(async () => {
    jest.advanceTimersByTime(20_000);
    await Promise.resolve();
  });
  expect(result.current.bookPagesToday).toBe(1);
  expect(escrituras.some((e) => e.body.pagesRead === 1)).toBe(true);
});

test("markPageRead suma una vez por página, aunque se repita", async () => {
  const { result } = montar();
  await arrancar();
  await act(async () => {
    result.current.markPageRead(7);
    await result.current.flushSave();
    result.current.markPageRead(7);
    await result.current.flushSave();
  });
  expect(escrituras.filter((e) => e.body.pagesRead > 0)).toHaveLength(1);
  expect(escrituras[0]?.body.pagesRead).toBe(1);
  expect(result.current.bookPagesToday).toBe(1);
});
