/**
 * Entorno DOM para los tests de componentes de UI bajo `bun test`.
 *
 * La casa corre su suite con Bun; happy-dom ya vive en devDependencies y
 * aquí se registra a mano (sin paquetes extra de registro). Se copian al
 * global SOLO los nombres que Bun no trae de fábrica, para no degradar los
 * integradores nativos (fetch, URL, MessageChannel) que React también usa.
 *
 * Cada test de componentes importa este módulo ANTES que cualquier cosa
 * que toque el DOM (React incluido).
 */
import { Window } from "happy-dom";

const win = new Window({ url: "https://athena.test/" });

const g = globalThis as unknown as Record<string, unknown>;

// Núcleo del DOM que React y Testing Library exigen como globales
g.window = win;
g.self = win;
g.document = win.document;
g.navigator = win.navigator;
g.location = win.location;
g.history = win.history;
g.localStorage = win.localStorage;
g.sessionStorage = win.sessionStorage;
g.getComputedStyle = (win as unknown as { getComputedStyle: typeof getComputedStyle }).getComputedStyle.bind(win);
g.requestAnimationFrame = (win as unknown as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame.bind(win);
g.cancelAnimationFrame = (win as unknown as { cancelAnimationFrame: typeof cancelAnimationFrame }).cancelAnimationFrame.bind(win);
if (typeof win.matchMedia === "function") {
  g.matchMedia = win.matchMedia.bind(win);
}

// Constructores y clases del DOM: los de happy-dom SIEMPRE (Bun trae los
// suyos nativos, y librerías como Radix hacen `new CustomEvent()` con el
// global antes de despacharlo en nodos de happy-dom: si los reinos no
// coinciden, dispatchEvent los rechaza). El resto solo si Bun no los trae.
const DOM_FORZADO = new Set([
  "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "PointerEvent",
  "TouchEvent", "FocusEvent", "InputEvent", "WheelEvent", "ErrorEvent",
  "ProgressEvent", "AnimationEvent", "TransitionEvent", "CloseEvent",
  "Element", "HTMLElement", "HTMLDivElement", "HTMLSpanElement",
  "HTMLButtonElement", "HTMLInputElement", "HTMLAnchorElement",
  "HTMLImageElement", "HTMLCanvasElement", "HTMLTextAreaElement",
  "HTMLSelectElement", "HTMLFormElement", "HTMLUnknownElement",
  "SVGElement", "SVGGraphicsElement", "SVGSVGElement", "SVGPathElement",
  "SVGTSpanElement", "SVGTextElement", "SVGCircleElement", "SVGRectElement",
  "Node", "Document", "DocumentFragment", "ShadowRoot", "Text", "Comment",
  "NodeList", "HTMLCollection", "DOMTokenList", "NamedNodeMap",
  "Attr", "Range", "Selection", "DOMRect", "DOMRectReadOnly", "DOMPoint",
  "DOMMatrix", "DOMMatrixReadOnly", "CSSStyleDeclaration", "CSSStyleSheet",
  "CSSRule", "CSSMediaRule", "MediaQueryList", "NodeFilter", "TreeWalker",
  "NodeIterator", "MutationObserver", "MutationRecord",
]);
for (const key of Object.getOwnPropertyNames(win)) {
  if (!DOM_FORZADO.has(key) && key in g) continue;
  try {
    const value = (win as unknown as Record<string, unknown>)[key];
    if (value !== undefined) g[key] = value;
  } catch {
    // getters que explotan fuera de su contexto: se ignoran
  }
}

// Compatibilidad con Radix: observadores y captura de puntero que happy-dom
// no implementa (Radix los toca al abrir popovers/menús; con stub basta)
if (!g.ResizeObserver) {
  g.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (!g.IntersectionObserver) {
  g.IntersectionObserver = class {
    root = null;
    rootMargin = "";
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}
const elementProto = (g.Element as unknown as { prototype: Record<string, unknown> } | undefined)?.prototype;
if (elementProto) {
  if (!elementProto.hasPointerCapture) elementProto.hasPointerCapture = () => false;
  if (!elementProto.setPointerCapture) elementProto.setPointerCapture = () => undefined;
  if (!elementProto.releasePointerCapture) elementProto.releasePointerCapture = () => undefined;
  if (!elementProto.scrollIntoView) elementProto.scrollIntoView = () => undefined;
}

// React 19 en entorno de test: act() sin avisos
g.IS_REACT_ACT_ENVIRONMENT = true;
