#!/usr/bin/env python3
"""Parche i18n de la cola larga: hooks con toasts + diccionario/vocab/OCR/peek/sync/pause."""
import sys

def patch(path, pairs):
    s = open(path, encoding="utf-8").read()
    for old, new in pairs:
        if old not in s:
            print(f"MISS en {path}: {old[:60]!r}")
            sys.exit(1)
        s = s.replace(old, new, 1)
    open(path, "w", encoding="utf-8").write(s)
    print(f"ok {path}")

# ---------- OcrOverlay: pie del panel de texto ----------
patch("src/components/reader/OcrOverlay.tsx", [
    ('{ocrResult.words.length} palabras · selecciona sobre la página para usar el diccionario',
     '{t("ocr.wordsFooter", { n: ocrResult.words.length })}'),
])

# ---------- DictionaryCard ----------
patch("src/components/reader/DictionaryCard.tsx", [
    ('import type { RefObject } from "react";',
     'import { useI18n } from "@/lib/i18n";\nimport type { RefObject } from "react";'),
    ('  onPronounce,\n}: DictionaryCardProps) {\n  return (',
     '  onPronounce,\n}: DictionaryCardProps) {\n  const { t } = useI18n();\n  return ('),
    ('aria-label={`Definición de ${word}`}', 'aria-label={t("dict.aria", { word })}'),
    ('onClick={onPronounce} aria-label="Pronunciar" title="Pronunciar"',
     'onClick={onPronounce} aria-label={t("dict.pronounce")} title={t("dict.pronounce")}'),
    ('onClick={onClose} aria-label="Cerrar diccionario"',
     'onClick={onClose} aria-label={t("dict.close")}'),
    ('<Loader2 className="h-4 w-4 animate-spin" /> Buscando definición…',
     '<Loader2 className="h-4 w-4 animate-spin" /> {t("dict.searching")}'),
    ('''            <p className="text-sm text-muted-foreground">
              Sin resultados para «{data.word}» en {data.lang === "es" ? "español" : "inglés"}.
            </p>
            <p className="text-xs text-muted-foreground">Prueba buscando en el otro idioma abajo.</p>''',
     '''            <p className="text-sm text-muted-foreground">
              {t("dict.noResults", { word: data.word, lang: data.lang === "es" ? t("dict.langEs") : t("dict.langEn") })}
            </p>
            <p className="text-xs text-muted-foreground">{t("dict.tryOther")}</p>'''),
    ('role="group" aria-label="Idioma de búsqueda"',
     'role="group" aria-label={t("dict.langGroup")}'),
    ('title={saved ? "Ya está en tu vocabulario" : "Guardar en vocabulario"}',
     'title={saved ? t("dict.savedTip") : t("dict.saveTip")}'),
    ('{saved ? "Guardada" : "Guardar"}', '{saved ? t("dict.saved") : t("dict.save")}'),
])

# ---------- DictionaryEntries ----------
patch("src/components/reader/DictionaryEntries.tsx", [
    ('import type { DictionaryResult } from "@/lib/types";',
     'import type { DictionaryResult } from "@/lib/types";\nimport { useI18n } from "@/lib/i18n";'),
    ('export function DictionaryEntries({ data }: { data: DictionaryResult }) {\n  return (',
     'export function DictionaryEntries({ data }: { data: DictionaryResult }) {\n  const { t } = useI18n();\n  return ('),
    ('Fuente: {data.source}', '{t("dict.source", { src: data.source })}'),
])

