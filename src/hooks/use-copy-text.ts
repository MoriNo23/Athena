"use client";

import { useCallback, useState } from "react";

/**
 * Copia texto al portapapeles con feedback temporal (marca "copiado" 1.8 s).
 * Respaldo para entornos sin Clipboard API (navegadores viejos, http no seguro).
 */
export function useCopyText(text: string | null | undefined) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    if (!text) return;
    const mark = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    };
    const legacy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) mark();
      } catch {
        /* noop */
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(mark, legacy);
    } else {
      legacy();
    }
  }, [text]);

  return { copied, copy };
}
