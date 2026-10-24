"use client";

import { useEffect, useState } from "react";
import { BookCheck, ChevronsRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TELEPROMPTER_PAGE_TURN_MS } from "@/lib/teleprompter";

/** Letras antes del fin de la página a partir de las cuales el Auto avisa del cambio (≈2 s) */
const PAGE_SOON_CHARS = 48;
/** Cuánto permanece el aviso de llegada (ms): coincide con la animación `tp-notice-flash` */
const ARRIVAL_MS = 2600;

interface Props {
  auto: boolean;
  playing: boolean;
  pageDone: boolean;
  /** la ventana tiene página siguiente cargada */
  hasNext: boolean;
  /** página de inicio de la ventana (null mientras no hay ventana) */
  start: number | null;
  lit: number;
  firstLen: number;
  todayPages: number;
  todayGoal: number;
}

/**
 * Aviso del Auto al cambiar de página: «Pasando a la página N…» al acercarse
 * al final (incluida la pausa de un título) y «Página N · hoy a/b» al llegar,
 * con la meta del día. Visible aunque la barra superior esté auto-oculta.
 */
export function TeleprompterPageNotice(p: Props) {
  const { t } = useI18n();
  const [arrival, setArrival] = useState<number | null>(null);
  const [seenStart, setSeenStart] = useState<number | null>(p.start);

  // «Ajustar estado durante el render»: la llegada se marca en el mismo render
  // en que la ventana cambia de página (solo en Auto; no al abrir).
  if (p.start !== seenStart) {
    setSeenStart(p.start);
    if (p.auto && seenStart != null && p.start != null) setArrival(p.start);
  }

  useEffect(() => {
    if (arrival == null) return;
    const id = window.setTimeout(() => setArrival(null), ARRIVAL_MS);
    return () => window.clearTimeout(id);
  }, [arrival]);

  // con `pageDone` (revelado instantáneo) el Auto también cruzará solo
  const soon = p.auto && p.playing && p.hasNext && p.start != null && p.lit > 0 && p.firstLen - p.lit <= PAGE_SOON_CHARS;
  // la página ya está encendida: es la pausa de 2 s antes del cruce
  const waiting = p.hasNext && p.lit >= p.firstLen;
  const goalReached = p.todayGoal > 0 && p.todayPages >= p.todayGoal;

  let kind: "soon" | "arrived";
  let key: string;
  let text: string;
  if (soon && p.start != null) {
    kind = "soon";
    key = `s${p.start}`;
    text = t("tp.pageSoon", { n: p.start + 1 });
  } else if (arrival != null) {
    kind = "arrived";
    key = `a${arrival}`;
    text = t(goalReached ? "tp.pageGoalDone" : "tp.pageArrived", { n: arrival, today: p.todayPages, goal: p.todayGoal });
  } else {
    return null;
  }

  return (
    <div
      key={key}
      role="status"
      aria-live="polite"
      className={cn("tp-notice", kind === "soon" ? "tp-notice-soon" : "tp-notice-flash")}
      data-testid="tp-page-notice"
      data-kind={kind}
    >
      {kind === "soon" ? (
        <ChevronsRight className="h-4 w-4" aria-hidden="true" />
      ) : (
        <BookCheck className="h-4 w-4" aria-hidden="true" />
      )}
      <span>{text}</span>
      {kind === "soon" && waiting && (
        <span
          className="tp-notice-bar"
          aria-hidden="true"
          data-testid="tp-page-notice-bar"
          style={{ animationDuration: `${TELEPROMPTER_PAGE_TURN_MS}ms` }}
        />
      )}
    </div>
  );
}
