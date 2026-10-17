"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { ModePanelProps, uid } from "@/components/modes/panel-props";
import { useI18n } from "@/lib/i18n";
import type { LockedNote } from "@/lib/types";

/**
 * Notas con candado de spoilers: escribe notas etiquetadas con la página a partir
 * de la cual se desbloquean; mientras tanto aparecen veladas (borrosas).
 */
export function LockedNotesPanel({ extras, onPatch, pageNum }: ModePanelProps) {
  const { t } = useI18n();
  const notes = extras.lockedNotes ?? [];
  const [text, setText] = useState("");
  const [unlockPage, setUnlockPage] = useState<string>("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const add = () => {
    if (!text.trim()) return;
    const parsed = parseInt(unlockPage, 10);
    const note: LockedNote = {
      id: uid("n"),
      text: text.trim().slice(0, 500),
      unlockPage: Number.isFinite(parsed) ? Math.max(1, parsed) : pageNum + 10,
      createdAt: new Date().toISOString(),
    };
    onPatch({ lockedNotes: [...notes, note] });
    setText("");
    setUnlockPage("");
  };

  const remove = (id: string) => onPatch({ lockedNotes: notes.filter((n) => n.id !== id) });

  const sorted = [...notes].sort((a, b) => a.unlockPage - b.unlockPage);
  const unlocked = sorted.filter((n) => n.unlockPage <= pageNum);
  const locked = sorted.filter((n) => n.unlockPage > pageNum);

  return (
    <div className="grid gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("notes.hint")}
      </p>

      <form
        className="grid gap-2 rounded-lg border border-border/50 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        data-testid="locked-notes-form"
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={t("notes.textPh")}
          className="text-xs"
          aria-label={t("notes.textAria")}
        />
        <div className="flex items-center gap-2">
          <Input
            value={unlockPage}
            onChange={(e) => setUnlockPage(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder={t("notes.unlockPh", { n: pageNum + 10 })}
            className="h-8 flex-1 text-xs"
            aria-label={t("notes.unlockAria")}
            inputMode="numeric"
          />
          <Button type="submit" size="sm" className="h-8 shrink-0 gap-1 text-xs" disabled={!text.trim()}>
            <Plus className="h-3.5 w-3.5" /> {t("common.add")}
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground" data-testid="locked-notes-empty">
          {t("notes.empty")}
        </p>
      ) : (
        <ul className="grid gap-2">
          {unlocked.map((n) => (
            <li key={n.id} className="group grid gap-1 rounded-lg border border-border/40 bg-card/30 p-3" data-testid="locked-note-open">
              <p className="text-xs leading-snug text-foreground/90">{n.text}</p>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                <span>{t("notes.unlockedAt", { n: n.unlockPage })}</span>
                <button
                  onClick={() => remove(n.id)}
                  className="text-muted-foreground/50 transition-colors hover:text-destructive"
                  aria-label={t("notes.deleteAria")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
          {locked.map((n) => {
            const isRevealed = revealed[n.id];
            return (
              <li key={n.id} className="grid gap-1 rounded-lg border border-dashed border-border/40 bg-card/10 p-3" data-testid="locked-note-locked">
                {isRevealed ? (
                  <p className="spoiler-reveal text-xs leading-snug text-foreground/90">{n.text}</p>
                ) : (
                  <p className="spoiler-blur text-xs leading-snug" aria-hidden>
                    {n.text}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/60">{t("notes.lockedAt", { n: n.unlockPage })}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setRevealed((r) => ({ ...r, [n.id]: !r[n.id] }))}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      title={isRevealed ? t("lock.veil") : t("lock.look")}
                      aria-label={isRevealed ? t("lock.veilAria") : t("lock.lookAria")}
                    >
                      {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => remove(n.id)}
                      className="text-muted-foreground/50 transition-colors hover:text-destructive"
                      aria-label={t("notes.deleteAria")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
