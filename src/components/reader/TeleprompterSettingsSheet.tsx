"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Upload } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tip } from "@/components/reader/ZoomControls";
import { useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  clampTeleprompterFontScale,
  clampTeleprompterImagenHold,
  clampTeleprompterWps,
  TELEPROMPTER_FONDO_FILTRO_DEFAULT,
  TELEPROMPTER_FONT_MAX,
  TELEPROMPTER_FONT_MIN,
  TELEPROMPTER_IMAGEN_HOLD_MAX,
  TELEPROMPTER_IMAGEN_HOLD_MIN,
  TELEPROMPTER_IMAGEN_HOLD_STEP,
  TELEPROMPTER_WPS_MAX,
  TELEPROMPTER_WPS_MIN,
  TELEPROMPTER_WPS_STEP,
  type TeleprompterFondo,
} from "@/lib/types";
import type { BookDTO } from "@/lib/types";

interface TeleprompterSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: BookDTO;
}

/** Opciones del fondo: el mismo trío que el panel de configuración */
const FONDOS: { id: TeleprompterFondo; labelKey: string }[] = [
  { id: "tema", labelKey: "config.tpBgTema" },
  { id: "portada", labelKey: "config.tpBgPortada" },
  { id: "imagen", labelKey: "config.tpBgImagen" },
];

/**
 * Ajustes del teleprompter DENTRO del modo (change teleprompter-ajustes-inmode):
 * fondo, velocidad, figuras y comportamiento, sin salir del escenario.
 * Reutiliza el MISMO store (`useSettings.teleprompter`) que el panel de
 * configuración: un cambio aquí se ve allí y viceversa, y el fondo se aplica
 * en caliente (el overlay pinta `fondoImg` del store en cada render).
 */
