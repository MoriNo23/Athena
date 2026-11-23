/**
 * Polyfills mínimos para las APIs modernas que usa pdf.js v6 y que algunos
 * WebView de Android no traen. Reproducido con Chrome 124 en Android 15:
 *   «TypeError: URL.parse is not a function»
 *   «Uncaught TypeError: Promise.try is not a function»
 *
 * Debe importarse ANTES que cualquier módulo de pdfjs-dist (las sentencias
 * import se evalúan en orden, así que importarlo en pdf-client.ts basta).
 * `Promise.withResolvers`, `findLast` y `Map.getOrInsert` ya estaban cubiertos
 * (el último, en su propio polyfill).
 */

type UrlConParse = typeof URL & {
  parse?: (url: string, base?: string | URL) => URL | null;
};

const urlCtor = URL as UrlConParse;

if (typeof urlCtor.parse !== "function") {
  // shortcut: devuelve null donde la URL nativa lanzaría; suficiente para
  // pdf.js. Quitar cuando el WebView mínimo soportado ya traiga URL.parse.
  Object.defineProperty(urlCtor, "parse", {
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

type PromiseConTry = PromiseConstructor & {
  try?: <T>(fn: () => T | Promise<T>) => Promise<T>;
};

const promiseCtor = Promise as PromiseConTry;

if (typeof promiseCtor.try !== "function") {
  // shortcut: solo necesita el caso sin argumentos que usa pdf.js. Quitar
  // cuando el WebView mínimo soportado ya traiga Promise.try.
  Object.defineProperty(promiseCtor, "try", {
    value: function <T>(fn: () => T | Promise<T>): Promise<T> {
      try {
        return Promise.resolve(fn());
      } catch (e) {
        return Promise.reject(e);
      }
    },
    writable: true,
    configurable: true,
  });
}

export {};
