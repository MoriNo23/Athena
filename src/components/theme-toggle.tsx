"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

/** true solo tras la hidratación (snapshot de servidor: false) — sin setState en efectos */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Interruptor noche/máñana: alterna el azul oscuro del focus con el azul
 * claro de la sala de lectura. Neobrutalista: cuadrado, con tinta.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  // Durante SSR e hidratación resolves a oscuro (el default de la casa):
  // así el markup del primer render coincide y no hay mismatch de hidratación
  // (next-themes aplica el tema guardado ANTES de hidratar).
  const isDark = !mounted || resolvedTheme !== "light";
  const label = isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro";

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("h-10 w-10", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4.5 w-4.5" />
        ) : (
          <Moon className="h-4.5 w-4.5" />
        )
      ) : (
        // neutro pre-hidratación: nunca adivinamos el tema en el servidor
        <span className="h-4.5 w-4.5" aria-hidden />
      )}
    </Button>
  );
}
