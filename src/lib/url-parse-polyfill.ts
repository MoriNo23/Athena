/**
 * Polyfill mínimo para URL.parse (método estático).
 *
 * pdf.js v6 lo usa al resolver URLs y los WebView de Android algo más viejos
 * —reproducido con Chrome 124 en Android 15— no lo traen y explotan con:
 *   «TypeError: URL.parse is not a function»
 *
 * Debe importarse ANTES que cualquier módulo de pdfjs-dist (las sentencias
 * import se evalúan en orden, así que importarlo en pdf-client.ts basta).
 */

type UrlConParse = typeof URL & {
  parse?: (url: string, base?: string | URL) => URL | null;
};

const ctor = URL as UrlConParse;

if (typeof ctor.parse !== "function") {
  // shortcut: devuelve null donde la URL nativa lanzaría; suficiente para
  // pdf.js. Quitar cuando el WebView mínimo soportado ya traiga URL.parse.
  Object.defineProperty(ctor, "parse", {
    value: function (url: string, base?: string | URL) {
      try {
        return new URL(url, base);
      } catch {
        return null;
      }
    },
    writable: true,
    configurable: true,
  });
}

export {};
