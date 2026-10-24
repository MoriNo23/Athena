# Tasks

> **Estado: aplicado (24-10).** Hallazgo de una revisión externa + prueba en
> producción: los ficheros nuevos subidos a `public/uploads` daban 404 hasta
> reiniciar el servidor.

- [x] `GET /api/books/[id]/file`: stream SIEMPRE por la app (subido y carpeta), con Range (206) para pdfjs; `?cual=companion` para el PDF de lectura dual.
- [x] `GET /api/books/[id]/cover` (nueva): stream de la portada, sin caché.
- [x] `archivoUrlDe()`: siempre `/api/books/<id>/file` (nunca el estático).
- [x] `GET /api/books` emite `archivoUrl` y `coverUrl`; consumen BookCard, la ficha del libro, el fondo del teleprompter (portada) y el DualViewport.
- [x] Verificado en vivo: libro nuevo creado tras el arranque → portada 200 y fichero 200 sin reiniciar (el estático daba 404); Range 206; biblioteca de la dueña intacta (3 libros; libro de prueba borrado).
- [ ] Pendiente para el siguiente cambio: mover el almacén a `data/` (con migración de rutas) y renombrar `custom.db` → `atena.db`.
