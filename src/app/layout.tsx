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
  title: "Atena — Termina tus libros",
  description:
    "La lectora de la diosa de la estrategia: riel de progreso, hitos celebrados, modo cinematográfico letra a letra, tres idiomas y una lectura que se siente juego.",
  keywords: ["Atena", "lectura", "libros", "PDF", "EPUB", "modo cinematográfico", "hábito", "progreso"],
  icons: {
    icon: "/atena-seal.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#131b28" },
    { media: "(prefers-color-scheme: light)", color: "#eceff5" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${literata.variable} ${ebGaramond.variable} ${atkinson.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {/* ---- Capa 2: fondo secundario estático (Atenas brutalista) ----
              Va ENCIMA del fondo base y DEBAJO de todo el contenido. Sin
              animación, sin transición: piedra tallada, no fuegos artificiales.
              En claro se desvanece a recuerdo pálido. */}
          <div className="atena-capa2" aria-hidden="true">
            <div className="atena-capa2__fachada" />
            <div className="atena-capa2__busto" />
            <div className="atena-capa2__vignette" />
          </div>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
