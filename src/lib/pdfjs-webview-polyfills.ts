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
  try?: <T, A extends unknown[]>(fn: (...args: A) => T | Promise<T>, ...args: A) => Promise<T>;
};

const promiseCtor = Promise as PromiseConTry;

if (typeof promiseCtor.try !== "function") {
  // pdf.js pasa argumentos: `Promise.try(handler, data)`. Sin el rest, el
  // handler recibe undefined y explota al desestructurar `docId`.
  Object.defineProperty(promiseCtor, "try", {
    value: function <T, A extends unknown[]>(fn: (...args: A) => T | Promise<T>, ...args: A): Promise<T> {
      try {
        return Promise.resolve(fn(...args));
      } catch (e) {
        return Promise.reject(e);
      }
    },
    writable: true,
    configurable: true,
  });
}

type ByteArray = Uint8Array & {
  toBase64?: () => string;
  toHex?: () => string;
};

const bytesProto = Uint8Array.prototype as ByteArray;

if (typeof bytesProto.toBase64 !== "function") {
  Object.defineProperty(bytesProto, "toBase64", {
    value: function (this: Uint8Array) {
      let bin = "";
      for (const b of this) bin += String.fromCharCode(b);
      return btoa(bin);
    },
    writable: true,
    configurable: true,
  });
}

if (typeof bytesProto.toHex !== "function") {
  Object.defineProperty(bytesProto, "toHex", {
    value: function (this: Uint8Array) {
      let hex = "";
      for (const b of this) hex += b.toString(16).padStart(2, "0");
      return hex;
    },
    writable: true,
    configurable: true,
  });
}

export {};
