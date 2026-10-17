"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Languages } from "lucide-react";
import { useI18n, LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Selector de idioma de la casa: español, inglés o portugués.
 * El nombre de cada lengua se escribe siempre en sí misma (es una lista de
 * nombres propios, no frases de UI). Persistido en ajustes (riel-settings-v1).
 */
export function LanguageMenu({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const current = LANGUAGES.find((l) => l.id === lang) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={cn("gap-1.5 text-muted-foreground hover:text-foreground", compact ? "h-10 w-10" : "h-8 text-xs")}
          aria-label={t("config.language")}
          title={t("config.language")}
          data-testid="language-menu"
        >
          <Languages className={compact ? "h-4.5 w-4.5" : "h-4 w-4"} />
          {!compact && <span className="tabular-nums">{current.short}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" data-testid="language-options">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
