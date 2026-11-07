# Guía de lectura

Athena gira alrededor de una idea: devolverte al libro hoy. Todo lo demás
sirve a eso.

## El riel, la racha y la ETA

- **El riel** es una pista de progreso segmentada que vive debajo de cada
  libro: hitos visibles, confeti al cruzarlos, tema configurable (*egeo*,
  *mármol*…).
- **La racha** cuenta los días consecutivos de lectura. Un día perdido no te
  borra: la racha te pide volver, no te castiga.
- **La ETA honesta** calcula cuándo terminas el libro con tu ritmo real, no
  con una media optimista.
- Al terminar un libro: **insignia** que se queda para siempre.

## Formatos y modos

- **PDF y EPUB** se paginan igual (~320 palabras por página virtual): el riel
  y la cabecera siguen páginas reales en ambos formatos.
- **Lectura dual (PDF compañero)**: lee un libro y ten su compañero
  sincronizado al lado — apuntes, traducción, segunda pantalla.
- **OCR** para libros escaneados: corre en tu navegador (tesseract wasm); la
  primera vez descarga los datos del idioma (~1-2 MB) y luego queda en caché.
- **Diccionario y vocabulario**: consulta palabras sin salir del libro; tus
  palabras se guardan en la base de datos con el resto del progreso.
- **Modo texto**: el PDF se refluye con tipografías de lectura y páginas
  virtuales.
- **Modo inmersión**: la interfaz se esconde sola al dejar de moverte
  (tecla `H`), pantalla completa y medida más ancha.
- **Modo teleprompter**: las páginas se encadenan como un solo texto continuo
  que se enciende letra a letra. Escala de fuente `0.8×–1.6×`, rebobinar con
  `←`. Fondo configurable (tema o imagen propia).
- **ES / EN / PT**: interfaz, fechas y todo lo demás cambia de idioma.

## La biblioteca

- Arrastra un PDF o EPUB a la biblioteca y ya está: título y autor salen del
  nombre del fichero (`Mi libro favorito.pdf` → «Mi libro favorito»).
- Anti-duplicados: si el fichero y las páginas ya están, te avisa — es aviso,
  no error.
- «Quitar de la biblioteca» borra solo su fila (progreso e insignia
  incluidos): el fichero original queda intacto en su sitio.
- ¿Tienes una carpeta entera de libros? [Regístrala
  una vez](biblioteca-por-carpeta.md) y la app la lee donde están, sin copiar nada.

## Los ajustes

Todo lo de arriba se configura desde el panel de ajustes, y lo que tocas ahí
queda escrito en **`db/config.json`** — un fichero legible, editable a mano y
que sobrevive a todo: [Ajustes](ajustes.md).
