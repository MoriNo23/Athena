# Tasks: teleprompter-solo-continuo

## 1. Ajuste y persistencia

- [x] 1.1 `flujoContinuo` fuera de `TeleprompterSettings` (types.ts) y de los
      defaults del store; persist v15 → v16
- [x] 1.2 `teleprompterMigrado` descarta `flujoContinuo` guardado (como ya
      hacía con `speedPreset`): la elección vieja no vuelve a persistirse
- [x] 1.3 `config-file.ts`: default sin el campo, saneo tolerante (un fichero
      a mano con `flujoContinuo` no rompe: se descarta) y `_doc` al día

## 2. Motor y vista

- [x] 2.1 `step-timer.ts`: fuera `plannedStepDelay` (y su `turnMs`) — la
      espera del paso es la del carácter; `stepWait` intacto
- [x] 2.2 `use-teleprompter-player.ts`: sin opción `continuo`; `delayAt`
      devuelve la espera del carácter; la espera de 2 s SOLO para el
      revelado instantáneo con Auto (pageDone — no hay ritmo que proteger)
- [x] 2.3 `TeleprompterOverlay.tsx`: fuera el fundido de columna
      (`animarGiroPagina`, ambos sentidos) y fuera `TeleprompterPageNotice`
      (componente eliminado; claves i18n `tp.pageSoon/pageArrived/
      pageGoalDone` retiradas)
- [x] 2.4 `TELEPROMPTER_PAGE_TURN_MS` solo queda para la espera del revelado
      instantáneo con Auto (comentario actualizado)

## 3. Interfaz

- [x] 3.1 Sin interruptor «Lectura continua» en la sheet in-mode
- [x] 3.2 Sin interruptor en el panel de configuración
- [x] 3.3 i18n es/en/pt: fuera `config.tpContinuo` + `config.tpContinuoHint`

## 4. Validación

- [x] 4.1 Tests: settings (v15 → v16 sin pérdida), config-file (saneo y
      defaults), teleprompter (step-timer sin pausa de giro)
- [x] 4.2 `bun test` + `tsc --noEmit` + `bun run lint` + `bun run build`
- [ ] 4.3 Pasada visual de la dueña: cruce a ritmo normal sin salto, sin
      aviso, sin parpadeo — con el ancla atómica como única magia
