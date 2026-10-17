"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BADGE_TIERS } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import type { BookWithSessions } from "@/hooks/use-library-books";
import { Loader2 } from "lucide-react";

interface LibraryConfirmDialogsProps {
  deleteTarget: BookWithSessions | null;
  onClearDelete: () => void;
  onConfirmDelete: () => void;
  resetTarget: BookWithSessions | null;
  onClearReset: () => void;
  onConfirmReset: () => void;
  resettingOne: boolean;
  resetAllOpen: boolean;
  onResetAllOpenChange: (open: boolean) => void;
  onConfirmResetAll: () => void;
  resettingAll: boolean;
}

/** Confirmaciones destructivas: borrar libro, reiniciar sus lecturas y reiniciar todo */
export function LibraryConfirmDialogs({
  deleteTarget,
  onClearDelete,
  onConfirmDelete,
  resetTarget,
  onClearReset,
  onConfirmReset,
  resettingOne,
  resetAllOpen,
  onResetAllOpenChange,
  onConfirmResetAll,
  resettingAll,
}: LibraryConfirmDialogsProps) {
  const { t } = useI18n();
  const badgeSuffix = (b: BookWithSessions["badge"]) =>
    b
      ? t("confirm.badgeSuffix", {
          tier: t(`badge.${BADGE_TIERS[b.tier]?.key ?? "bronce"}`),
          n: b.readings,
        })
      : "";
  return (
    <>
      {/* ---- Confirmación de borrado ---- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && onClearDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm.deleteTitle", { title: deleteTarget?.title ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.deleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirm.keep")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={onConfirmDelete}>
              {t("confirm.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Confirmación de reinicio por libro ---- */}
      <AlertDialog open={!!resetTarget} onOpenChange={(open) => !open && onClearReset()}>
        <AlertDialogContent data-testid="reset-book-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm.resetTitle", { title: resetTarget?.title ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1.5">
                <p>{t("confirm.willDelete")}</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li>
                    {t("confirm.current", { cur: resetTarget?.currentPage ?? 0, total: resetTarget?.totalPages ?? 0 })}
                  </li>
                  <li>{t("confirm.history")}</li>
                  <li>
                    {resetTarget?.badge
                      ? t("confirm.badgeItem", { badge: badgeSuffix(resetTarget.badge) })
                      : t("confirm.badgeItemPlain")}
                  </li>
                </ul>
                <p className="pt-1 text-xs">
                  {t("confirm.keeps")}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirm.keepProgress")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={onConfirmReset}
              disabled={resettingOne}
              data-testid="reset-book-confirm"
            >
              {resettingOne ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("confirm.resetReadings")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Confirmación de reinicio total ---- */}
      <AlertDialog open={resetAllOpen} onOpenChange={onResetAllOpenChange}>
        <AlertDialogContent data-testid="reset-all-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm.resetAllTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1.5">
                <p>{t("confirm.allWillDelete")}</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li>{t("confirm.allCurrent")}</li>
                  <li>{t("confirm.allHistory")}</li>
                  <li>{t("confirm.allBadges")}</li>
                </ul>
                <p className="pt-1 text-xs">
                  {t("confirm.allKeeps")}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirm.keepAll")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={onConfirmResetAll}
              disabled={resettingAll}
              data-testid="reset-all-confirm"
            >
              {resettingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("confirm.resetAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
