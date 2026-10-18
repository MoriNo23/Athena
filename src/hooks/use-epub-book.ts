"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseEpub, type EpubBook } from "@/lib/epub";
import type { TeleprompterBlock } from "@/lib/teleprompter";

/**
 * Carga y parsea un EPUB del servidor para el lector.
 * Devuelve las páginas virtuales, el índice de capítulos y un proveedor
 * getPageBlocks(p) que alimenta el modo teleprompter con los bloques reales
 * (h1-h4 incluidos, para que el flujo reconozca los títulos).
 */
export function useEpubBook(filePath: string | null) {
  const [book, setBook] = useState<EpubBook | null>(null);
  const [loading, setLoading] = useState(filePath != null);
  const [error, setError] = useState<string | null>(null);
  const bookRef = useRef<EpubBook | null>(null);

  useEffect(() => {
    bookRef.current = book;
  }, [book]);

  useEffect(() => {
    if (!filePath) {
      setBook(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBook(null);

    (async () => {
      try {
        const res = await fetch(filePath);
        if (!res.ok) throw new Error("No se pudo descargar el EPUB. Puede haberse movido o borrado.");
        const data = await res.arrayBuffer();
        const parsed = await parseEpub(data);
        if (cancelled) return;
        setBook(parsed);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "No se pudo abrir el EPUB.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  /** Bloques de texto de la página p (1-based) para el teleprompter continuo. */
  const getPageBlocks = useCallback(async (p: number): Promise<TeleprompterBlock[]> => {
    const pages = bookRef.current?.pages;
    if (!pages) return [];
    const page = pages[Math.min(Math.max(1, p), pages.length) - 1];
    const blocks: TeleprompterBlock[] = [];
    for (const b of page.blocks) {
      if (b.kind === "img" || !b.text.trim()) continue;
      blocks.push({ kind: b.kind, text: b.text });
    }
    return blocks;
  }, []);

  return { book, pages: book?.pages ?? null, chapters: book?.chapters ?? [], loading, error, getPageBlocks };
}
