"use client";

import { useCallback, useRef, useState } from "react";
import type { OcrLang } from "@/lib/ocr";

function readSavedOcrLang(): OcrLang {
  if (typeof window === "undefined") return "spa";
  try {
    const saved = localStorage.getItem("riel-ocr-lang");
    return saved === "spa" || saved === "eng" ? saved : "spa";
  } catch {
    return "spa";
  }
}

/** Idioma del OCR (spa/eng) persistido en localStorage */
export function useOcrLang() {
  const [ocrLang, setOcrLangState] = useState<OcrLang>(readSavedOcrLang);
  const ocrLangRef = useRef(ocrLang);

  const setOcrLang = useCallback((lang: OcrLang) => {
    ocrLangRef.current = lang;
    setOcrLangState(lang);
    try {
      localStorage.setItem("riel-ocr-lang", lang);
    } catch {
      /* noop */
    }
  }, []);

  return { ocrLang, ocrLangRef, setOcrLang };
}
