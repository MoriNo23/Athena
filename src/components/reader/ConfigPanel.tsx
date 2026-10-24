"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import {
  BookDTO,
  FilterPreset,
  RailPosition,
  RailTheme,
  RAIL_THEMES,
  clampTeleprompterFontScale,
  clampTeleprompterWps,
  TELEPROMPTER_FONT_MAX,
  TELEPROMPTER_FONT_MIN,
  TELEPROMPTER_FONT_STEP,
  TELEPROMPTER_WPS_MAX,
  TELEPROMPTER_WPS_MIN,
  TELEPROMPTER_WPS_STEP,
  fondoUrlDe,
} from "@/lib/types";
import { RESERVED_HOTKEYS } from "@/hooks/use-reader-hotkeys";
import type { BookPatch } from "@/hooks/use-book-milestones";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageMenu } from "@/components/library/LanguageMenu";
import { BookMarked, Check, Eye, EyeOff, Keyboard, LayoutPanelLeft, MonitorPlay, Moon, Palette, Sparkles, Target } from "lucide-react";

interface ConfigPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** libro abierto en el lector; habilita las secciones de hitos y meta individuales */
  book?: BookDTO | null;
  /** aplica cambios persistidos del libro (hitos y meta diaria individuales) */
  onPatchBook?: (patch: BookPatch) => void;
}

const POSITIONS: { value: RailPosition; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "bottom", label: "Bottom" },
  { value: "top", label: "Top" },
  { value: "right", label: "Right" },
];

const PRESETS: { value: FilterPreset; label: string }[] = [
  { value: "auto", label: "auto" },
  { value: "normal", label: "normal" },
  { value: "papel", label: "papel" },
  { value: "sepia", label: "sepia" },
  { value: "calido", label: "calido" },
  { value: "noche", label: "noche" },
];

/** Etiqueta humana de una tecla (" " → traducida, letras en mayúscula) */
function formatKey(k: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (k === " ") return t("config.keySpace");
  if (k.length === 1) return k.toUpperCase();
  return k.charAt(0).toUpperCase() + k.slice(1);
}

