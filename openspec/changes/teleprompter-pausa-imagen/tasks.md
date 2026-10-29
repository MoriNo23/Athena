# Tasks: teleprompter-pausa-imagen

> Estado real del parche (tsc + bun test + lint + build + smoke en verde).
> Divergencias del SDD anotadas; las validaciones con libros reales quedan
> marcadas como pendientes.

## 1. Modelo y timeline

- [x] 1.1 Tipos en `src/lib/teleprompter.ts`: `TeleprompterBlock.image?` (src
      ya resuelto) y `TeleprompterStep { char, units, holdMs? }` — la tarjeta
      viaja como un paso `TELEPROMPTER_IMAGE_CHAR` (un span = una celda
      revelable); el kind no cambia («p»)
- [x] 1.2 `buildTeleprompterStream(blocks, porFrase, imagenHoldMs)`: un paso
      por figura con espera ABSOLUTA (holdMs) y `pending = 0` (el hold ya es
      la pausa). Orden vertical figura↔párrafo NO resuelto en PDF: la lámina
      se añade al final de los bloques de su página (heurística v1; el EPUB
      conserva el orden real del spine)
- [x] 1.3 Tests del timeline mixto (`src/lib/teleprompter.test.ts`): paso de
      imagen con hold, hold sin unidades, pausa pendiente no heredada,
      `teleprompterCharCount` cuenta la figura como 1 (página ilustrada ≠ muda)

## 2. Extracción

- [x] 2.1 Nuevo `src/lib/teleprompter-images.ts` (no `pdf-images.ts`): recorre
      `getOperatorList()` con OPS del runtime (save/restore/transform),
      bbox por CTM del cuadrado unitario, filtro ≥ 12 % área y ≥ 120 px de
      lado, páginas mixtas solamente (texto ≥ 24 chars; escaneadas siguen sin
      tarjeta = sin regresión)
- [x] 2.2 Rasterizado a canvas (ancho máx. 1400 px) y recorte por caja a
      JPEG; cacheado por página en el caché de bloques que ya existía
- [x] 2.3 EPUB: los `<img>` del spine ya llegaban como dataURL del parser
      (`use-epub-book.ts` ahora los emite como tarjetas; el presupuesto de
      32 MB del parser actúa de límite — no hacen falta blob URLs ni liberarlas)
- [x] 2.4 Extracción perezosa respetada: solo la página se procesa cuando su
      bloque entra en la ventana (caché existente de `loadBlocks`)

## 3. Motor e interacción

- [x] 3.1 Motor: el paso de imagen se enciende como una celda y el motor
      espera `holdMs` (Espacio congela — pausa general; `→` la salta como
      cualquier letra). Sin tick diferenciado (el tic suena: es una celda)
- [x] 3.2 Render: `<p class="tp-block tp-img-block"><span class="tp-ch
      tp-img"><img/></span></p>` — desvelado por `.on` con fundido de 420 ms
      (sin barra de progreso del hold en v1)
- [x] 3.3 Rebobinado: re-entrada apaga la tarjeta (`.on` retirado) y el hold
      se repite al volver a alcanzarla
- [x] 3.4 Auto: el hold es una espera del motor — el cruce sigue después del
      hold; `animarGiroPagina` al cambiar de ventana, como ya hacía
- [x] 3.5 Conteo de lectura intacto: las tarjetas no giran página ni suman
      más que el avance de celdas existente

## 4. Ajustes y persistencia

- [x] 4.1 Claves `teleprompter.pausaImagen` (default true) e `imagenHoldMs`
      (default 5000; clamp 2000-30000 en UI, 500-60000 en fichero) en
      `types.ts` + `settings.ts` (persist v14) + `config-file.ts` saneado
- [x] 4.2 i18n es/en/pt del grupo «Figuras» en la sheet (P4) y aria-labels

## 5. Validación

- [ ] 5.1 Los 7 escenarios del delta con un PDF con figuras y un EPUB
      ilustrado reales (pendiente de pasada manual)
- [x] 5.2 PDF escaneado sin texto: comportamiento idéntico (sin tarjeta, la
      página sigue saltándose) — garantizado por el filtro de página mixta
- [ ] 5.3 Performance con libro real (el render de página se hace una vez por
      página y queda en caché)
- [x] 5.4 Memoria: sin blob URLs (EPUB dataURLs ya existentes en memoria;
      PDF usa JPEG recortado por página cacheada — el DOM queda acotado a 2
      páginas por diseño de la ventana)
