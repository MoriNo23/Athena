# Proposal

## Why

Hoy cada libro exige subirse a mano (copia física a `public/uploads/` + fila en BD) y los ajustes viven en el `localStorage` del navegador (`riel-settings-v1`): si cambia el navegador o se limpia, la configuración de la dueña desaparece; no se puede leer ni editar a mano; y en modo LAN apenas viaja entre dispositivos. La dueña pide la comodidad de una app de escritorio de verdad — estilo Wine/abridor de ejecutables: **señalar una carpeta una vez y que los libros aparezcan solos** — mientras el progreso y la data quedan a buen resguardo, aparte de los ficheros.

## What Changes

- **Palanca a — Ajustes en un fichero `cfg`:** persistencia de ajustes en `db/atena.cfg` (junto a la BD y al `atena-lock`, la carpeta de datos de la casa), legible y editable a mano. El store de la UI no cambia (zustand vive), pero su fuente pasa a ser el fichero: se carga al arrancar y la UI escribe en él. `localStorage` queda solo como migración de instalación existente. **El turismo de datos**: solo config pura (lang, riel, lectura, inmersión, modos, teleprompter, biblioteca) — el **vocabulario es data** (notas de la dueña) y migra a la BD, no al fichero.
- **Palanca b — Biblioteca por carpeta:** se elige una carpeta del disco (una vez) y la app la **escanea registrando PDF/EPUB en su sitio** — sin copia: `filePath` apunta al fichero real y nunca se toca. El re-escaneo (botón en la biblio + opcional al arrancar) refleja añadidos y retiradas; el duplicado se evita por ruta (y hash de contenido como desempate). Título/autor se deducen del fichero (nombre, o `ficha.txt` sidecar opcional); páginas totales se calculan al escanear (PDF) o al primer abrir (EPUB).
- **Pilar c — Data aparte (garantía explícita):** progreso, sesiones, hitos, insignias y datos de modos siguen viviendo SOLO en la BD (`db/custom.db`), nunca dentro ni junto a los ficheros del libro: la app no mueve, renombra, ni escribe metadata en ningún PDF/EPUB. Libro quitado de la biblioteca ⇒ su fila (y con ella su riel, racha e insignia) desaparece de la app pero el fichero queda intacto en la carpeta.

## Capabilities

- Nueva: **`biblioteca-filesystem`** (contrato de escaneo en sitio: registro fiel a la carpeta, re-escaneo, estados fantasma) — spec delta se redacta al entrar en apply.
- Modificada: **`reader-settings-surface`** (el dónde persiste ahora: fichero cfg como fuente) — spec delta en apply, con la migración desde `riel-settings-v1`.

## Open questions (se preguntan antes de la palanca 1)

1. ¿`atena.cfg` como **fuente única** (recomendado; localStorage solo migración) o como **espejo importable**?
2. Formato del fichero: **TOML** recomendado (comentable, edita a mano sin romper), sobre JSON.
3. Escaneo: manual (botón Re-escanear) + opcional al arrancar; ¿si además `fs.watch` en vivo? (propuesto: fuera de alcance v1).
4. Y el fichero de la biblioteca se **mueve, renombra o borra** desde el explorador: ¿fila marcada «sin fichero» con progreso intacto y opción de re-vincular por nueva ruta? (propuesto: sí).

## Impact

- Ámbito: `src/lib/settings.ts` (carga/escritura vía API), nueva `src/lib/library-folder.ts` + endpoint de escaneo, fila `Book` para `origen` (importado | en direccion) y `fileMissingAt`, migración del vocabulario a BD, docs del LEEME. Sin dependencias nuevas (TOML = parser pequeño que se escribe local).
- Riesgo: en modo LAN conectado por túnel, las rutas son de la **máquina que sirve** (Colab tiene las suyas) — el LEEME lo documenta; escaneos por hash de ficheros gordos tienen coste — desempate por hash solo cuando la ruta cambia, no siempre.
- Fuera de alcance v1: escritura de metadata en ficheros, sincronización en vivo (fs.watch), multi-carpeta.
