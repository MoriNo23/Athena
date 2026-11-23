# Tasks

## 1. Timeline y piso de lectura

- [x] 1.1 Añadir `TELEPROMPTER_HEADING_FLOOR_MS` y calcular la espera posterior al título como `max(unidades · msPorUnidad(wps), piso)` en `src/core/teleprompter.ts`; verificar con `src/core/teleprompter.test.ts` que a 4 pal/s la espera nunca baja del piso.
- [x] 1.2 Dar compás propio a cada encabezado consecutivo (quitar la supresión por `prevHeading`) y usar `max` en vez de suma; verificar con un test de dos `h1`/`h2` seguidos que el segundo recibe su piso y que el total no duplica pausas.

## 2. Coreografía visual

- [x] 2.1 Publicar `--tp-heading-fade` desde `use-teleprompter-player.ts` sobre el contenedor del stream y actualizarlo al cambiar wps en marcha; verificar con un test de hook que la variable sigue a `msPorUnidad`.
- [x] 2.2 Reescribir `.tp-block-h` / `.tp-block-h.on` en `src/styles/globals.css` con los dos tiempos (~300 ms de entrada, ~900 ms de fundido, ~400 ms de silencio antes del cuerpo), manteniendo la animación sólo en `.on`; verificar que no existe animación en el estado apagado.
- [x] 2.3 Añadir la regla de `prefers-reduced-motion` que conserva el tiempo de lectura y quita `translateY`/fundido; verificar con el test de empaquetado o inspección de CSS.
- [x] 2.4 Centrar la cámara en el bloque del título (`start + floor(length/2)`) sin romper el ancla de poda; verificar con el humo en APK que un título de dos líneas queda completo en la zona cómoda.

## 3. Ajuste «Títulos»

- [x] 3.1 Añadir `headingStyle: "coreografiados" | "texto"` a `TeleprompterSettings` y al default/migración de `src/lib/settings.ts`; verificar con un test de migración que un estado sin el campo cae a `coreografiados`.
- [x] 3.2 Mostrar el selector en `TeleprompterSettingsSheet.tsx` y conectarlo al player para que en modo `texto` el título use la cadencia y la transición `.tp-ch.on` del cuerpo; verificar que no se aplican el piso ni la coreografía.
- [x] 3.3 Añadir las etiquetas en `src/lib/i18n/{es,en,pt}.ts`; verificar con `src/lib/i18n.test.ts` que las tres lenguas tienen clave y que la interpolación no rompe.

## 4. Verificación y entrega

- [x] 4.1 Añadir `src/hooks/use-teleprompter-player.test.tsx` con el caso «título seguido de otro título» y el caso «modo texto»; verificar `bun test` en verde salvo el fallo viejo conocido.
- [x] 4.2 Compilar y ejecutar `bunx tsc --noEmit`, `bun run lint`, `bun test` y `bun run build`; verificar los cuatro sin errores nuevos.
- [x] 4.3 Hacer humo en el APK: dos títulos consecutivos se iluminan suavemente, el fundido termina a 4 pal/s, y al cambiar a «Como texto normal» el título va al ritmo del cuerpo; verificar captura visual en el emulador. (Medido por CDP: h1→h2 = 1614 ms, h2→cuerpo = 1616 ms; `data-heading-style` presente; animaciones 0.3s + 0.9s; modo texto sin animación de bloque.)
- [ ] 4.4 Subir la versión y abrir el PR con notas de release que mencionen el nuevo ajuste; verificar que no cambian `server/api.ts`, `public/athena-offline.js` ni el esquema de `src/lib/db.ts`.
- [x] 4.5 Verificar en escritorio: `bun run dev` y Brave con un EPUB real, dos encabezados consecutivos, fundido completo a 4 pal/s y cambio a «Como texto normal» sin regresión; verificar captura y consola sin errores. (Medido: h1→h2 = 1700 ms, h2→cuerpo = 2078 ms, ambos sobre el piso de 1600 ms; modo texto sin animación de bloque y con transición de 130 ms; ajuste persistido; consola sin errores.)
- [x] 4.6 Verificar en Android: `bun run apk:sync` + `assembleDebug`, instalar en el AVD y repetir el mismo recorrido; confirmar que el aviso de página leída sigue funcionando con la coreografía nueva. (Aviso «Página leída · hoy 2/20» confirmado. Hallazgo corregido en el camino: el motor offline tenía defaults propios sin `headingStyle` y la versión de persistencia no subía; se añadieron el campo en `public/athena-offline.js` y el salto a v17.)
- [ ] 4.7 Tras mergear, crear una release presentable para la versión nueva con notas del ajuste y artefactos adjuntos; verificar con `gh release view` que el APK y los binarios de Linux están presentes y que la versión coincide con `package.json`.

## Workflow follow-up

- Archivar el change cuando el PR esté mergeado y el humo en APK confirmado.
- Si se archiva `honest-reading-teleprompter` antes, resolver el delta de `teleprompter` para que ambos spec files convivan sin duplicados.
