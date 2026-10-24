"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Casa Athena: dos caras del azul del focus.
 * Oscuro por defecto (noche egea); el usuario cambia a claro desde la
 * biblioteca o el panel de ajustes. Estrategia `class` para que las
 * variantes `dark:` de Tailwind y los tokens de globals.css respondan.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
