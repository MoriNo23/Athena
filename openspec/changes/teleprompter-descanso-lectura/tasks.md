# Tasks: teleprompter-descanso-lectura

## 1. Ajuste y persistencia

- [x] 1.1 `TeleprompterSettings.descansoMin: number` (0 = off) en
      `src/lib/types.ts`, con `TELEPROMPTER_DESCANSO_OPCIONES`,
      `TELEPROMPTER_DESCANSO_S` (20) y `clampTeleprompterDescanso`
- [x] 1.2 Default de la casa `0` en `settings.ts` (persist v16, mismo salto
      que teleprompter-solo-continuo)
- [x] 1.3 `config-file.ts`: default, saneo `numIn` 0-120 y `_doc` del bloque
      teleprompter

## 2. Comportamiento (overlay)

- [x] 2.1 Contador de lectura real: solo corre en marcha y con la pestaña
      visible (el tiempo en pausa no suma)
- [x] 2.2 Armado en cortes naturales: pausa de la lectora o cruce de página
      (la apertura no cuenta); nunca a mitad de frase; no pausa sola
- [x] 2.3 Píldora con acciones (`tp-notice tp-rest-card`): «Llevas N min
      leyendo · ¿Un descanso de 20 s?» + [Descansar] [Seguir leyendo];
      descartar rearma al cumplir de nuevo
- [x] 2.4 Velo del descanso (`tp-rest-veil`): flujo detenido, cuenta atrás
      20 → 0, consejo 20-20-20, «Continuar leyendo» (reanudación explícita)
- [x] 2.5 Teclado: mientras el velo está abierto, Esc termina antes (y
      reanuda) y el resto de teclas no toca la lectura

## 3. Interfaz y estilos

- [x] 3.1 Control Nunca/15/20/30/45 en la sheet in-mode (Comportamiento,
      antes de Auto) y en el panel de configuración
- [x] 3.2 `globals.css`: `.tp-rest-card` (píldora con puntero) y
      `.tp-rest-veil` (solo opacidad); ambos sin animación con
      `prefers-reduced-motion`
- [x] 3.3 i18n es/en/pt: `config.tpDescanso` + hint + `Nunca`, y
      `tp.rest.*` (suggest/ask/tip/take/skip/done/continue/aria)

## 4. Validación

- [x] 4.1 Tests: config-file (saneo de descansoMin), settings (migración)
- [x] 4.2 `bun test` + `tsc --noEmit` + `bun run lint` + `bun run build`
- [ ] 4.3 Pasada visual de la dueña: armar con 1-2 min de prueba (fichero a
      mano), ver la píldora en el próximo corte, descansar y reanudar
