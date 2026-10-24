# Proposal

## Why

Revisión externa del repo (24-10) + prueba en producción que lo confirma:
los ficheros que la app ESCRIBE (libros subidos, portadas, PDFs compañeros)
viven en `public/uploads/` y el cliente los pide como URLs estáticas. En
producción (`next start`), un fichero creado **después** del arranque del
servidor responde 404: el directorio público se enumera al arrancar. Es un
bug de correctitud, no de estilo: la dueña no puede subir un libro/cubierta
nuevo en una sesión en marcha. (Probado: fichero nuevo en `public/uploads`
→ 404 hasta reiniciar el servidor.)

Además, exponer los libros de la dueña como estáticos de `public/` los
sirve sin pasar por la app — justo lo que una casa local-first no quiere.

## What Changes

- **Todos los ficheros de libro los sirve la app**, no el servidor estático:
  - `GET /api/books/[id]/file`: stream del fichero real (subido o de carpeta;
    antes redirigía a `/uploads/...` para los subidos). Acepta `?cual=companion`
    para el PDF compañero de la lectura dual.
  - `GET /api/books/[id]/cover` (nuevo): stream de la portada (`no-store`).
- **Las URLs dejan de ser rutas de disco en el DTO**: `GET /api/books` emite
  `archivoUrl` (el lector) y `coverUrl` (la tarjeta, la ficha, el fondo del
  teleprompter) derivados del id; `filePath`/`coverPath`/`companionPath`
  siguen en la fila como dato interno (papelera, sidecars, re-vínculo), pero
  ningún componente los utiliza como URL.
- Nada deesto cambia dónde se guardan los ficheros: `public/uploads/` sigue
  siendo el almacén (gitignored). Cambia **quién los sirve**.

## Lo que YA existe

- `archivoUrlDe()` + `/api/books/[id]/file` (stream) para los libros de
  carpeta; el patrón del endpoint de portada/companion (subidas) ya existe
  como escritura — now se lee por el mismo camino.

## Impact

- Ámbito: `src/app/api/books/[id]/file/route.ts` (stream siempre),
  `src/app/api/books/[id]/cover/route.ts` (nuevo),
  `src/app/api/books/route.ts` (mapeo de URLs), `src/hooks/use-cover-manager.ts`,
  `src/components/library/BookCard.tsx`, `EditBookDialog.tsx`,
  `src/components/reader/ReaderStage.tsx`, `TeleprompterOverlay.tsx`.
- Sin dependencias nuevas; streams con `fs` de node (runtime nodejs).
- Efecto: subir un libro o una portada funciona al instante, sin reiniciar;
  los ficheros de la dueña dejan de ser estáticos públicos.
- Fuera de alcance v1: mover el almacén a `data/` (siguiente cambio, con
  migración de rutas), renombrar `custom.db`, rutas cifradas.
