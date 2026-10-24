# Tasks

> **Estado: implementado (23-10, «no esperes más»).** Verificado en vivo con sondas; falta solo el commit/push finales.

## 1. Decisiones cerradas con la dueña

- [x] 1.1 **Fuente única** (recomendación adoptada con el «no esperes más»): `db/config.json` manda; localStorage solo caché de arranque + migración de la instalación vieja.
- [x] 1.2 Formato: JSON — decidido con la dueña (23-10); el esquema documentado en el LEEME (JSON no admite comentarios → clave `_doc` conservada como datos en cada escritura).
- [x] 1.3 Escaneo: **botón «Re-escanear»** (una sola vía en v1; elegir carpeta = escanear). `fs.watch` en vivo queda fuera de v1.
- [x] 1.4 Política de fichero faltante/movido: marca «sin fichero» con el progreso intacto + re-vínculo; si el hash identifica un único candidato en otra ruta, **re-vínculo automático** al siguiente escaneo.

## 2. Palanca a: el fichero JSON — HECHA

- [x] 2.1 `db/config.json` bien indentado, `_doc` explicativo preservado; carga al arranque; si falta, defaults + escritura del fichero inicial; un JSON roto a mano se respalda (`.roto-<ts>`) y se rehace. `src/lib/config-file.ts` + `GET/PUT /api/settings`.
- [x] 2.2 `settings.ts`: cada setter escribe al fichero con PUT diferido (1 s; flush al ocultar pestaña). El store sigue siendo la UI; `db/config.json` es la fuente.
- [x] 2.3 Migración one-shot: si el fichero no existía (señal `created`), el arranque sube `riel-settings-v1` al fichero; desde ahí el fichero manda.
- [x] 2.4 Vocabulario a BD (modelo `Vocab` + `/api/vocab`, `/api/vocab/import`): fuera del fichero, migrado en el mismo arranque; desduplicado por palabra+idioma sin importar la caja.
- [x] 2.5 Multi-dispositivo (LAN): el fichero es del host; LEEME documenta que la ruta/carpeta son de la máquina que sirve.

## 3. Palanca b: biblioteca por carpeta — HECHA

- [x] 3.1 UI «Carpeta» en la biblioteca: diálogo con ruta absoluta + «Re-escanear»; clave `biblioteca.carpeta` del fichero. Bilingüe es/en/pt.
- [x] 3.2 `src/lib/library-folder.ts`: recolecta recursivo (ignora ocultos, topes de tamaño), `filePath` = ruta real, desduplicado por ruta y por hash (sha256) como desempate.
- [x] 3.3 Ficha: `tituloDeNombre` + sidecar `<nombre>.ficha.txt` (título; autor con prefijo opcional); editable desde la app.
- [x] 3.4 Páginas totales: PDF durante el escaneo (contador sin dependencias en `paginasDePdf`); EPUB/PDF opaco al primer abrir → PATCH de `totalPages` desde el lector (nunca en el fichero).
- [x] 3.5 Re-escaneo idempotente: nuevos entran, fuera de carpeta → «sin fichero» (chip en tarjeta + re-vínculo), reaparición limpia la marca; reemplazo de contenido → recalcular páginas + clamp honesto del progreso.

## 4. Pilar c: data aparte (garantías) — HECHA

- [x] 4.1 La app solo LEE los ficheros de carpeta (stat/lectura de cabecera/hash); ninguna ruta escribe dentro ni mueve/renombra. DELETE de `origin="carpeta"` no mueve el fichero a la papelera.
- [x] 4.2 «Quitar de la biblioteca» ≠ borrar fichero: fila + insignia + sesiones fuera, fichero intacto byte a byte (sonda d). Deshacer sigue disponible para la fila.
- [x] 4.3 Fichero reemplazado (misma ruta, otro contenido): recalcula páginas, `currentPage` con clamp honesto y aviso de recorte en el resumen del escaneo.

## 5. Verificación en vivo — HECHA

- [x] 5.1 Sondas (dev server + curl + playwright): (a) `db/config.json` editado a mano se refleja al arrancar (999 tramos → límite 40; `lang=pt`/`theme=violet`/preset respetados; `_doc` y claves raras conservadas en cada PUT); (b) añadir ficheros a la carpeta → aparecen sin subida; (c) mover fichero → «sin fichero» con progreso intacto + re-vínculo (y auto-vínculo por hash si se movió dentro de la carpeta); (d) quitar libro → el fichero sigue en su sitio byte a byte, papelera vacía.
- [x] 5.2 Migración real: navegador con `riel-settings-v1` sembrado (12 valores + palabra de vocabulario) → arranque con `db/config.json` poblado desde esos valores y vocabulario en la BD.
- [x] 5.3 LEEME: secciones «Tus ajustes en `db/config.json`» y «Biblioteca por carpeta» + mapa del tesoro y problemas frecuentes.
