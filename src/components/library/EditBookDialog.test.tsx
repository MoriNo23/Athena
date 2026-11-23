import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditBookDialog } from "@/components/library/EditBookDialog";

/**
 * La sinopsis editada a mano manda: la búsqueda automática no puede pisarla
 * y un fallo al guardar no puede hacer creer a la tarjeta que se guardó.
 */

const fetchReal = globalThis.fetch;
let patches: { url: string; body: Record<string, unknown> }[] = [];
let extrasOk = true;

beforeEach(() => {
  patches = [];
  extrasOk = true;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method !== "PATCH") {
      return { ok: true, json: async () => ({}) } as Response;
    }
    patches.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> });
    const ok = url.endsWith("/meta") || extrasOk;
    return {
      ok,
      json: async () =>
        ok
          ? { book: { title: "Prueba", author: "QA", dailyGoal: null } }
          : { error: "Sin conexión" },
    } as Response;
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = fetchReal;
  cleanup();
});

async function vaciarMicrotareas() {
  await act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
}

function montar(onSaved: (b: { extras?: unknown }) => void) {
  const book = {
    id: "libro-1",
    title: "Prueba",
    author: "QA",
    coverPath: null,
    dailyGoal: null,
    extras: { synopsis: { text: "Texto viejo", source: "manual" as const } },
  };
  render(
    <EditBookDialog book={book} defaultGoal={20} open onOpenChange={() => {}} onSaved={onSaved} />
  );
  return book;
}

test("una sinopsis editada a mano se guarda con source manual", async () => {
  montar(() => {});
  fireEvent.change(screen.getByTestId("edit-synopsis"), { target: { value: "Texto nuevo" } });
  fireEvent.click(screen.getByTestId("edit-save"));

  await vaciarMicrotareas();
  const extras = patches.find((p) => !p.url.endsWith("/meta"))?.body.extras as {
    synopsis: { text: string; source: string };
  };
  expect(extras.synopsis).toEqual({ text: "Texto nuevo", source: "manual" });
});

test("si falla el PATCH de extras, la tarjeta no recibe la sinopsis nueva", async () => {
  extrasOk = false;
  let guardado: { extras?: unknown } | null = null;
  montar((b) => {
    guardado = b;
  });
  fireEvent.change(screen.getByTestId("edit-synopsis"), { target: { value: "Texto nuevo" } });
  fireEvent.click(screen.getByTestId("edit-save"));

  await vaciarMicrotareas();
  expect((guardado as { extras?: unknown } | null)?.extras).toBeUndefined();
});
