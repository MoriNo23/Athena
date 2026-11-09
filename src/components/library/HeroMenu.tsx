"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Keyboard, Languages, MoreHorizontal, RotateCcw, Sun } from "lucide-react";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { SyncDialog } from "@/components/library/SyncDialog";
import { ShortcutsSheet } from "@/components/reader/ShortcutsSheet";

const emptySubscribe = () => () => {};

/** true solo tras la hidratación (snapshot de servidor: false) — sin setState en efectos */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/** Menú «⋯» del hero de la biblioteca: idioma y tema («Noche o mañana»)
    con su estado a la vista, y «Reiniciar todo el progreso» fuera de la cara
    del hero — el único botón destructivo del cuidado nunca debió vivir a
    24px de «Añadir libro» (crítica, observaciones menores). */
export function HeroMenu({ onResetAll }: { onResetAll: () => void }) {
  const { lang, setLang, t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = !mounted || resolvedTheme !== "light";
  const [syncOpen, setSyncOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // la copia de la casa solo existe en la build del APK (motor offline instalado)
  const esApk =
    mounted &&
    typeof window !== "undefined" &&
    !!(window as unknown as { __ATHENA_APK__?: boolean }).__ATHENA_APK__ &&
    !!(window as unknown as { __athenaOffline?: { sync?: unknown } }).__athenaOffline?.sync;

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-foreground"
          aria-label={t("lib.moreAria")}
          title={t("lib.moreAria")}
          data-testid="library-more"
        >
          <MoreHorizontal className="h-4.5 w-4.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* Idioma de la casa: cada lengua se nombra en sí misma */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2" data-testid="language-menu">
            <Languages className="h-4 w-4" />
            {t("config.language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44" data-testid="language-options">
            {LANGUAGES.map((l) => (
              <DropdownMenuItem
                key={l.id}
                onClick={() => setLang(l.id)}
                className="gap-2"
                data-testid={`language-${l.id}`}
              >
                <span className="flex-1">{l.label}</span>
                {l.id === lang && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Tema: el azul del focus, noche egea o mañana de mármol */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2" data-testid="theme-menu">
            <Sun className="h-4 w-4" />
            {t("config.theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuItem
              onClick={() => setTheme("dark")}
              className="gap-2"
              data-testid="theme-night"
            >
              <span className="flex-1">{t("lib.themeNight")}</span>
              {isDark && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("light")}
              className="gap-2"
              data-testid="theme-morning"
            >
              <span className="flex-1">{t("lib.themeMorning")}</span>
              {mounted && !isDark && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Copia de la casa: solo en la app, siempre a mano (Enmienda 1) */}
        {esApk && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSyncOpen(true)} data-testid="sync-open">
              <span className="flex-1">{t("copia.menu")}</span>
            </DropdownMenuItem>
          </>
        )}

        {/* Teclas de acceso: consultables en cualquier plataforma */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShortcutsOpen(true)} className="gap-2" data-testid="shortcuts-open">
          <Keyboard className="h-4 w-4" />
          {t("shortcuts.title")}
        </DropdownMenuItem>

        {/* Destructivo de baja frecuencia: un paso aparte, con su confirmación */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onResetAll}
          className="gap-2 text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
          data-testid="reset-all"
        >
          <RotateCcw className="h-4 w-4" />
          {t("lib.resetAll")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    {/* La copia de la casa (solo APK) y el apartado de teclas de acceso */}
    <SyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
    <ShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}