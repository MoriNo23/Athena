/**
 * Pantalla completa: solo donde esconde algo.
 *
 * En el APK el WebView ya ocupa toda la pantalla. El botón de pantalla
 * completa no escondía nada — y al pedir el API se entraba en pantalla
 * completa del DOCUMENTO, que en Android realza status/navigation bars y deja
 * huecos del recorte de cámara que la web no puede pintar. El contrato es:
 * donde no aporta, ni botón ni atajo (un botón que no hace nada es peor que
 * no tenerlo).
 */
import "./setup/dom";
import { afterEach, describe, expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import { esApk, esFullscreenUtil, punteroGrueso } from "@/lib/plataforma";
import { useFullscreen } from "@/hooks/use-fullscreen";

type Win = { __ATHENA_APK__?: boolean };

function conEntorno(opts: { apk?: boolean; tactil?: boolean; api?: boolean }) {
  const w = window as unknown as Win & { matchMedia: (q: string) => { matches: boolean } };
  if (opts.apk) w.__ATHENA_APK__ = true;
  // happy-dom no evalúa media queries: se sustituye matchMedia por el caso.
  w.matchMedia = () => ({ matches: opts.tactil === true }) as MediaQueryList;
  // happy-dom no implementa la Fullscreen API: se finge la superficie que el
  // hook consulta (`requestFullscreen` en el elemento raíz).
  const raiz = document.documentElement as unknown as { requestFullscreen?: unknown };
  raiz.requestFullscreen = opts.api === false ? undefined : () => Promise.resolve();
}

afterEach(() => {
  delete (window as unknown as Win).__ATHENA_APK__;
});

describe("plataforma · ¿dónde tiene sentido la pantalla completa?", () => {
  test("en el APK no aporta: el WebView ya ocupa la pantalla", () => {
    conEntorno({ apk: true, tactil: true, api: true });
    expect(esApk()).toBe(true);
    expect(esFullscreenUtil()).toBe(false);
  });

  test("en escritorio con ratón y API sí aporta", () => {
    conEntorno({ tactil: false, api: true });
    expect(esApk()).toBe(false);
    expect(punteroGrueso()).toBe(false);
    expect(esFullscreenUtil()).toBe(true);
  });

  test("sin requestFullscreen no hay botón (sería decorativo)", () => {
    conEntorno({ tactil: false, api: false });
    expect(esFullscreenUtil()).toBe(false);
  });

  test("un móvil en el navegador tampoco lo necesita: la pestaña ya es la pantalla", () => {
    conEntorno({ tactil: true, api: true });
    expect(esFullscreenUtil()).toBe(false);
  });
});

describe("useFullscreen · el estado no miente cuando no está disponible", () => {
  test("en el APK: disponible=false y el toggle no pide el API", () => {
    conEntorno({ apk: true, tactil: true, api: true });
    const { result } = renderHook(() => useFullscreen());
    expect(result.current.disponible).toBe(false);
    // Si el toggle llamara a requestFullscreen, el WebView entraría en
    // pantalla completa del documento: el bug que estamos cerrando.
    expect(result.current.isFullscreen).toBe(false);
  });

  test("en escritorio: disponible=true", () => {
    conEntorno({ tactil: false, api: true });
    const { result } = renderHook(() => useFullscreen());
    expect(result.current.disponible).toBe(true);
  });
});