export function TeleprompterSettingsSheet({ open, onOpenChange, book }: TeleprompterSettingsSheetProps) {
  const t = useI18n().t;
  const tpSet = useSettings((s) => s.teleprompter);
  const setTeleprompter = useSettings((s) => s.setTeleprompter);
  const fondoInputRef = useRef<HTMLInputElement | null>(null);
  const [subiendoFondo, setSubiendoFondo] = useState(false);
  const [errorFondo, setErrorFondo] = useState<string | null>(null);

  const subirFondo = async (file: File) => {
    setSubiendoFondo(true);
    setErrorFondo(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/teleprompter/fondo", { method: "POST", body: fd });
      const data = (await res.json()) as { ruta?: string; error?: string };
      if (!res.ok || !data.ruta) {
        setErrorFondo(data.error ?? t("config.tpBgErrorBody"));
        return;
      }
      // la ruta la guarda el API en db/config.json Y el store la pinta ya
      setTeleprompter({ fondo: "imagen", fondoRuta: data.ruta });
    } catch {
      setErrorFondo(t("config.tpBgErrorBody"));
    } finally {
      setSubiendoFondo(false);
    }
  };

  const fondoElegible = (id: TeleprompterFondo) => id !== "portada" || !!book.coverUrl;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-[90] flex w-full flex-col gap-5 overflow-y-auto p-5 sm:max-w-sm"
        data-testid="tp-settings-sheet"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="font-display">{t("tp.sheet.title")}</SheetTitle>
          <SheetDescription className="text-xs">{t("tp.sheet.hint")}</SheetDescription>
        </SheetHeader>

        {/* ---------- velocidad ---------- */}
        <section className="grid gap-3" aria-label={t("config.tpSpeed")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("config.tpSpeed")}
          </p>
          <div className={cn("grid gap-2", tpSet.instante && "pointer-events-none opacity-40")}>
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("tp.wps")}</Label>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {clampTeleprompterWps(tpSet.wps).toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>
            <Slider
              min={TELEPROMPTER_WPS_MIN}
              max={TELEPROMPTER_WPS_MAX}
              step={TELEPROMPTER_WPS_STEP}
              value={[clampTeleprompterWps(tpSet.wps)]}
              onValueChange={([v]) => setTeleprompter({ wps: clampTeleprompterWps(v) })}
              aria-label={t("tp.wpsAria")}
              data-testid="tp-sheet-wps"
            />
            <p className="text-[11px] text-muted-foreground">{t("tp.sheet.wpsLiveHint")}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">{t("config.tpInstant")}</Label>
            <Switch
              checked={tpSet.instante}
              onCheckedChange={(v) => setTeleprompter({ instante: v })}
              aria-label={t("tp.instantAria")}
              data-testid="tp-sheet-instant"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="text-xs">{t("config.tpCards")}</Label>
              <p className="text-[11px] text-muted-foreground">{t("config.tpCardsHint")}</p>
            </div>
            <Switch
              checked={tpSet.tarjetasPorFrase}
              onCheckedChange={(v) => setTeleprompter({ tarjetasPorFrase: v })}
              aria-label={t("config.tpCards")}
              data-testid="tp-sheet-cards"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("config.tpFont")}</Label>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {Math.round(clampTeleprompterFontScale(tpSet.fontScale) * 100)}%
              </span>
            </div>
            <Slider
              min={TELEPROMPTER_FONT_MIN}
              max={TELEPROMPTER_FONT_MAX}
              step={0.1}
              value={[clampTeleprompterFontScale(tpSet.fontScale)]}
              onValueChange={([v]) => setTeleprompter({ fontScale: clampTeleprompterFontScale(v) })}
              aria-label={t("config.tpFont")}
              data-testid="tp-sheet-font"
            />
          </div>
        </section>

        {/* ---------- fondo ---------- */}
        <section className="grid gap-3" aria-label={t("config.tpBg")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("config.tpBg")}
          </p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("config.tpBg")}>
            {FONDOS.map((f) => {
              const activo = tpSet.fondo === f.id;
              const elegible = fondoElegible(f.id);
              return (
                <Tip key={f.id} label={f.id === "portada" && !book.coverUrl ? t("config.tpBgNoCover") : f.labelKey ? t(f.labelKey) : ""}>
                  <Button
                    size="sm"
                    variant={activo ? "default" : "outline"}
                    className={cn("h-8 gap-1.5 text-xs", !elegible && "opacity-40")}
                    onClick={() => elegible && setTeleprompter({ fondo: f.id })}
                    aria-pressed={activo}
                    data-testid={`tp-sheet-fondo-${f.id}`}
                  >
                    {f.id === "imagen" && <ImageIcon className="h-3.5 w-3.5" />}
                    {t(f.labelKey)}
                  </Button>
                </Tip>
              );
            })}
          </div>
          {tpSet.fondo === "imagen" && (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => fondoInputRef.current?.click()}
                  disabled={subiendoFondo}
                  data-testid="tp-sheet-fondo-upload"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t("config.tpBgUpload")}
                </Button>
                {tpSet.fondoRuta && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setTeleprompter({ fondo: "tema", fondoRuta: "" })}
                    data-testid="tp-sheet-fondo-clear"
                  >
                    {t("tp.sheet.fondoClear")}
                  </Button>
                )}
              </div>
              <input
                ref={fondoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void subirFondo(file);
                }}
              />
              {errorFondo && <p className="text-xs text-destructive">{errorFondo}</p>}
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("config.tpBgFilter")}</Label>
                  <span className="text-xs font-medium tabular-nums text-foreground">
                    {Math.round(tpSet.fondoFiltro)}%
                  </span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[tpSet.fondoFiltro]}
                  onValueChange={([v]) => setTeleprompter({ fondoFiltro: v })}
                  aria-label={t("config.tpBgFilter")}
                  data-testid="tp-sheet-filtro"
                />
                <p className="text-[11px] text-muted-foreground">{t("config.tpBgFilterHint")}</p>
                {tpSet.fondoFiltro !== TELEPROMPTER_FONDO_FILTRO_DEFAULT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 justify-self-start text-[11px]"
                    onClick={() => setTeleprompter({ fondoFiltro: TELEPROMPTER_FONDO_FILTRO_DEFAULT })}
                  >
                    {t("tp.sheet.filterReset")}
                  </Button>
                )}
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{t("config.tpBgHint")}</p>
        </section>

        {/* ---------- figuras (P2) ---------- */}
        <section className="grid gap-3" aria-label={t("tp.sheet.imagenes")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("tp.sheet.imagenes")}
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="text-xs">{t("tp.sheet.pausaImagen")}</Label>
              <p className="text-[11px] text-muted-foreground">{t("tp.sheet.pausaImagenHint")}</p>
            </div>
            <Switch
              checked={tpSet.pausaImagen}
              onCheckedChange={(v) => setTeleprompter({ pausaImagen: v })}
              aria-label={t("tp.sheet.pausaImagen")}
              data-testid="tp-sheet-pausa-imagen"
            />
          </div>
          <div className={cn("grid gap-2", !tpSet.pausaImagen && "pointer-events-none opacity-40")}>
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("tp.sheet.imagenHold")}</Label>
              <span className="text-xs font-medium tabular-nums text-foreground">
                {t("tp.sheet.imagenHoldValue", { s: Math.round(clampTeleprompterImagenHold(tpSet.imagenHoldMs) / 1000) })}
              </span>
            </div>
            <Slider
              min={TELEPROMPTER_IMAGEN_HOLD_MIN}
              max={TELEPROMPTER_IMAGEN_HOLD_MAX}
              step={TELEPROMPTER_IMAGEN_HOLD_STEP}
              value={[clampTeleprompterImagenHold(tpSet.imagenHoldMs)]}
              onValueChange={([v]) => setTeleprompter({ imagenHoldMs: clampTeleprompterImagenHold(v) })}
              aria-label={t("tp.sheet.imagenHold")}
              data-testid="tp-sheet-hold"
            />
            <p className="text-[11px] text-muted-foreground">{t("tp.sheet.imagenHoldHint")}</p>
          </div>
        </section>

        {/* ---------- comportamiento ---------- */}
        <section className="grid gap-3" aria-label={t("tp.sheet.comportamiento")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("tp.sheet.comportamiento")}
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="text-xs">{t("config.tpAuto")}</Label>
              <p className="text-[11px] text-muted-foreground">{t("config.tpAutoHint")}</p>
            </div>
            <Switch
              checked={tpSet.auto}
              onCheckedChange={(v) => setTeleprompter({ auto: v })}
              aria-label={t("tp.autoOnAria")}
              data-testid="tp-sheet-auto"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="text-xs">{t("config.tpSound")}</Label>
              <p className="text-[11px] text-muted-foreground">{t("config.tpSoundHint")}</p>
            </div>
            <Switch
              checked={tpSet.sound}
              onCheckedChange={(v) => setTeleprompter({ sound: v })}
              aria-label={t("tp.muteAria")}
              data-testid="tp-sheet-sound"
            />
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}
