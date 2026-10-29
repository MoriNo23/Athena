# Tasks: teleprompter-ajustes-inmode

> Estado real del parche (tsc + bun test + lint + build + smoke en verde).

## 1. Controles compartidos

- [x] 1.1 No se extrajo `TeleprompterControls.tsx`: la sheet reutiliza las
      MISMAS claves i18n (`config.tp*`) y el MISMO store
      (`useSettings.teleprompter`) que ConfigPanel — fuente única de verdad
      sin tocar el panel (menos riesgo de regresión; la extracción de
      componentes puede hacerse encima después)
- [x] 1.2 ConfigPanel queda intacto (equivalencia de estado garantizada por
      el store compartido)

## 2. Sheet del modo

- [x] 2.1 `TeleprompterSettingsSheet.tsx` sobre `ui/sheet.tsx` (side=right);
      botón engranaje (Settings2) en la barra del overlay + tecla `A` + fila
      en ShortcutGhost
- [x] 2.2 Jerarquía de Escape: `settingsOpenRef` suprime TODOS los atajos del
      overlay (incluido el propio Escape) mientras la sheet está abierta —
      Esc la cierra (Radix) y después un segundo Esc sale del modo
- [x] 2.3 Foco atrapado por Radix y devuelto al cerrar; aria-labels e i18n
      es/en/pt completos
- [x] 2.4 Subida de imagen propia desde la sheet vía `/api/teleprompter/fondo`
      (endpoint existente) + «Quitar imagen» + filtro de legibilidad con
      reset al default
- [x] 2.5 Inventario de la sheet: velocidad (wps/Instantánea), tarjetas por
      frase, tamaño de letra, fondo (tema/portada/imagen), figuras
      (pausaImagen + hold, P2), Auto y sonido
- [x] 2.6 La UI auto-ocultable no se esconde con la sheet abierta
      (`settingsOpenRef` en el bucle de inmersión)

## 3. Validación

- [ ] 3.1 Los 5 escenarios del delta (apertura, Escape, fondo en caliente,
      persistencia, teclado) — pendiente de pasada manual con libro real
- [x] 3.2 Equivalencia con ConfigPanel: mismo store y mismas claves de
      config (fichero `db/config.json` saneado por `config-file.ts` v14)
- [x] 3.3 `bun run lint`, `bunx tsc --noEmit`, `bun test` y
      `bun run build` en verde
