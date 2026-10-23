"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { READING_FONTS, type ReadingFont } from "@/lib/types";
import { Check, Type } from "lucide-react";

interface ReaderFontPickerProps {
  font: ReadingFont;
  onChange: (font: ReadingFont) => void;
}

/** Fuente del texto reflowable: Literata (recomendada), EB Garamond y
 *  Atkinson Hyperlegible — cada opción se muestra en su propia letra. */
export function ReaderFontPicker({ font, onChange }: ReaderFontPickerProps) {
  const { t } = useI18n();
  const current = READING_FONTS.find((f) => f.id === font) ?? READING_FONTS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="tap-44 h-8 gap-1.5 px-2 text-xs"
          title={t("reader.fontTip", { name: current.label })}
          aria-label={t("reader.fontAria")}
          data-testid="reader-font-picker"
        >
          <Type className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-48">
        {READING_FONTS.map((f) => (
          <DropdownMenuItem
            key={f.id}
            onClick={() => onChange(f.id)}
            className="gap-2 py-2"
            data-testid={`reader-font-${f.id}`}
          >
            <span className="flex-1 text-sm" style={{ fontFamily: `var(${f.cssVar})` }}>
              {f.label}
            </span>
            {f.id === font && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
