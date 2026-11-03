# Proposal: teleprompter-solo-continuo

## Why

El change `teleprompter-flujo-continuo` dejó ambas conductas conviviendo tras
el interruptor «Lectura continua» (default true). La dueña probó el continuo y
decidió que sea el ÚNICO camino: el cruce de página virtual no es un evento y
no hace falta opción que lo convierta de nuevo en uno. El modo clásico (pausa
de 2 s con aviso flotante + fundido de columna de 450 ms) es código muerto
disfrazado de ajuste, y el fundido en particular no aporta nada en lectura a
ritmo constante: solo un parpadeo que rompe la fijación (su única utilidad era
maquillar el intercambio de ventana, que el ancla atómica ya hace invisible).

## What Changes

- **Se retira el ajuste `flujoContinuo`** (persist v15 → v16, saneo de
  `db/config.json` y `_doc`): el cruce continuo pasa a ser EL comportamiento,
  sin interruptor en la sheet in-mode ni en el panel de configuración.
- Se retira el modo clásico del cruce: la pausa de giro
  (`TELEPROMPTER_PAGE_TURN_MS` en `plannedStepDelay`), el aviso de página
  (`TeleprompterPageNotice`, componente eliminado con sus claves i18n) y el
  fundido de columna (`animarGiroPagina` en el overlay, ambos sentidos).
- `plannedStepDelay` desaparece: la espera del paso es la del propio carácter
  (puntuación, tarjetas de imagen) — el cruce no paga espera extra.
- La única espera conservada al agotar la página es la del revelado
  INSTANTÁNEO con Auto (pageDone): ahí no hay ritmo de letras que proteger y
  el compás de quietud sigue siendo honesto.
- `db/config.json` de instalaciones viejas: el campo `flujoContinuo` se
  descarta al sanear (no rompe, no vuelve a escribirse).

## Impact

- Affected specs: `teleprompter` (reescribe «Encadenado de páginas»: el cruce
  va SIEMPRE a ritmo normal, sin aviso ni animación, en ambos sentidos).
- Affected code: `src/lib/types.ts`, `src/lib/settings.ts` (v16),
  `src/lib/config-file.ts`, `src/lib/step-timer.ts`,
  `src/hooks/use-teleprompter-player.ts`,
  `src/components/reader/TeleprompterOverlay.tsx`,
  `src/components/reader/TeleprompterSettingsSheet.tsx`,
  `src/components/reader/ConfigPanel.tsx`, i18n es/en/pt.
- Removed: `src/components/reader/TeleprompterPageNotice.tsx`.
- Tests: `settings` (v15 → v16 sin pérdida, ajuste jubilado no persiste),
  `config-file` (saneo con descansoMin), `teleprompter` (step-timer sin
  pausa de giro).
- Resuelve la tarea pendiente 4.4 del change `teleprompter-flujo-continuo`.
