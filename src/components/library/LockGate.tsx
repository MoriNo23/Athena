"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

/**
 * Puerta de contraseña cuando el API está bloqueado por ATENA_PASSWORD
 * (change auth-api): envía el login y re-fetchea la biblioteca al desbloquear.
 */
export function LockGate({ onUnlocked }: { onUnlocked: () => void }) {
  const { t } = useI18n();
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
        onUnlocked();
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
    <div className="brutal-flat bg-card/40 px-6 py-14 text-center animate-fade-up">
      <h2 className="font-display text-2xl font-medium">{t("lib.lockTitle")}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{t("lib.lockBody")}</p>
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
  );
}
