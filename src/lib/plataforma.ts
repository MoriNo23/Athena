/**
 * ¿Estamos dentro del APK? El build del APK inyecta `__ATHENA_APK__` (ver
 * `scripts/build-apk-web.mjs`); en la web y en el servidor la marca no existe.
 *
 * Se lee en el momento de la llamada, no al importar el módulo: así los tests
 * pueden encenderla y apagarla sin recargar el grafo de módulos.
 */
export function esApk(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { __ATHENA_APK__?: boolean }).__ATHENA_APK__ === true
  );
}

/** ¿El dispositivo tiene dedo en vez de ratón? En el WebView de Android, sí. */
export function punteroGrueso(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * ¿La pantalla completa del navegador aporta algo aquí?
 *
 * En escritorio sí: `requestFullscreen()` esconde las barras del navegador y
 * el sistema (y deja el F11 del navegador como salida). En el APK no aporta
 * NADA: el WebView ya ocupa la pantalla entera, no hay barras de navegador que
 * esconder, y que el sistema oculte status/navigation bars con la app ya a
 * pantalla completa es justo lo que deja los huecos del recorte de cámara sin
 * pintar. Por eso el botón de pantalla completa solo existe donde significa
 * algo (`esFullscreenUtil`).
 */
export function esFullscreenUtil(): boolean {
  if (esApk()) return false;
  if (typeof document === "undefined") return false;
  // Sin API no hay pantalla completa posible: el botón sería decorativo.
  if (typeof document.documentElement?.requestFullscreen !== "function") return false;
  return !punteroGrueso();
}
