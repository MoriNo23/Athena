# Proposal

## Why

El change archivado `camara-suave-y-metas-por-libro` estrenó la cámara animada del teleprompter y, con ella, dos defectos que su sonda no cubría: al cruzar de página o llegar un título el flujo publica el avance antes que la ventana nueva, así que la vista recibe órdenes contra el DOM viejo y el texto sube y baja hasta que el motor vuelve a ordenar; y el revelado completo de la página barre la columna hasta el final («el texto sube»), una transición que resulta desagradable de ver.

Además, el modo a pantalla completa queda corto como superficie de lectura larga: no muestra el avance de hoy del libro, no recuerda qué hace cada tecla y la pantalla puede suspenderse en medio de una sesión.

## What Changes

- **Cámara sin rebote.** El cruce de página publica avance y ventana en el mismo render (fin de las órdenes de cámara contra el DOM viejo); al cambiar de ventana la vista se compensa de forma atómica y la columna no se reacomoda; la llegada de un título ancla el **inicio** del bloque en la zona cómoda, no su último carácter.
- **Revelado completo sin barrido.** Al completar la página de golpe (clic o espacio) la vista ya no viaja al fondo: el resto del texto se enciende donde está y la columna queda donde el lector lee. La transición breve se conserva para el seguimiento fino (avance de línea, rebobinado) y para los asentamientos pequeños.
- **Hoy del libro en el teleprompter.** La barra superior muestra el par «páginas de hoy / meta efectiva» de **este** libro, vivo durante la sesión, con el mismo conteo que la cabecera del lector.
- **Recordatorio de teclas en pantalla completa.** Al ocultar o mostrar la interfaz se despliega a la derecha un recordatorio en letras grandes y transparentes con cada tecla y qué hace: el mapa del lector cuando el lector está en pantalla completa, y el del teleprompter en su modo.
- **Pantalla despierta.** Con la lectura en pantalla completa —lector o teleprompter abierto— la app mantiene la pantalla activa (Screen Wake Lock), re-adquiere al volver a la pestaña y libera al salir; sin soporte del navegador, silencio.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `teleprompter`: se redefine la vista con transición breve —cruce asentado sin reacomodo visible, título anclado a su inicio, revelado completo sin desplazamiento de columna— y se añade el recordatorio de teclas de su inmersión.
- `reader-surface`: se añaden la pantalla despierta en pantalla completa y el recordatorio de teclas del lector en pantalla completa.
- `reading-habit`: el «hoy» del libro también se muestra en la barra del teleprompter.

## Impact

- Hooks: `src/hooks/use-teleprompter-window.ts` (anclaje al cambiar de ventana), `src/hooks/use-teleprompter-player.ts` (cruce atómico, ancla de título, revelado), nuevo `src/hooks/use-wake-lock.ts`.
- Componentes: `src/components/reader/TeleprompterOverlay.tsx` (hoy en la barra, recordatorio de teclas, wake lock), `src/components/reader/ReaderView.tsx` y su chrome (recordatorio de teclas del lector, wake lock en pantalla completa).
- Estilos en `src/app/globals.css` (recordatorio fantasma, teleprompter y lector) e i18n es/en/pt (`src/lib/i18n/*`).
- Sonda `scripts/probe-camara-suave.js`: casos nuevos de cruce, título y revelado.
- Sin cambios de API, base de datos, dependencias ni formato de respaldo.
