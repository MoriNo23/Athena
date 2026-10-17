"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Loader2, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n";

interface OutlineItem {
  title: string;
  page: number | null;
  items?: OutlineItem[];
}

/**
 * Esquema del PDF: el índice que trae el documento (si lo trae), resuelto a
 * páginas y navegable. Es el esqueleto que usan la primera pasada (técnico) y
 * el modo esqueleto argumental (literatura).
 */
export function OutlinePanel({
  doc,
  goToPage,
  currentPage,
}: {
  doc: PDFDocumentProxy | null;
  goToPage: (page: number) => void;
  currentPage: number;
}) {
  const { t } = useI18n();
  const [outline, setOutline] = useState<OutlineItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // reinicio de estado dentro del flujo asíncrono (evita cascada de renders)
      await Promise.resolve();
      if (cancelled) return;
      setOutline(null);
      setFailed(false);

      if (!doc) return;
      try {
        const raw = await doc.getOutline();
        if (cancelled) return;
        if (!raw || raw.length === 0) {
          setOutline([]);
          return;
        }

        const resolvePage = async (dest: unknown): Promise<number | null> => {
          try {
            let explicit: unknown[] | null = null;
            if (typeof dest === "string") {
              explicit = (await doc.getDestination(dest)) as unknown[] | null;
            } else if (Array.isArray(dest)) {
              explicit = dest;
            }
            if (!explicit || explicit.length === 0) return null;
            const ref = explicit[0];
            if (ref && typeof ref === "object") {
              const index = await doc.getPageIndex(ref as { num: number; gen: number });
              return index + 1;
            }
            if (typeof ref === "number") return ref + 1;
            return null;
          } catch {
            return null;
          }
        };

        // resolver con límite de profundidad y convertir a árbol plano tipado
        const convert = async (items: Array<{ title: string; dest: unknown; items?: unknown[] }>): Promise<OutlineItem[]> => {
          const out: OutlineItem[] = [];
          for (const it of items) {
            const page = await resolvePage(it.dest);
            const children = Array.isArray(it.items) && it.items.length > 0
              ? await convert(it.items as Array<{ title: string; dest: unknown; items?: unknown[] }>)
              : undefined;
            out.push({ title: it.title, page, items: children });
          }
          return out;
        };

        const tree = await convert(raw as Array<{ title: string; dest: unknown; items?: unknown[] }>);
        if (!cancelled) setOutline(tree);
      } catch (e) {
        console.warn("No se pudo leer el esquema del PDF", e);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc]);

  if (!doc) return null;

  if (failed) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        {t("outline.fail")}
      </p>
    );
  }

  if (outline === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("outline.reading")}
      </div>
    );
  }

  if (outline.length === 0) {
    return (
      <div className="grid gap-2 py-8 text-center text-xs text-muted-foreground" data-testid="outline-empty">
        <ListTree className="mx-auto h-6 w-6 opacity-40" />
        <p>{t("outline.empty")}</p>
        <p className="text-xs text-muted-foreground">
          {t("outline.emptyHint")}
        </p>
      </div>
    );
  }

  const renderItem = (item: OutlineItem, depth: number): ReactNode => (
    <li key={`${item.title}-${item.page ?? "?"}-${depth}`} className="grid">
      <Button
        variant="ghost"
        size="sm"
        disabled={item.page == null}
        onClick={() => item.page != null && goToPage(item.page)}
        className={`h-auto justify-start gap-1.5 py-1 pr-2 text-left text-xs font-normal ${item.page === currentPage ? "text-primary" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        title={item.page != null ? t("outline.goTo", { n: item.page }) : item.title}
      >
        <span className="truncate">{item.title || t("outline.untitled")}</span>
        {item.page != null && (
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">{item.page}</span>
        )}
      </Button>
      {item.items && item.items.length > 0 && <ul className="grid">{item.items.map((child) => renderItem(child, depth + 1))}</ul>}
    </li>
  );

  return (
    <ScrollArea className="max-h-[420px] pr-2" data-testid="outline-list">
      <ul className="grid">{outline.map((item) => renderItem(item, 0))}</ul>
    </ScrollArea>
  );
}
