/**
 * Cascarón de toda página (antes src/app/layout.tsx): tema de la casa,
 * fondo secundario (Atenas brutalista) y el toaster de avisos.
 */
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {/* ---- Capa 2: fondo secundario estático (Atenas brutalista) ----
          Va ENCIMA del fondo base y DEBAJO de todo el contenido. Sin
          animación, sin transición: piedra tallada, no fuegos artificiales.
          En claro se desvanece a recuerdo pálido. */}
      <div className="athena-capa2" aria-hidden="true">
        <div className="athena-capa2__fachada" />
        <div className="athena-capa2__busto" />
        <div className="athena-capa2__vignette" />
      </div>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
