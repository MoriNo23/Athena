"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { probePdf, titleFromFileName } from "@/lib/pdf-client";
import { probeEpub } from "@/lib/epub";

/**
 * Flujo de subida de libros (PDF o EPUB): arrastrar o elegir archivo → probe
 * (páginas + portada; título/autor si el EPUB los trae) → diálogo de ficha →
 * POST /api/books con manejo de duplicados (409 → aviso tranquilo) y errores de red.
 */
export function useBookUpload(opts: { onUploaded: () => Promise<void> }) {
  const { onUploaded } = opts;
  const { toast } = useToast();
  const { t } = useI18n();
  const [dragOver, setDragOver] = useState(false);
  const [probing, setProbing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [pendingFile, setPendingFile] = useState<{ file: File; numPages: number; cover: string | null } | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startUploadFlow = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      const lower = file.name.toLowerCase();
      const isPdf = lower.endsWith(".pdf");
      const isEpub = lower.endsWith(".epub");
      if (!isPdf && !isEpub) {
        toast({ title: t("toast.badFormatTitle"), description: t("toast.badFormatBody") });
        return;
      }
      setProbing(true);
      try {
        if (isEpub) {
          const probe = await probeEpub(file);
          // el EPUB trae su propia ficha: la metadata manda, el nombre es respaldo
          setPendingFile({ file, numPages: probe.numPages, cover: probe.coverDataUrl });
          setFormTitle(probe.title || titleFromFileName(file.name));
          setFormAuthor(probe.author || "");
        } else {
          const probe = await probePdf(file);
          setPendingFile({ file, numPages: probe.numPages, cover: probe.coverDataUrl });
          setFormTitle(titleFromFileName(file.name));
          setFormAuthor("");
        }
      } catch (e) {
        toast({
          title: isEpub ? t("toast.epubBad") : t("toast.pdfBad"),
          description: isEpub
            ? e instanceof Error ? e.message : t("toast.epubMsg")
            : t("toast.pdfMsg"),
          variant: "destructive",
        });
      } finally {
        setProbing(false);
      }
    },
    [toast, t]
  );

  const confirmUpload = useCallback(async () => {
    if (!pendingFile) return;
    setUploading(true);
    setUploadPct(0);
    setUploadPhase("uploading");
    try {
      const fd = new FormData();
      fd.append("file", pendingFile.file);
      fd.append("title", formTitle || titleFromFileName(pendingFile.file.name));
      fd.append("author", formAuthor);
      fd.append("totalPages", String(pendingFile.numPages));
      if (pendingFile.cover) fd.append("cover", pendingFile.cover);

      // XHR en vez de fetch: el progreso real de bytes solo existe ahí. Para
      // PDFs de 30MB+ la espera ya no es un velo ciego.
      const data = await new Promise<{ ok: boolean; status: number; body: { book?: { title: string; totalPages: number }; error?: string } }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/books");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadPct(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        };
        xhr.upload.onload = () => {
          setUploadPct(100);
          setUploadPhase("saving"); // el servidor escribe el archivo y crea la ficha
        };
        xhr.onload = () => {
          let body: { book?: { title: string; totalPages: number }; error?: string } = {};
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            // respuesta no-JSON: caerá al error genérico con status
          }
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
        };
        xhr.onerror = () => reject(new Error(t("toast.network")));
        xhr.send(fd);
      });

      if (data.status === 409) {
        // Duplicado: el PDF ya estaba. Aviso tranquilo, no error.
        toast({ title: t("toast.dupTitle"), description: data.body.error ?? t("toast.dupBody") });
        setPendingFile(null);
        return;
      }
      if (!data.ok) throw new Error(data.body.error ?? t("toast.failTitle"));
      const isEpubBook = pendingFile.file.name.toLowerCase().endsWith(".epub");
      toast({
        title: t("toast.addedTitle"),
        description: `${data.body.book?.title} · ${data.body.book?.totalPages} ${isEpubBook ? t("toast.virtualPages") : t("toast.pages")}`,
      });
      setPendingFile(null);
      await onUploaded();
    } catch (e) {
      toast({ title: t("toast.failTitle"), description: e instanceof Error ? e.message : t("edit.tryAgain"), variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadPhase("idle");
      setUploadPct(0);
    }
  }, [pendingFile, formTitle, formAuthor, onUploaded, toast, t]);

  return {
    dragOver,
    setDragOver,
    probing,
    uploading,
    uploadPct,
    uploadPhase,
    pendingFile,
    setPendingFile,
    formTitle,
    setFormTitle,
    formAuthor,
    setFormAuthor,
    fileInputRef,
    startUploadFlow,
    confirmUpload,
  };
}
