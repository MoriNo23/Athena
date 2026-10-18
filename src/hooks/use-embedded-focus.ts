"use client";

import { useEffect, useState } from "react";

/**
 * Foco del teclado en contextos embebidos (preview en iframe).
 *
 * Si la app corre dentro de un iframe, las teclas van al documento padre hasta
 * que el usuario hace click dentro de la app (limitación del navegador). En
 * cada interacción reclamamos el foco y reportamos — mientras el teclado no sea
 * nuestro — para que la UI pueda mostrar una pastilla sutil que lo explique.
 */
export function useEmbeddedFocus(): boolean {
  const [embeddedNoFocus, setEmbeddedNoFocus] = useState(false);

  useEffect(() => {
    let embedded = false;
    try {
      embedded = window.self !== window.top;
    } catch {
      embedded = true; // acceso entre marcos bloqueado ⇒ embebidos
    }
    if (!embedded) return;
    const claim = () => window.focus();
    const sync = () => setEmbeddedNoFocus(!document.hasFocus());
    window.addEventListener("pointerdown", claim, { capture: true, passive: true });
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    sync();
    return () => {
      window.removeEventListener("pointerdown", claim, { capture: true });
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
    };
  }, []);

  return embeddedNoFocus;
}
