"use client";

import type { BookExtras } from "@/lib/types";

/** Props comunes de todos los paneles de modos de lectura */
export interface ModePanelProps {
  extras: BookExtras;
  /** parchea los extras del libro (merge superficial en el nivel superior) */
  onPatch: (patch: Partial<BookExtras>) => void;
  goToPage: (page: number) => void;
  pageNum: number;
  numPages: number;
}

export function uid(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
