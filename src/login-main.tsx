/**
 * Entrada de la puerta del candado (login.html) — antes src/app/login/page.tsx.
 * El destino `next` se valida con la MISMA función pura que usaba la página
 * de servidor (core/destino.ts): un destino malicioso jamás llega al fetch.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/literata";
import "@fontsource-variable/eb-garamond";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";

import { AppShell } from "@/AppShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { siguienteSeguro } from "@/core/destino";

const destino = siguienteSeguro(new URLSearchParams(window.location.search).get("next")) ?? "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell>
      <LoginForm destino={destino} />
    </AppShell>
  </StrictMode>
);
