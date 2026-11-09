"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, PlugZap, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** puente que instala el motor offline (public/athena-offline.js, install()) */
interface PuenteSync {
  probar: (base: string, token: string) => Promise<{ libros: number }>;
  traerDe: (
    base: string,
    token: string,
    nota?: (n: { fase: string; actualizados?: number; nuevos?: number; total?: number; titulo?: string }) => void
  ) => Promise<{ actualizados: number; nuevos: number; ficheros: unknown[] }>;
  enviarA: (
    base: string,
    token: string,
    nota?: (n: { fase: string; titulo?: string; total?: number }) => void
  ) => Promise<{ libros: number }>;
}

function puente(): PuenteSync | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __athenaOffline?: { sync?: PuenteSync } };
  return w.__athenaOffline?.sync ?? null;
}

const CLAVE_URL = "athena.sync.url";

/** normaliza la dirección: http(s) y sin barra final; null si no sirve */
function baseSana(bruta: string): string | null {
  const v = bruta.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(v)) return null;
  return v;
}

/**
 * Copia de la casa (Enmienda 1 de PRODUCT.md): sincronización a mano entre el
 * APK y el servidor de la dueña por la red de casa. Dos botones, ninguna
 * automatización: «el ordenador manda» (traer) o «el móvil manda» (enviar).
 * Solo existe en la build del APK — en self-host el servidor ES la biblioteca.
 */
export function SyncDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [password, setPassword] = useState("");
  const [ocupado, setOcupado] = useState<"probando" | "trayendo" | "enviando" | null>(null);
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    if (open && !url) {
      setUrl(localStorage.getItem(CLAVE_URL) ?? "");
    }
  }, [open, url]);

  const tokenDe = useCallback(
    async (base: string): Promise<string> => {
      if (!password.trim()) return "";
      const r = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!r.ok) throw new Error(j.error ?? "auth");
      return j.token ?? "";
    },
    [password]
  );

  const ejecutar = useCallback(
    async (cual: "probando" | "trayendo" | "enviando") => {
      const puenteSync = puente();
      const base = baseSana(url);
      if (!puenteSync) return;
      if (!base) {
        setEstado({ ok: false, texto: t("copia.errUrl") });
        return;
      }
      localStorage.setItem(CLAVE_URL, base);
      setOcupado(cual);
      setEstado(null);
      try {
        const token = await tokenDe(base);
        if (cual === "probando") {
          const r = await puenteSync.probar(base, token);
          setEstado({ ok: true, texto: t("copia.okConn", { n: r.libros }) });
        } else if (cual === "trayendo") {
          let ficheros = 0;
          const informe = await puenteSync.traerDe(base, token, (n) => {
            if (n.fase === "fichero" && n.total) {
              ficheros = n.total;
              setEstado({ ok: true, texto: t("copia.ficheros", { n: n.total }) });
            }
          });
          setEstado({
            ok: true,
            texto: t("copia.okTraer", { a: informe.actualizados, n: informe.nuevos, f: ficheros }),
          });
        } else {
          const r = await puenteSync.enviarA(base, token, (n) => {
            if (n.fase === "libro" && n.titulo) {
              setEstado({ ok: true, texto: t("copia.enviando", { t: n.titulo }) });
            }
          });
          setEstado({ ok: true, texto: t("copia.okEnviar", { n: r.libros }) });
        }
        setPassword(""); // la contraseña no se queda en memoria más de la cuenta
        setTimeout(() => {
          onOpenChange(false);
          location.reload(); // la biblioteca refleja la copia recién llegada
        }, 1200);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        setEstado({ ok: false, texto: m === "auth" ? t("copia.candado") : t("copia.err", { m }) });
      } finally {
        setOcupado(null);
      }
    },
    [url, password, t, tokenDe, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="sync-dialog">
        <DialogHeader>
          <DialogTitle>{t("copia.title")}</DialogTitle>
          <DialogDescription>{t("copia.desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sync-url">{t("copia.url")}</Label>
            <Input
              id="sync-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("copia.urlPlaceholder")}
              inputMode="url"
              autoComplete="off"
              data-testid="sync-url"
            />
            <p className="text-xs text-muted-foreground">{t("copia.urlHint")}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sync-password">{t("copia.password")}</Label>
            <Input
              id="sync-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("copia.passwordPlaceholder")}
              autoComplete="off"
              data-testid="sync-password"
            />
            <p className="text-xs text-muted-foreground">{t("copia.passwordHint")}</p>
          </div>

          {estado && (
            <p
              className={`rounded-md px-3 py-2 text-sm ${
                estado.ok ? "bg-primary/10 text-foreground" : "bg-destructive/10 text-destructive"
              }`}
              data-testid="sync-status"
              role="status"
            >
              {estado.texto}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="outline"
            onClick={() => ejecutar("probando")}
            disabled={ocupado !== null}
            className="w-full"
            data-testid="sync-probar"
          >
            {ocupado === "probando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            {t("copia.probar")}
          </Button>
          <Button
            variant="outline"
            onClick={() => ejecutar("trayendo")}
            disabled={ocupado !== null}
            className="w-full"
            data-testid="sync-traer"
          >
            {ocupado === "trayendo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("copia.traer")}
          </Button>
          <Button
            onClick={() => ejecutar("enviando")}
            disabled={ocupado !== null}
            className="w-full"
            data-testid="sync-enviar"
          >
            {ocupado === "enviando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {t("copia.enviar")}
          </Button>
        </DialogFooter>

        <p className="text-xs text-muted-foreground">{t("copia.traerDesc")}</p>
        <p className="text-xs text-muted-foreground">{t("copia.enviarDesc")}</p>
      </DialogContent>
    </Dialog>
  );
}
