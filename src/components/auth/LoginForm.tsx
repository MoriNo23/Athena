"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

/**
 * Formulario de la puerta real /login (era LockGate del change auth-api):
 * envía el login y avanza al destino validado (prop del servidor).
 */
export function LoginForm({ destino }: { destino: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const entrar = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(destino);
        return;
      }
      setError(t(res.status === 429 ? "lib.lockRateLimit" : "lib.lockError"));
    } catch {
      setError(t("lib.lockError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="h-dvh grid place-items-center px-6">
      <div className="brutal-flat bg-card/40 px-6 py-14 text-center animate-fade-up w-full max-w-md">
        <p className="font-display text-3xl font-medium tracking-tight">Athena</p>
        <h2 className="font-display text-2xl font-medium mt-4">{t("lib.lockTitle")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t("lib.lockBody")}
        </p>
        <form
          className="mx-auto mt-5 flex max-w-sm items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) entrar();
          }}
        >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("lib.lockPlaceholder")}
            autoFocus
          />
          <Button type="submit" disabled={loading || !password}>
            {t("lib.lockButton")}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
