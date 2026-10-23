# Tasks

> **Estado: backlog (propuesta en espera de la dueña).** Nada implementado aún. Antes de la palanca 1 se cierran las 4 preguntas de la proposal.

## 1. Decisiones cerradas con la dueña

- [ ] 1.1 Fuente única (recomendado) vs espejo exportable del `atena.cfg`.
- [ ] 1.2 Formato: TOML (recomendado) — el esquema documentado en el propio fichero por comentarios.
- [ ] 1.3 Escaneo: botón «Re-escanear» + opcional al arrancar; `fs.watch` en vivo queda fuera de v1.
- [ ] 1.4 Política de fichero faltante/movido: marca «sin fichero» + re-vínculo.

## 2. Palanca a: el fichero cfg

- [ ] 2.1 `db/atena.cfg` (TOML) con comentarios en cada bloque; carga al arrancar; si falta, defaults + escribir el fichero inicial.
- [ ] 2.2 `src/lib/settings.ts`: la cfg como fuente vía API (`GET/PUT /api/settings`); el store zustand queda igual para la UI pero lee del fichero y escribe en él.
- [ ] 2.3 Migración de instalación existente: con `riel-settings-v1` en localStorage y sin cfg, se sube y se escribe el fichero; a partir de ahí la cfg manda.
- [ ] 2.4 Vocabulario a BD (data, no config): migrado al arranque, fuera del cfg.
- [ ] 2.5 Multi-dispositivo (LAN): la cfg es del host que sirve; documentar la compatibilidad esperada al editarla a mano.

## 3. Palanca b: biblioteca por carpeta

- [ ] 3.1 UI: elegir ruta de carpeta (una vez, explorador en escritorio) + botón «Re-escanear»; clave cfg `biblioteca.carpeta`.
- [ ] 3.2 Escaneo: registro en sitio de los PDF/EPUB de la carpeta (recursivo, ignora ocultos), `filePath` = ruta real, desduplicación por ruta y por hash de contenido como desempate.
- [ ] 3.3 Ficha de cada libro: título/autor deducidos (nombre del fichero → `ficha.txt` sidecar opcional), editable siempre desde la app.
- [ ] 3.4 Páginas totales: PDF durante el escaneo; EPUB al primer abrir (se escribe en la BD, nunca en el fichero).
- [ ] 3.5 Re-escaneo idempotente: nuevos entran, los que ya no están pasan a «sin fichero» (sección aparte en la biblio); nada se borra de la BD por defecto.

## 4. Pilar c: data aparte (garantías)

- [ ] 4.1 Garantía en código y docs: ninguna ruta de la app escribe dentro del PDF/EPUB ni mueve/renombra ficheros de la biblioteca (grep de `write/rename/unlink` sobre libros).
- [ ] 4.2 «Quitar de la biblioteca» ≠ borrar fichero: la fila de BD desaparece (con su riel/racha/insignia) y el fichero queda intacto en la carpeta.
- [ ] 4.3 Fichero reemplazado (misma ruta, otro contenido): recalcular páginas sin perder progreso (clamp honesto del `currentPage`); si el recorte es brusco, avisar antes.

## 5. Verificación en vivo

- [ ] 5.1 Sondas E2E: (a) cfg editada a mano se refleja al arrancar; (b) añadir fichero a la carpeta → aparece en la biblio sin subida; (c) mover fichero → «sin fichero» con progreso intacto + re-vínculo; (d) quitar libro → el fichero sigue en su sitio.
- [ ] 5.2 Migración real: instalación con `riel-settings-v1` → arranque nuevo con la cfg poblada y tema/i18n intactos.
- [ ] 5.3 LEEME: documentar el cfg y el flujo de carpeta.
