"use client";

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
import { Check, Languages, MoreHorizontal, RotateCcw, Sun } from "lucide-react";
import { LANGUAGES, useI18n } from "@/lib/i18n";

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

  return (
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
  );
}