export function ConfigPanel({ open, onOpenChange, book, onPatchBook }: ConfigPanelProps) {
  const { t } = useI18n();
  const rail = useSettings((s) => s.rail);
  const setRail = useSettings((s) => s.setRail);
  const filters = useSettings((s) => s.filters);
  const setPreset = useSettings((s) => s.setPreset);
  const dailyGoal = useSettings((s) => s.reading.dailyGoal);
  const setReading = useSettings((s) => s.setReading);
  const immersion = useSettings((s) => s.immersion);
  const setImmersion = useSettings((s) => s.setImmersion);
  const tpSet = useSettings((s) => s.teleprompter);
  const setTeleprompter = useSettings((s) => s.setTeleprompter);
  const tpFontScale = clampTeleprompterFontScale(tpSet.fontScale);
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
      setTeleprompter({ fondo: "imagen", fondoRuta: data.ruta });
    } catch {
      setErrorFondo(t("config.tpBgErrorBody"));
    } finally {
      setSubiendoFondo(false);
    }
  };

  // Captura de la tecla de inmersión manual: la próxima tecla libre queda asignada
  const [capturing, setCapturing] = useState(false);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(false);
        setKeyHint(null);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return; // combinaciones: se ignora
      if (RESERVED_HOTKEYS.has(e.key.toLowerCase())) {
        setKeyHint(t("config.keyReserved", { key: formatKey(e.key, t) }));
        return;
      }
      setImmersion({ toggleKey: e.key.length === 1 ? e.key.toLowerCase() : e.key });
      setCapturing(false);
      setKeyHint(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, setImmersion, t]);

  const perBookActive = book?.milestones != null;
  const effectiveSegments = book?.milestones ?? rail.segments;
  const keyLabel = (k: string) => formatKey(k, t);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">{t("config.title")}</SheetTitle>
          <SheetDescription>
            {t("config.desc")}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-7 px-4 pb-10">
          {/* ---------- Apariencia ---------- */}
          <section aria-label={t("config.appearanceAria")}>
            <div className="mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">{t("config.appearance")}</h3>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("config.theme")}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {t("config.themeHint")}
                </p>
              </div>
              <ThemeToggle />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("config.language")}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {t("config.languageHint")}
                </p>
              </div>
              <LanguageMenu />
            </div>
          </section>

          {/* ---------- El riel ---------- */}
          <section aria-label={t("config.railAria")}>
            <div className="mb-3 flex items-center gap-2">
              <LayoutPanelLeft className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">{t("config.rail")}</h3>
            </div>

            <div className="grid gap-5">
              {/* --- Hitos individuales de este libro --- */}
              {book && onPatchBook && (
                <div className="grid gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="gap-1.5 text-sm">
                        <BookMarked className="h-3.5 w-3.5 text-primary" /> {t("config.bookMilestones")}
                      </Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("config.bookMilestonesHint")}
                      </p>
                    </div>
                    <Switch
                      checked={perBookActive}
                      onCheckedChange={(v) => onPatchBook({ milestones: v ? rail.segments : null })}
                      aria-label={t("config.bookMilestonesSwitch")}
                    />
                  </div>
                  {perBookActive ? (
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t("config.bookSegments", { title: book.title })}</span>
                        <span className="tabular-nums text-sm font-medium text-primary">{book.milestones}</span>
                      </div>
                      <Slider
                        value={[book.milestones ?? rail.segments]}
                        min={2}
                        max={40}
                        step={1}
                        onValueChange={([v]) => onPatchBook({ milestones: v })}
                        aria-label={t("config.bookMilestonesAria")}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("config.inheritHint", { n: rail.segments, title: book.title })}
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label>{t("config.position")}</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {POSITIONS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setRail({ position: p.value })}
                      className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                        rail.position === p.value
                          ? "border-primary bg-primary/15 text-primary-on-tint font-medium"
                          : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {t(`config.pos${p.label}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>{t("config.globalSegments")}</Label>
                  <span className="tabular-nums text-sm text-primary font-medium">{rail.segments}</span>
                </div>
                <Slider
                  value={[rail.segments]}
                  min={4}
                  max={24}
                  step={1}
                  onValueChange={([v]) => setRail({ segments: v })}
                  aria-label={t("config.segmentsAria")}
                />
                <p className="text-xs text-muted-foreground">
                  {perBookActive
                    ? t("config.segmentsHintBook")
                    : t("config.segmentsHint")}
                </p>
              </div>

              <div className="grid gap-2">
                <Label>{t("config.railColor")}</Label>
                <div className="flex gap-2">
                  {(Object.keys(RAIL_THEMES) as RailTheme[]).map((th) => (
                    <button
                      key={th}
                      title={t(`theme.${th}`)}
                      onClick={() => setRail({ theme: th })}
                      aria-label={t("config.colorAria", { label: t(`theme.${th}`) })}
                      className={`relative h-8 w-8 rounded-full ring-2 transition-all ${
                        rail.theme === th ? "ring-primary scale-110" : "ring-transparent hover:scale-105"
                      }`}
                      style={{ background: RAIL_THEMES[th].fill }}
                    >
                      {rail.theme === th && (
                        <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
                {rail.theme === "dynamic" && (
                  <p className="text-xs text-muted-foreground">
                    {t("config.dynamicHint")}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="labels-switch">{t("config.showNumbers")}</Label>
                  <p className="text-xs text-muted-foreground">{t("config.showNumbersHint")}</p>
                </div>
                <Switch
                  id="labels-switch"
                  checked={rail.showLabels}
                  onCheckedChange={(v) => setRail({ showLabels: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="celebrate-switch" className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> {t("config.celebrate")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("config.celebrateHint")}</p>
                </div>
                <Switch
                  id="celebrate-switch"
                  checked={rail.celebrate}
                  onCheckedChange={(v) => setRail({ celebrate: v })}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* ---------- Comodidad visual ---------- */}
          <section aria-label={t("config.comfortAria")}>
            <div className="mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">{t("config.comfort")}</h3>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label>{t("config.readMode")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPreset(p.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        filters.preset === p.value
                          ? "border-primary bg-primary/15 text-primary-on-tint font-medium"
                          : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {t(`config.filter.${p.label}`)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("config.filterHint")}
                </p>
              </div>

              {/* Modo inmersión: la UI se desvanece por inactividad del mouse */}
              <div className="grid gap-4 rounded-lg border border-border/50 bg-card/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label htmlFor="immersion-switch" className="gap-1.5">
                      <EyeOff className="h-3.5 w-3.5 text-primary" /> {t("config.immersion")}
                    </Label>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {t("config.immersionHint")}
                    </p>
                  </div>
                  <Switch
                    id="immersion-switch"
                    checked={immersion.enabled}
                    onCheckedChange={(v) => setImmersion({ enabled: v })}
                    data-testid="immersion-switch"
                  />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-key-button" className="text-xs gap-1.5">
                      <Keyboard className="h-3.5 w-3.5 text-primary" /> {t("config.toggleKey")}
                    </Label>
                    <Button
                      id="toggle-key-button"
                      variant={capturing ? "default" : "outline"}
                      size="sm"
                      className="h-7 min-w-16 tabular-nums"
                      onClick={() => {
                        setCapturing((v) => !v);
                        setKeyHint(null);
                      }}
                      data-testid="toggle-key-button"
                    >
                      {capturing ? t("config.pressKey") : keyLabel(immersion.toggleKey)}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {capturing
                      ? t("config.capturingHint")
                      : t("config.keyHintWorks")}
                  </p>
                  {keyHint && <p className="text-xs font-medium text-destructive">{keyHint}</p>}
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* ---------- Hábito ---------- */}
          <section aria-label={t("config.habitAria")}>
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">{t("config.habit")}</h3>
            </div>

            {/* --- Meta propia de este libro (espejo del control de hitos) --- */}
            <BookGoalCard book={book} globalGoal={dailyGoal} onPatchBook={onPatchBook} />

            <div className="grid gap-2">
              <Label htmlFor="goal-input">{t("config.dailyGoal")}</Label>
              <Input
                id="goal-input"
                type="number"
                min={1}
                max={500}
                value={dailyGoal}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v)) setReading({ dailyGoal: Math.min(500, Math.max(1, v)) });
                }}
                className="w-28"
              />
              <p className="text-xs text-muted-foreground">
                {t("config.dailyGoalHint")}
              </p>
            </div>
          </section>

          <Separator />

          {/* ---------- Teleprompter ---------- */}
          <section aria-label={t("config.teleprompterAria")}>
            <div className="mb-3 flex items-center gap-2">
              <MonitorPlay className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wide">{t("config.teleprompter")}</h3>
            </div>

            <div className="grid gap-5">
              {/* velocidad DIRECTA: sin presets, la dueña manda (24-10) */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>{t("config.tpSpeed")}</Label>
                  <span className="text-xs font-medium tabular-nums text-foreground">
                    {tpSet.instante
                      ? t("tp.instantLabel")
                      : t("tp.wpsLabel", { wps: String(tpSet.wps).replace(".", ",") })}
                  </span>
                </div>
                <Slider
                  min={TELEPROMPTER_WPS_MIN}
                  max={TELEPROMPTER_WPS_MAX}
                  step={TELEPROMPTER_WPS_STEP}
                  value={[clampTeleprompterWps(tpSet.wps)]}
                  onValueChange={([v]) => setTeleprompter({ wps: clampTeleprompterWps(v) })}
                  disabled={tpSet.instante}
                  aria-label={t("config.tpSpeed")}
                  data-testid="config-tp-wps"
                />
                <p className="text-xs text-muted-foreground">{t("config.tpSpeedHint")}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="tp-instant-switch">{t("config.tpInstant")}</Label>
                    <p className="text-xs text-muted-foreground">{t("config.tpInstantHint")}</p>
                  </div>
                  <Switch
                    id="tp-instant-switch"
                    checked={tpSet.instante}
                    onCheckedChange={(v) => setTeleprompter({ instante: v })}
                    data-testid="config-tp-instant"
                  />
                </div>
              </div>

              {/* tamaño de letra */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>{t("config.tpFont")}</Label>
                  <span className="text-xs font-medium tabular-nums text-foreground">
                    {Math.round(tpFontScale * 100)}%
                  </span>
                </div>
                <Slider
                  min={TELEPROMPTER_FONT_MIN}
                  max={TELEPROMPTER_FONT_MAX}
                  step={TELEPROMPTER_FONT_STEP}
                  value={[tpFontScale]}
                  onValueChange={([v]) => setTeleprompter({ fontScale: clampTeleprompterFontScale(v) })}
                  aria-label={t("config.tpFont")}
                  data-testid="config-tp-font"
                />
                <p className="text-xs text-muted-foreground">{t("config.tpFontHint")}</p>
              </div>

              {/* sonido y auto */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="tp-sound-switch">{t("config.tpSound")}</Label>
                  <p className="text-xs text-muted-foreground">{t("config.tpSoundHint")}</p>
                </div>
                <Switch
                  id="tp-sound-switch"
                  checked={tpSet.sound}
                  onCheckedChange={(v) => setTeleprompter({ sound: v })}
                  data-testid="config-tp-sound"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="tp-auto-switch">{t("config.tpAuto")}</Label>
                  <p className="text-xs text-muted-foreground">{t("config.tpAutoHint")}</p>
                </div>
                <Switch
                  id="tp-auto-switch"
                  checked={tpSet.auto}
                  onCheckedChange={(v) => setTeleprompter({ auto: v })}
                  data-testid="config-tp-auto"
                />
              </div>

              {/* tarjetas por frase: leer en voz alto sin párrafos enteros */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="tp-cards-switch">{t("config.tpCards")}</Label>
                  <p className="text-xs text-muted-foreground">{t("config.tpCardsHint")}</p>
                </div>
                <Switch
                  id="tp-cards-switch"
                  checked={tpSet.tarjetasPorFrase}
                  onCheckedChange={(v) => setTeleprompter({ tarjetasPorFrase: v })}
                  data-testid="config-tp-cards"
                />
              </div>

              {/* fondo: tema, portada o imagen propia — siempre filtrada */}
              <div className="grid gap-2">
                <Label>{t("config.tpBg")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(["tema", "portada", "imagen"] as const).map((modo) => (
                    <button
                      key={modo}
                      onClick={() => setTeleprompter({ fondo: modo })}
                      data-testid={`config-tp-bg-${modo}`}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        tpSet.fondo === modo
                          ? "border-primary bg-primary/15 font-medium text-primary-on-tint"
                          : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {t(`config.tpBg${modo[0].toUpperCase()}${modo.slice(1)}`)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t("config.tpBgHint")}</p>
                {tpSet.fondo === "portada" && !book?.coverPath && (
                  <p className="text-xs text-muted-foreground">{t("config.tpBgNoCover")}</p>
                )}
                {tpSet.fondo === "imagen" && (
                  <div className="grid gap-2">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => fondoInputRef.current?.click()}
                        data-testid="config-tp-bg-upload"
                      >
                        {t("config.tpBgUpload")}
                      </Button>
                      <input
                        ref={fondoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/avif"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void subirFondo(f);
                          e.target.value = "";
                        }}
                      />
                      {tpSet.fondoRuta && (
                        <img
                          src={fondoUrlDe(tpSet.fondoRuta)}
                          alt=""
                          className="h-10 w-16 rounded border border-border object-cover"
                        />
                      )}
                    </div>
                    {subiendoFondo && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}
                    {errorFondo && <p className="text-xs font-medium text-destructive">{errorFondo}</p>}
                  </div>
                )}
                {tpSet.fondo !== "tema" && (
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label>{t("config.tpBgFilter")}</Label>
                      <span className="text-xs font-medium tabular-nums text-foreground">
                        {tpSet.fondoFiltro}%
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[tpSet.fondoFiltro]}
                      onValueChange={([v]) => setTeleprompter({ fondoFiltro: v })}
                      aria-label={t("config.tpBgFilter")}
                      data-testid="config-tp-bg-filter"
                    />
                    <p className="text-xs text-muted-foreground">{t("config.tpBgFilterHint")}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Meta diaria propia de ESTE libro (sección Hábito), espejo del control de
 * hitos: switch para fijar/retirar y su input propio. null = hereda el mínimo
 * global; al activar el switch parte del valor global.
 */
function BookGoalCard({
  book,
  globalGoal,
  onPatchBook,
}: {
  book?: BookDTO | null;
  globalGoal: number;
  onPatchBook?: ((patch: BookPatch) => void) | null;
}) {
  const { t } = useI18n();
  // Borrador null = no editando: el valor mostrado se deriva del libro en render
  // (sin setState en efectos). Mientras se teclea, el borrador manda; al salir
  // del input vuelve a reflejar el valor confirmado (optimista + BD).
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  if (!book || !onPatchBook) return null; // la tarjeta solo vive con libro abierto
  const perBookActive = book.dailyGoal != null;
  const goalShown = goalDraft ?? (book.dailyGoal != null ? String(book.dailyGoal) : "");

  return (
    <div className="mb-5 grid gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="gap-1.5 text-sm">
            <BookMarked className="h-3.5 w-3.5 text-primary" /> {t("config.bookGoal")}
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("config.bookGoalHint")}
          </p>
        </div>
        <Switch
          checked={perBookActive}
          onCheckedChange={(v) => onPatchBook({ dailyGoal: v ? globalGoal : null })}
          aria-label={t("config.bookGoalSwitch")}
          data-testid="book-goal-switch"
        />
      </div>
      {perBookActive ? (
        <div className="grid gap-2">
          <Label htmlFor="book-goal-input" className="text-xs text-muted-foreground">
            {t("config.bookGoalFor", { title: book.title })}
          </Label>
          <Input
            id="book-goal-input"
            type="number"
            min={1}
            max={500}
            value={goalShown}
            onChange={(e) => {
              setGoalDraft(e.target.value);
              const v = parseInt(e.target.value, 10);
              if (Number.isFinite(v) && v >= 1) {
                onPatchBook({ dailyGoal: Math.min(500, Math.max(1, v)) });
              }
            }}
            onBlur={() => setGoalDraft(null)}
            className="w-28"
            data-testid="book-goal-input"
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("config.goalInheritHint", { n: globalGoal, title: book.title })}
        </p>
      )}
    </div>
  );
}
