/**
 * Polyfill mínimo para Map.getOrInsert / Map.getOrInsertComputed.
 *
 * pdf.js v6 usa estas funciones (propuesta reciente de TC39) y los Chromium
 * algo más viejos —incluido el que trae Playwright— explotan en
 * WorkerTransport.getOptionalContentConfig con:
 *   «TypeError: this[#methodPromises].getOrInsertComputed is not a function»
 *
 * Debe importarse ANTES que cualquier módulo de pdfjs-dist (las sentencias
 * import se evalúan en orden, así que `import "./map-get-or-insert-polyfill"`
 * en la primera línea de pdf-client.ts basta).
 */

const proto = Map.prototype as Map<unknown, unknown> & {
  getOrInsert?: (key: unknown, value: unknown) => unknown;
  getOrInsertComputed?: (key: unknown, fn: (key: unknown) => unknown) => unknown;
};

if (typeof proto.getOrInsert !== "function") {
  Object.defineProperty(proto, "getOrInsert", {
    value: function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
      if (!this.has(key)) this.set(key, value);
      return this.get(key);
    },
    writable: true,
    configurable: true,
  });
}

if (typeof proto.getOrInsertComputed !== "function") {
  Object.defineProperty(proto, "getOrInsertComputed", {
    value: function (this: Map<unknown, unknown>, key: unknown, fn: (key: unknown) => unknown) {
      if (!this.has(key)) this.set(key, fn(key));
      return this.get(key);
    },
    writable: true,
    configurable: true,
  });
}

export {};
