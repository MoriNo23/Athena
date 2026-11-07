# Biblioteca por carpeta

Subir libros uno a uno cansa. Si tienes una carpeta con tus PDFs y EPUBs,
**señálala una vez** y la app la registra entera:

1. En la biblioteca, pulsa **«Carpeta»**.
2. Escribe la **ruta absoluta** de la carpeta en la máquina que sirve la app
   (p. ej. `/home/maria/Biblioteca`) y pulsa **«Escanear»**.
3. Los libros aparecen solos, sin subir nada. **Nada se copia ni se mueve**:
   la app solo lee los ficheros donde ya estaban.
4. Cuando añadas o muevas libros, vuelve a pulsar **«Carpeta» →
   «Re-escanear»**: los nuevos entran, los que ya conocías no se duplican.

## Garantías y detalles

- **La app jamás escribe dentro de tus PDF/EPUB** ni los renombra, mueve o
  borra: son tuyos. «Quitar de la biblioteca» borra solo su fila (progreso,
  hitos, insignia incluidas); el fichero sigue intacto en su carpeta.
- **Progreso y datos siempre en la base de datos** (`db/custom.db`), nunca
  junto a los ficheros.
- **Si mueves un libro** con el explorador de ficheros: al re-escanear, la
  app lo reconoce por su contenido (hash) si el destino está dentro de la
  carpeta y lo re-vincula solo; si se fue fuera, la tarjeta queda marcada
  **«sin fichero»** y te ofrece **re-vincularlo** escribiendo la ruta nueva —
  tu progreso no se pierde en ningún caso.
- **Título y autor** salen del nombre del fichero. Si prefieres ficha propia,
  pon al lado un fichero `<nombre>.ficha.txt` con el título en la primera
  línea y el autor en la segunda. Siempre puedes corregirlo desde la app
  («Editar ficha»).
- **Páginas totales**: los PDF se cuentan al escanear; los EPUB (y algún PDF
  raro de formato opaco) se cuentan al **primer abrir** — abre el libro una
  vez y ya queda registrado (en la base de datos, no en el fichero).
- **Subcarpetas**: el escaneo es recursivo; las carpetas ocultas (que
  empiezan por `.`) se ignoran.
- **En modo LAN / túnel**: la ruta es de la máquina que sirve la app. Si
  entras desde otro dispositivo, la app lee la carpeta del servidor.
