import type { Metadata, Viewport } from "next";
import {
  Atkinson_Hyperlegible,
  EB_Garamond,
  Fraunces,
  Geist,
  Geist_Mono,
  Literata,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

// Fuentes curadas de lectura (la elección del lector vive en el store y manda
// por --reader-font); la UI conserva Fraunces.
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Athena — Termina tus libros",
  description:
    "La lectora de la diosa de la estrategia: riel de progreso, hitos celebrados, modo cinematográfico letra a letra, tres idiomas y una lectura que se siente juego.",
  keywords: ["Athena", "lectura", "libros", "PDF", "EPUB", "modo cinematográfico", "hábito", "progreso"],
  icons: {
    icon: "/athena-seal.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#211d16" },
    { media: "(prefers-color-scheme: light)", color: "#f1eee6" },
  ],
  width: "device-width",
  initialScale: 1,
  // viewportFit cover: las env(safe-area-inset-*) del teleprompter (notch,
  // barra gestual del Android) dan padding real donde el sistema lo pide.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ---- Modo APK (build estática, ATHENA_STATIC=1) -------------------------
  // El flag se inyecta ANTES de cualquier bundle: window.__ATHENA_APK__ activa
  // el motor offline (public/athena-offline.js), que intercepta fetch/XHR de
  // /api/* y responde todo localmente (IndexedDB + OPFS). En self-host el
  // bloque no existe: el archivo ni se carga.
  const esApk = process.env.NEXT_PUBLIC_ATHENA_APK === "1";
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {esApk && (
          <>
            <script dangerouslySetInnerHTML={{ __html: "window.__ATHENA_APK__=true;" }} />
            {/* Síncrono a propósito: el motor debe estar instalado antes del
                primer bundle de React (cualquier fetch de arranque va local). */}
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script src="/athena-offline.js" />
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${literata.variable} ${ebGaramond.variable} ${atkinson.variable} antialiased bg-background text-foreground`}
      >
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
      </body>
    </html>
  );
}
