# Tasks: teleprompter-flujo-continuo

> Parche aplicado y verificado con `bun test` (89 pass), `tsc --noEmit`,
> `bun run lint` y `bun run build`. La pasada visual con libro real queda
> pendiente de la dueña (probará con un patch).

## 1. Ajuste y persistencia

- [x] 1.1 `TeleprompterSettings.flujoContinuo: boolean` en `src/lib/types.ts`,
      con el contrato documentado (continuo = el cruce no se anuncia)
- [x] 1.2 Default de la casa `true` en `settings.ts`; persist v14 → v15
      (`teleprompterMigrado` rellena el campo nuevo sin pisar lo guardado)
- [x] 1.3 `config-file.ts`: default, saneo `boolIn` y `_doc` del bloque
      teleprompter (el fichero a mano sigue siendo fuente y explicación)

## 2. Motor y vista

- [x] 2.1 `step-timer.ts`: `plannedStepDelay({ continuo })` — en el borde con
      Auto devuelve el retardo normal; la pausa de giro queda para el modo
      clásico. La pausa de 2 s del revelado instantáneo (pageDone + Auto) se
      conserva (ahí no hay ritmo de letras que proteger)
- [x] 2.2 `use-teleprompter-player.ts`: opción `continuo` en `delayAt` (en
      deps del motor, como `auto`); el cruce sigue siendo el `slide()` atómico
- [x] 2.3 `TeleprompterOverlay.tsx`: sin `animarGiroPagina` en continuo (en
      ambos sentidos) y aviso de página (`TeleprompterPageNotice`) suprimido;
      el ancla atómica conserva la posición y la cámara sigue su vuelo

## 3. Interfaz

- [x] 3.1 Interruptor «Lectura continua» en la sheet in-mode
      (`tp-sheet-continuo`, sección Comportamiento, antes de Auto)
- [x] 3.2 Interruptor en el panel de configuración (`config-tp-continuo`)
- [x] 3.3 i18n es/en/pt: `config.tpContinuo` + `config.tpContinuoHint`

## 4. Validación

- [x] 4.1 Tests: step-timer (continuo sin pausa / clásico intacto),
      config-file (defaults, elección guardada, valor roto), settings
      (migración v14 y v15 sin pérdida)
- [x] 4.2 `bun test` + `tsc --noEmit` + `bun run lint` + `bun run build`
- [ ] 4.3 Pasada visual con libro real: cruce a ritmo normal sin salto, sin
      aviso y con la barra de progreso de página como única referencia
- [ ] 4.4 Decisión de la dueña: si el continuo se queda como único camino,
      retirar el modo clásico (aviso, fundido, `TELEPROMPTER_PAGE_TURN_MS`)
      en un change aparte