# ---------- VocabularySheet ----------
patch("src/components/reader/VocabularySheet.tsx", [
    ('import { useSettings } from "@/lib/settings";',
     'import { useSettings } from "@/lib/settings";\nimport { useI18n } from "@/lib/i18n";'),
    ('export function VocabularySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {\n  const vocabulary = useSettings((s) => s.vocabulary);',
     'export function VocabularySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {\n  const { t } = useI18n();\n  const vocabulary = useSettings((s) => s.vocabulary);'),
    ('<Languages className="h-5 w-5 text-primary" /> Vocabulario',
     '<Languages className="h-5 w-5 text-primary" /> {t("vocab.title")}'),
    ('''            Palabras que guardaste al leer. {vocabulary.length > 0 ? `${vocabulary.length} en tu colección.` : ""}''',
     '''            {t("vocab.desc")}{vocabulary.length > 0 ? ` ${t("vocab.count", { n: vocabulary.length })}` : ""}'''),
    ('<p className="font-medium">Todavía no guardaste palabras.</p>',
     '<p className="font-medium">{t("vocab.emptyTitle")}</p>'),
    ('''              <p className="text-xs">
                Mientras lees, selecciona una palabra del libro y pulsa la estrella para llevarla aquí,
                con el libro y la página donde apareció.
              </p>''',
     '              <p className="text-xs">{t("vocab.emptyBody")}</p>'),
    ('aria-label={`Eliminar ${v.word} del vocabulario`}',
     'aria-label={t("vocab.delete", { word: v.word })}'),
    ('<BookOpen className="h-3 w-3" /> {v.bookTitle} · pág. {v.page}',
     '<BookOpen className="h-3 w-3" /> {t("vocab.entryMeta", { book: v.bookTitle, n: v.page })}'),
])

# ---------- use-library-books ----------
patch("src/hooks/use-library-books.ts", [
    ('toast({ title: "Error", description: "No se pudo cargar la biblioteca", variant: "destructive" });',
     'toast({ title: t("lib.errorTitle"), description: t("lib.errorBody"), variant: "destructive" });'),
    ('  const [books, setBooks] = useState<BookWithSessions[] | null>(null);',
     '  const { t } = useI18n();\n  const [books, setBooks] = useState<BookWithSessions[] | null>(null);'),
    ('  }, [toast]);', '  }, [toast, t]);'),
])

# imports para use-library-books
patch("src/hooks/use-library-books.ts", [
    ('import { useToast } from "@/hooks/use-toast";', 'import { useToast } from "@/hooks/use-toast";\nimport { useI18n } from "@/lib/i18n";'),
])

# ---------- use-milestone-celebration ----------
patch("src/hooks/use-milestone-celebration.ts", [
    ('import { useToast } from "@/hooks/use-toast";',
     'import { useToast } from "@/hooks/use-toast";\nimport type { Translator } from "@/lib/i18n";'),
    ('''function celebrateMilestone(opts: {
  finished: boolean;
  page: number;
  numPages: number;
  segments: number;
  passedNow: number;
  bookTitle: string;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const { finished, page, numPages, segments, passedNow, bookTitle } = opts;
  if (finished) {
    fireConfetti(true);
    opts.toast({
      title: "🏆 ¡Libro terminado!",
      description: `${bookTitle} — cada página del riel, completa. Orgullo legítimo.`,
      duration: 8000,
    });
    return;
  }
  fireConfetti(false);
  opts.toast({
    title: `Hito ${passedNow} de ${segments} alcanzado`,
    description: `${Math.round((page / numPages) * 100)}% del libro · pág. ${page}. Tu cerebro acaba de recibir su recompensa.`,
    duration: 5000,
  });
}''',
     '''function celebrateMilestone(opts: {
  finished: boolean;
  page: number;
  numPages: number;
  segments: number;
  passedNow: number;
  bookTitle: string;
  toast: ReturnType<typeof useToast>["toast"];
  t: Translator;
}) {
  const { finished, page, numPages, segments, passedNow, bookTitle, t } = opts;
  if (finished) {
    fireConfetti(true);
    opts.toast({
      title: t("mile.finishedTitle"),
      description: t("mile.finishedBody", { title: bookTitle }),
      duration: 8000,
    });
    return;
  }
  fireConfetti(false);
  opts.toast({
    title: t("mile.milestoneTitle", { n: passedNow, m: segments }),
    description: t("mile.milestoneBody", { pct: Math.round((page / numPages) * 100), page }),
    duration: 5000,
  });
}'''),
])

