"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Plus, Trash2, UserRound } from "lucide-react";
import { ModePanelProps, uid } from "@/components/modes/panel-props";
import { useI18n } from "@/lib/i18n";
import type { XrayCard } from "@/lib/types";

/**
 * Fichas que siguen tu punto de lectura (X-Ray local): quién aparece hasta donde
 * llegaste, con notas futuras veladas para no arruinar nada de lo que viene.
 */
export function XrayPanel({ extras, onPatch, goToPage, pageNum }: ModePanelProps) {
  const { t } = useI18n();
  const cards = extras.xray ?? [];
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const add = () => {
    if (!name.trim()) return;
    const card: XrayCard = {
      id: uid("x"),
      name: name.trim().slice(0, 80),
      aliases: aliases.trim().slice(0, 120),
      note: note.trim().slice(0, 400),
      unlockPage: pageNum,
    };
    onPatch({ xray: [...cards, card] });
    setName("");
    setAliases("");
    setNote("");
  };

  const remove = (id: string) => onPatch({ xray: cards.filter((c) => c.id !== id) });

  const sorted = [...cards].sort((a, b) => a.unlockPage - b.unlockPage);
  const visible = sorted.filter((c) => c.unlockPage <= pageNum);
  const upcoming = sorted.filter((c) => c.unlockPage > pageNum);

  return (
    <div className="grid gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("xray.hint")}
      </p>

      {!open ? (
        <Button variant="outline" size="sm" className="h-7 w-fit gap-1 text-xs" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> {t("xray.addCard")}
        </Button>
      ) : (
        <form
          className="grid gap-2 rounded-lg border border-border/50 bg-card/40 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
            setOpen(false);
          }}
          data-testid="xray-form"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("xray.namePh")} className="h-8 text-xs" aria-label={t("xray.nameAria")} />
          <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder={t("xray.aliasPh")} className="h-8 text-xs" aria-label={t("xray.aliasAria")} />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("xray.notePh")} className="h-8 text-xs" aria-label={t("xray.noteAria")} />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{t("xray.appearsFrom", { n: pageNum })}</span>
            <div className="flex gap-1.5">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="sm" className="h-7 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> {t("common.add")}
              </Button>
            </div>
          </div>
        </form>
      )}

      {cards.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground" data-testid="xray-empty">
          {t("xray.empty")}
        </p>
      ) : (
        <div className="grid gap-2">
          {visible.map((c) => (
            <div key={c.id} className="group grid gap-1 rounded-lg border border-border/40 bg-card/30 p-3" data-testid="xray-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserRound className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-sm font-medium leading-tight">{c.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => goToPage(c.unlockPage)}
                    className="rounded-md border border-border/50 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    title={t("xray.goFirst", { n: c.unlockPage })}
                  >
                    {t("common.pgN", { n: c.unlockPage })}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                    onClick={() => remove(c.id)}
                    aria-label={t("xray.deleteCard", { name: c.name })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {c.aliases && <p className="pl-5.5 text-[11px] italic text-muted-foreground">{c.aliases}</p>}
              {c.note && <p className="pl-5.5 text-xs leading-snug text-foreground/90">{c.note}</p>}
            </div>
          ))}

          {upcoming.map((c) => {
            const isRevealed = revealed[c.id];
            return (
              <div key={c.id} className="grid gap-1 rounded-lg border border-dashed border-border/40 bg-card/10 p-3" data-testid="xray-card-locked">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="text-sm font-medium leading-tight text-muted-foreground">{c.name}</span>
                  </div>
                  <button
                    onClick={() => setRevealed((r) => ({ ...r, [c.id]: !r[c.id] }))}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    title={isRevealed ? t("lock.veil") : t("lock.look")}
                    aria-label={isRevealed ? t("lock.veilAria") : t("lock.lookAria")}
                  >
                    {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {t("common.pgN", { n: c.unlockPage })}
                  </button>
                </div>
                {c.aliases && <p className="pl-5.5 text-[11px] italic text-muted-foreground/70">{c.aliases}</p>}
                {c.note &&
                  (isRevealed ? (
                    <p className="spoiler-reveal pl-5.5 text-xs leading-snug text-foreground/90">{c.note}</p>
                  ) : (
                    <p className="spoiler-blur pl-5.5 text-xs leading-snug" aria-hidden>
                      {c.note}
                    </p>
                  ))}
                {!isRevealed && (
                  <p className="pl-5.5 text-[10px] text-muted-foreground/60">
                    {t("xray.lockedNote", { n: c.unlockPage })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
