/**
 * Entrada de la app (index.html) — antes src/app/page.tsx + layout.tsx.
 * La fuente única de ajustes se hidrata desde db/config.json vía /api/settings
 * y la biblioteca/lector viven en el mismo árbol de estado.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";

// Fuentes auto-alojadas (@fontsource): sin red en el build, sin parpadeo.
// Las familias quedan expuestas como variables CSS en globals.css (:root),
// igual que las declaraba next/font/google.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
// full.css: todas las variable axes (opsz, SOFT, WONK) como pedía next/font
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/literata";
import "@fontsource-variable/literata/wght-italic.css";
import "@fontsource-variable/eb-garamond";
import "@fontsource-variable/eb-garamond/wght-italic.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/atkinson-hyperlegible/400-italic.css";
import "@fontsource/atkinson-hyperlegible/700-italic.css";

import { AppShell } from "@/AppShell";
import { Home } from "@/Home";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell>
      <Home />
    </AppShell>
  </StrictMode>
);