# ---------- use-finish-badge ----------
patch("src/hooks/use-finish-badge.ts", [
    ('import { BADGE_TIERS, type BookDTO } from "@/lib/types";',
     'import { BADGE_TIERS, type BookDTO } from "@/lib/types";\nimport { useI18n, type Translator } from "@/lib/i18n";'),
    ('''function badgeToast(
  data: FinishResponse & { badge: NonNullable<FinishResponse["badge"]> },
  bookTitle: string,
  toast: ReturnType<typeof useToast>["toast"],
  onBookChange?: (book: BookDTO) => void,
  bookRef?: { current: BookDTO }
) {
  const meta = BADGE_TIERS[data.badge.tier] ?? BADGE_TIERS[1];
  if (data.first) {
    toast({
      title: `Insignia obtenida: ${meta.label}`,
      description: `«${bookTitle}» entra en tu colección. Releerlo subirá su tier hasta Diamante.`,
      duration: 9000,
    });
  } else {
    toast({
      title: `Insignia mejorada a ${meta.label}`,
      description: `Lectura nº ${data.badge.readings} completada de «${bookTitle}».`,
      duration: 9000,
    });
  }''',
     '''function badgeToast(
  data: FinishResponse & { badge: NonNullable<FinishResponse["badge"]> },
  bookTitle: string,
  toast: ReturnType<typeof useToast>["toast"],
  onBookChange?: (book: BookDTO) => void,
  bookRef?: { current: BookDTO },
  t?: Translator
) {
  const tr = t ?? ((key: string) => key);
  const meta = BADGE_TIERS[data.badge.tier] ?? BADGE_TIERS[1];
  const tierLabel = tr(`badge.${meta.key}`);
  if (data.first) {
    toast({
      title: tr("fb.earnedTitle") + tierLabel,
      description: tr("fb.earnedBody", { title: bookTitle }),
      duration: 9000,
    });
  } else {
    toast({
      title: tr("fb.upgradedTitle") + tierLabel,
      description: tr("fb.upgradedBody", { n: data.badge.readings, title: bookTitle }),
      duration: 9000,
    });
  }'''),
    ('  const { bookId, bookTitle, bookRef, onBookChange } = opts;\n  const { toast } = useToast();',
     '  const { bookId, bookTitle, bookRef, onBookChange } = opts;\n  const { toast } = useToast();\n  const { t } = useI18n();'),
    ('''        toast({
          title: "Lectura completada — insignia pendiente",
          description: "Añade el título y el autor de este libro (lápiz en su tarjeta) para que las lecturas den insignia.",
          duration: 10000,
        });''',
     '''        toast({
          title: t("fb.pendingTitle"),
          description: t("fb.pendingBody"),
          duration: 10000,
        });'''),
    ('badgeToast(data as FinishResponse & { badge: NonNullable<FinishResponse["badge"]> }, bookTitle, toast, onBookChange, bookRef);',
     'badgeToast(data as FinishResponse & { badge: NonNullable<FinishResponse["badge"]> }, bookTitle, toast, onBookChange, bookRef, t);'),
])

