# Proposal: teleprompter-ajustes-inmode

## Why

El teleprompter es un modo de sesión larga, pero solo expone velocidad, instantánea, sonido,
Auto, tamaño de letra y pantalla completa. Todos los demás ajustes del modo —tarjetas por
frase, fondo del escenario (tema/portada/imagen propia con subida) y filtro del fondo— viven
solo en el ConfigPanel del lector: para probar un fondo a mitad de sesión hay que salir del
modo, cambiarlo y volver, perdiendo posición y contexto. La store de ajustes ya soporta
escritura desde cualquier superficie; falta la superficie.

## What Changes

- Nuevo componente `TeleprompterSettingsSheet`: sheet lateral (Radix `ui/sheet.tsx`,
  side=right) superpuesto al escenario atenuado, invocable con un botón de engranaje en la
  barra del overlay y con la tecla `A`; añade su fila al ShortcutGhost.
- Cuatro grupos de controles (mismos componentes extraídos del ConfigPanel, misma slice
  zustand): Ritmo (wps, instantánea, tarjetas por frase, Auto), Imágenes (pausa on/off y
  duración del hold —del change P2—), Fondo (tema/portada/imagen con subida a
  `/api/teleprompter/fondo` y slider de filtro) y Sonido y letra (tic, A−/A+).
- Jerarquía de teclado explícita: con el sheet abierto, Escape cierra el sheet y no el
  overlay; los atajos del teleprompter se suprimen mientras el sheet tiene el foco; la
  reproducción NO se pausa al abrir (coherente con el popover de velocidad actual).
- Sin persistencia nueva: todas las claves ya existen en el bloque `teleprompter` de
  `db/config.json` (las de imagen las añade el change `teleprompter-pausa-imagen`).

## Impact

- Affected specs: `teleprompter` (añade «Ajustes avanzados dentro del modo»);
  `reader-settings-surface` (modifica la superficie de ajustes del teleprompter).
- Affected code: `src/components/reader/TeleprompterSettingsSheet.tsx` (nuevo),
  `src/components/reader/TeleprompterOverlay.tsx`,
  `src/components/reader/TeleprompterControls.tsx` (nuevo, controles compartidos),
  `src/components/reader/ConfigPanel.tsx` (reusa los controles extraídos).
- Compatibilidad: ninguna clave nueva propia; el ConfigPanel conserva el 100 % de sus ajustes.
