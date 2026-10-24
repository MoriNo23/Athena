"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  cancelOcr,
  getOcrCache,
  putOcrCache,
  runOcrPage,
  type OcrLang,
  type OcrPageResult,
} from "@/lib/ocr";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCopyText } from "@/hooks/use-copy-text";
import { useOcrLang } from "@/hooks/use-ocr-lang";
import { useI18n } from "@/lib/i18n";

/** Estado etiquetado por (página, archivo, idioma): al navegar, el resultado
 * antiguo deja de ser visible por sí solo, sin resets por efecto. */
interface OcrState {
  page: number;
  filePath: string;
  lang: OcrLang;
  status: "idle" | "working" | "error";
  result: OcrPageResult | null;
  error: string | null;
  progress: number;
  phase: string;
}

function ocrErrorMessage(code?: string, t?: (k: string) => string): string {
  if (code === "network" || code === "timeout") {
    return t ? t("ocrerr.download") : "No se pudo descargar el motor OCR.";
  }
  return t ? t("ocrerr.page") : "El OCR falló en esta página.";
}

/**
 * OCR de páginas escaneadas (bajo demanda): ejecución con etiqueta
 * (página, archivo, idioma), caché en IndexedDB, cambio de idioma persistido
 * y re-OCR automático al cambiar de idioma en una página ya en modo OCR.
 */
export function useOcrPage(opts: {
  doc: PDFDocumentProxy | null;
  filePath: string;
  pageNum: number;
  pageHasTextRef: RefObject<boolean | null>;
}) {
  const { doc, filePath, pageNum, pageHasTextRef } = opts;
  const [ocr, setOcr] = useState<OcrState | null>(null);
  const { t } = useI18n();
  const [showOcrText, setShowOcrText] = useState(false);
  const { ocrLang, ocrLangRef, setOcrLang } = useOcrLang();
  const ocrRunRef = useRef(0);
  const ocrWorkingRef = useRef(false);
  const autoOcrRef = useRef(false);
  const prevOcrDepsRef = useRef<{ page: number; lang: OcrLang } | null>(null);

  // Vista del OCR válida para la página actual (la etiqueta evita mostrar resultados viejos)
  const ocrActive =
    ocr && ocr.page === pageNum && ocr.filePath === filePath && ocr.lang === ocrLang ? ocr : null;
  const ocrResult = ocrActive?.result ?? null;
  const ocrWorking = ocrActive?.status === "working";

  // ---- Ejecutar OCR sobre la página actual ----
  const startOcr = useCallback(
    async (langOverride?: OcrLang) => {
      const lang = langOverride ?? ocrLang;
      if (!doc || ocrWorkingRef.current) return;
      const run = ++ocrRunRef.current;
      ocrWorkingRef.current = true;
      const tag = { page: pageNum, filePath, lang };
      setOcr({ ...tag, status: "working", result: null, error: null, progress: 0, phase: t("ocrphase.preparing") });
      const setTick = (f: number, phase: string) => {
        if (run === ocrRunRef.current) {
          setOcr({ ...tag, status: "working", result: null, error: null, progress: f, phase });
        }
      };
      try {
        const cached = await getOcrCache(filePath, pageNum, lang);
        if (run !== ocrRunRef.current) return;
        if (cached) {
          setOcr({ ...tag, status: "idle", result: cached, error: null, progress: 1, phase: t("ocrphase.ready") });
          return;
        }
        const res = await runOcrPage({ doc, pageNum, sourceKey: filePath, lang, onProgress: setTick });
        if (run !== ocrRunRef.current) return;
        void putOcrCache(filePath, pageNum, lang, res);
        setOcr({ ...tag, status: "idle", result: res, error: null, progress: 1, phase: t("ocrphase.ready") });
      } catch (e) {
        if (run !== ocrRunRef.current) return;
        console.warn("OCR falló", e);
        setOcr({
          ...tag,
          status: "error",
          result: null,
          error: ocrErrorMessage((e as { message?: string })?.message, t),
          progress: 0,
          phase: "",
        });
      } finally {
        if (run === ocrRunRef.current) ocrWorkingRef.current = false;
      }
    },
    [doc, ocrLang, filePath, pageNum]
  );

  const switchOcrLang = useCallback(
    (lang: OcrLang) => {
      if (ocrWorkingRef.current || lang === ocrLangRef.current) return;
      autoOcrRef.current = true; // la página ya estaba en modo OCR → repetir en el nuevo idioma
      setOcrLang(lang);
    },
    [setOcrLang]
  );

  const hideOcr = useCallback(() => {
    setOcr(null);
    setShowOcrText(false);
  }, []);

  const { copied: ocrCopied, copy: copyOcrText } = useCopyText(ocrResult?.text);

  // ---- OCR cacheado al entrar en una página + re-OCR automático al cambiar idioma ----
  useEffect(() => {
    let alive = true;
    const prev = prevOcrDepsRef.current;
    prevOcrDepsRef.current = { page: pageNum, lang: ocrLang };
    const langSwitched = !!prev && prev.page === pageNum && prev.lang !== ocrLang;

    getOcrCache(filePath, pageNum, ocrLang).then((cached) => {
      if (!alive) return;
      if (cached) {
        setOcr({
          page: pageNum,
          filePath,
          lang: ocrLang,
          status: "idle",
          result: cached,
          error: null,
          progress: 1,
          phase: t("ocrphase.ready"),
        });
        return;
      }
      if (langSwitched && autoOcrRef.current && pageHasTextRef.current === false) {
        autoOcrRef.current = false;
        void startOcr(ocrLang);
      }
    });

    return () => {
      alive = false;
      const wasWorking = ocrWorkingRef.current;
      // el run deja de valer antes de cancelar: si recognize no resuelve tras
      // terminar el worker, el finally no puede reenganchar la guardia
      ocrRunRef.current += 1;
      ocrWorkingRef.current = false;
      if (wasWorking) void cancelOcr(ocrLangRef.current);
    };
  }, [pageNum, filePath, ocrLang, startOcr, pageHasTextRef]);

  return {
    ocrActive,
    ocrResult,
    ocrWorking,
    ocrLang,
    showOcrText,
    setShowOcrText,
    ocrCopied,
    startOcr,
    switchOcrLang,
    hideOcr,
    copyOcrText,
  };
}