# ---------- use-cover-manager ----------
patch("src/hooks/use-cover-manager.ts", [
    ('import { sourceLabel, searchCover, uploadCover } from "@/lib/cover-search";',
     'import { sourceLabel, searchCover, uploadCover } from "@/lib/cover-search";\nimport { useI18n } from "@/lib/i18n";'),
    ('  const { toast } = useToast();',
     '  const { toast } = useToast();\n  const { t } = useI18n();'),
    ('''        toast({
          title: "No se pudo aplicar la portada",
          description: up.error ?? "Intenta de nuevo",
          variant: "destructive",
        });''',
     '''        toast({
          title: t("cover.applyFailTitle"),
          description: up.error ?? t("edit.tryAgain"),
          variant: "destructive",
        });'''),
    ('''      toast({
        title: "Portada actualizada",
        description: hit.downloaded
          ? `Imagen descargada y guardada desde ${src}.`
          : `Enlazada desde ${src}.`,
      });''',
     '''      toast({
        title: t("cover.updatedTitle"),
        description: hit.downloaded
          ? t("cover.downloadedBody", { src })
          : t("cover.linkedBody", { src }),
      });'''),
    ('''          toast({
            title: "Faltan datos para buscar",
            description: "La portada real se busca con título y autor definidos: es lo que pide la API.",
          });''',
     '''          toast({
            title: t("cover.missingTitle"),
            description: t("cover.missingBody"),
          });'''),
    ('''            toast({
              title: "Sin resultados",
              description: "Ninguna API gratuita encontró esa portada. Puedes subirla como imagen.",
            });''',
     '''            toast({
              title: t("cover.noResultsTitle"),
              description: t("cover.noResultsBody"),
            });'''),
    ('''          toast({
            title: "Búsqueda fallida",
            description: "No hubo respuesta de las APIs de portadas. Revisa tu conexión e inténtalo de nuevo.",
          });''',
     '''          toast({
            title: t("cover.searchFailTitle"),
            description: t("cover.searchFailBody"),
          });'''),
    ('toast({ title: "Ese archivo no es una imagen", variant: "destructive" });',
     'toast({ title: t("cover.notImage"), variant: "destructive" });'),
    ('''        if (!res.ok) throw new Error(data.error ?? "Error al subir la imagen");''',
     '''        if (!res.ok) throw new Error(data.error ?? t("cover.uploadError"));'''),
    ('toast({ title: "Portada aplicada", description: "Imagen personalizada guardada." });',
     'toast({ title: t("cover.appliedTitle"), description: t("cover.appliedBody") });'),
    ('''        toast({
          title: "No se pudo aplicar la imagen",
          description: e instanceof Error ? e.message : "Intenta de nuevo",
          variant: "destructive",
        });''',
     '''        toast({
          title: t("cover.imageFailTitle"),
          description: e instanceof Error ? e.message : t("edit.tryAgain"),
          variant: "destructive",
        });'''),
])

# ---------- use-word-selection ----------
patch("src/hooks/use-word-selection.ts", [
    ('      toast({\n        title: "Libro escaneado detectado",\n        description:\n          "Esta página es una imagen (sin texto digital). Pulsa el botón «OCR» sobre la página para reconocer su texto: podrás seleccionar palabras, copiarlas y buscarlas en el diccionario.",\n        duration: 7000,\n      });\n    },\n    [bookId, toast]',
     '      toast({\n        title: t("scan.title"),\n        description: t("scan.body"),\n        duration: 7000,\n      });\n    },\n    [bookId, toast, t]'),
])

# ---------- use-ocr-page ----------
patch("src/hooks/use-ocr-page.ts", [
    ('''function ocrErrorMessage(code?: string): string {
  if (code === "network" || code === "timeout") {
    return "No se pudo descargar el motor OCR (¿sin conexión?). Revisa tu red e inténtalo de nuevo.";
  }
  return "El OCR falló en esta página. Inténtalo de nuevo.";
}''',
     '''function ocrErrorMessage(code?: string, t?: (k: string) => string): string {
  if (code === "network" || code === "timeout") {
    return t ? t("ocrerr.download") : "No se pudo descargar el motor OCR (sin conexión).";
  }
  return t ? t("ocrerr.page") : "El OCR falló en esta página.";
}'''),
])

# ---------- use-dictionary-popover ----------
patch("src/hooks/use-dictionary-popover.ts", [
    ('import { useWordSelectionEvents } from "@/hooks/use-word-selection";',
     'import { useWordSelectionEvents } from "@/hooks/use-word-selection";\nimport { useI18n } from "@/lib/i18n";'),
    ('  const { toast } = useToast();',
     '  const { toast } = useToast();\n  const { t } = useI18n();'),
    ('setError("Sin conexión con el diccionario");', 'setError(t("dict.errOffline"));'),
    ('''    toast({
      title: `«${data.word}» guardada`,
      description: "Está en tu vocabulario, con el libro y la página donde la encontraste.",
      duration: 3000,
    });
  }, [data, saved, addVocab, bookId, bookTitle, page, toast]);''',
     '''    toast({
      title: t("dict.savedToast", { word: data.word }),
      description: t("dict.savedToastBody"),
      duration: 3000,
    });
  }, [data, saved, addVocab, bookId, bookTitle, page, toast, t]);'''),
])

print("TODO OK")
