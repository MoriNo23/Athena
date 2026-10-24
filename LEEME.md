# LEEME — instrucciones para usar la app

> Guía rápida de instalación y arranque. No es el ReadMe del proyecto: es el
> «cómo se enciende esta cosa» paso a paso.

## Qué es esto

Una app de lectura gamificada para PDFs y EPUBs: riel de progreso configurable,
insignias por libros terminados, lectura dual (PDF compañero sincronizado),
OCR para libros escaneados, diccionario, modo teleprompter continuo (las páginas
se encadenan como un solo texto y se encienden letra a letra), modo texto
(el PDF se refluye con tipografías de lectura y páginas virtuales), modo
inmersión sin márgenes e interfaz en español, inglés o portugués. Todo corre en
TU máquina, TU biblioteca es TUYA.

## Requisitos

- **[Bun](https://bun.sh)** instalado (`curl -fsSL https://bun.sh/install | bash`
  en Linux/macOS, o el instalador oficial en Windows). Bun sustituye a Node y
  a npm: no necesitas instalar nada más.
- Un navegador (Chrome, Firefox, Edge… el que tengas).
- **Internet** solo para: instalar dependencias, la primera vez que uses el
  OCR (descarga los datos del idioma, ~1-2 MB, luego quedan en caché del
  navegador), el buscador de portadas y el diccionario. **Leer funciona
  sin internet.**

## Arranque en 4 comandos (clon limpio)

```bash
cp .env.example .env    # una línea obligatoria (DATABASE_URL); ATENA_PASSWORD es opcional
bun install             # instala todo y auto-genera el cliente de base de datos
bunx prisma db push     # crea la BD vacía en db/custom.db (solo la primera vez)
bun run dev             # arranca la app en http://localhost:3000
```

Y abre **http://localhost:3000** en el navegador. Sube un PDF o EPUB con
arrastrarlo a la biblioteca. Ya está. A leer.

> **¿Cómo arranco? — normal vs lan**
>
> - `bun run dev` (o `bun run start` tras build) → **modo normal**: escucha
>   solo en `127.0.0.1`; ningún otro equipo de la red puede conectar y la
>   biblioteca abre sin candado.
> - `bun run dev:lan` (o `bun run start:lan`) → **modo lan**: escucha en
>   `0.0.0.0` (tablet, otro PC del WiFi) y **con candado**: usa la
>   `ATENA_PASSWORD` del `.env` si la definiste; si no, Atena genera una al
>   primer arranque, te la muestra por terminal y la guarda en `db/atena-lock`
>   para que los reinicios no te la cambien (no se regenera en cada boot).
>
> Si defines `ATENA_PASSWORD`, el candado también actúa en modo normal. Es un
> candado ligero y no sustituye a HTTPS: la cookie viaja sin cifrar bajo HTTP,
> así que si expones la app a internet, ponla detrás de un reverse proxy con
> HTTPS (y opcionalmente con su propia autenticación).

> El `bun install` ejecuta automáticamente `prisma generate` (hay un gancho
> `postinstall` que lo hace solo). Si algún día la biblioteca de libros
> fallara con un error raro, el remedio manual es: `bunx prisma generate`.
>
> La ruta `file:../db/custom.db` es relativa a la carpeta `prisma/` (Prisma
> la resuelve desde ahí): apunta a `db/custom.db` de la raíz del proyecto y
> funciona en cualquier carpeta o máquina sin editar nada.

## ¿Tengo que hacer `bun run build`?

**NO.** Para usar la app te basta `bun install` + `bun run dev`.

- `bun run dev` = modo desarrollo: arranca tal cual, con recarga automática.
  Para uso personal diario es más que suficiente.
- `bun run build` + `bun run start` = modo producción (opcional): compila una
  vez y sirve la versión optimizada. Útil solo si quieres dejarla corriendo
  como servicio fijo. Ojo: usa el mismo puerto 3000, no puede estar `dev`
  ejecutándose a la vez.

```bash
bun run build    # compila (1-2 minutos, solo la primera vez y tras cambios)
bun run start    # sirve la versión compilada en http://localhost:3000
```

## Tu biblioteca viaja contigo

Estos tres sitios guardan TODO tu estado — si vienen en tu descarga, tus
libros, progreso, insignias y ajustes aparecen solos:

| Ruta | Qué guarda |
|------|------------|
| `db/custom.db` | La base de datos: libros, progreso, sesiones, insignias, vocabulario |
| `db/config.json` | Tus ajustes, en un fichero legible y editable a mano (más abajo) |
| `public/uploads/` | Los PDFs/EPUBs subidos, portadas y PDFs compañeros |

Situaciones especiales:

- **Tu copia no trae `db/custom.db`** (empiezas de cero): con el `.env` del
  paso anterior, `bunx prisma db push` crea la BD vacía y listo.
- **Tu copia trae un `.env` con una ruta tipo `/home/z/...` que no existe en
  tu máquina**: sustitúyelo por el `.env.example` (`cp .env.example .env`) o
  deja el archivo con esta única línea:
  ```
  DATABASE_URL=file:../db/custom.db
  ```
  (Es una ruta relativa a la carpeta `prisma/`: apunta a `db/custom.db` de la
  raíz del proyecto. Funciona en cualquier carpeta o máquina sin editar nada.)
- **Copia de seguridad**: con copiar esas dos rutas a otro sitio lo tienes
  todo. Devolverlas = estado restaurado.

## Tus ajustes en `db/config.json` (legible y a mano)

Tus ajustes de lectura (idioma, riel, filtros, lectura, inmersión,
teleprompter, modos del lector) viven en **`db/config.json`**, junto a la base
de datos. Es un JSON normal: puedes editarlo con cualquier editor, incluso con
la app cerrada.

- **El panel de ajustes sigue siendo el de siempre**: lo que toques ahí se
  escribe en el fichero (con un pequeño retraso, para no escribir 40 veces
  mientras arrastras un control).
- **Comentarios**: JSON no tiene comentarios, pero el fichero trae una clave
  `_doc` que explica cada bloque en castellano. La app la ignora al leer y la
  **conserva al escribir** — tus anotaciones sobreviven a cada cambio del
  panel. Puedes editarla a mano también.
- **Un valor inválido no te tumba la app**: si te inventas una opción que no
  existe, al arrancar vuelve a su valor por defecto; si te pasas de rango con
  un número (p. ej. 999 tramos), se queda en su límite razonable.
- **Instalación vieja**: si venías de una versión que guardaba los ajustes en
  el navegador (localStorage), el primer arranque los sube al fichero y a
  partir de ahí manda el fichero.
- **Qué NO vive aquí**: el vocabulario (tus palabras) y todo el progreso son
  datos: están en `db/custom.db`, protegidos con el resto.

Esquema (bloques de primer nivel; cada uno es un objeto con los mismos
nombres que ves en el panel):

```json
{
  "_doc": { "lang": "Idioma de la interfaz: \"es\", \"en\" o \"pt\"." },
  "lang": "es",
  "rail": { "position": "left", "segments": 10, "theme": "egeo", "showLabels": true, "celebrate": true },
  "filters": { "preset": "auto", "brightness": 100, "contrast": 100, "sepia": 0, "saturate": 100, "warmth": 0, "invert": 0 },
  "reading": { "dailyGoal": 20, "scrollStepPct": 40, "wheelBoost": 1, "font": "literata" },
  "immersion": { "enabled": true, "idleSeconds": 4, "toggleKey": "h" },
  "teleprompter": { "wps": 2.5, "instante": false, "sound": true, "auto": false, "fontScale": 1, "fondo": "tema", "fondoRuta": "", "fondoFiltro": 55, "tarjetasPorFrase": true },
  "modes": {
    "toggles": {
      "xray": true, "naturalPauses": false, "argumentSkeleton": false,
      "lockedNotes": false, "dualRead": false, "outline": true, "dictionary": true
    },
    "pauseMinutes": 25
  },
  "biblioteca": { "carpeta": "" }
}
```

## Biblioteca por carpeta (los libros en su sitio, sin copias)

Puede que subir libros uno a uno te canse. Si tienes una carpeta con tus PDFs
y EPUBs, **señálala una vez** y la app la registra entera:

1. En la biblioteca, pulsa **«Carpeta»**.
2. Escribe la **ruta absoluta** de la carpeta en la máquina que sirve la app
   (p. ej. `/home/maria/Biblioteca`) y pulsa **«Escanear»**.
3. Los libros aparecen solos, sin subir nada. **Nada se copia ni se mueve**:
   la app solo lee los ficheros donde ya estaban.
4. Cuando añadas o muevas libros, vuelve a pulsar **«Carpeta» → «Re-escanear»**:
   los nuevos entran, los que ya conocías no se duplican.

Garantías y detalles que conviene saber:

- **La app jamás escribe dentro de tus PDF/EPUB** ni los renombra, mueve o
  borra: son tuyos. «Quitar de la biblioteca» borra solo su fila (progreso,
  hitos, insignia incluidas); el fichero sigue intacto en su carpeta.
- **Progreso y data siempre en la base de datos** (`db/custom.db`), nunca
  junto a los ficheros.
- **Si mueves un libro** con el explorador de ficheros: al re-escanear, la app
  lo reconoce por su contenido (hash) si el destino está dentro de la carpeta
  y lo re-vincula solo; si se fue fuera, la tarjeta queda marcada
  **«sin fichero»** y te ofrece **re-vincularlo** escribiendo la ruta nueva —
  tu progreso no se pierde en ningún caso.
- **Título y autor** salen del nombre del fichero (`Mi libro favorito.pdf` →
  «Mi libro favorito»). Si prefieres ficha propia, pon al lado un fichero
  `<nombre>.ficha.txt` con el título en la primera línea y el autor en la
  segunda. Siempre puedes corregirlo desde la app («Editar ficha»).
- **Páginas totales**: los PDF se cuentan al escanear; los EPUB (y algún PDF
  raro de formato opaco) se cuentan al **primer abrir** — abre el libro una
  vez y ya queda registrado (en la base de datos, no en el fichero).
- **Subcarpetas**: el escaneo es recursivo; las carpetas ocultas (que empiezan
  por `.`) se ignoran.
- **En modo LAN / túnel**: la ruta es de la máquina que sirve la app. Si
  entras desde otro dispositivo, la app lee la carpeta del servidor.

## Problemas frecuentes

| Síntoma | Remedio |
|---------|---------|
| La biblioteca no carga / error 500 en `/api/books` | `bunx prisma generate` y recargar (el `postinstall` ya lo previene, esto es por si algo revienta node_modules) |
| El puerto 3000 está ocupado | Cierra la otra instancia, o usa otro puerto: `bunx next dev -p 3001` |
| Error de base de datos al arrancar | Revisa que `.env` tiene `DATABASE_URL=file:../db/custom.db` y que `db/custom.db` existe (si no: `bunx prisma db push`) |
| El OCR no carga el idioma | Necesita internet la primera vez; comprueba conexión y reintenta |
| Subo un PDF y dice «Ya está en tu biblioteca» | Anti-duplicados: mismo archivo y mismas páginas ya están subidos. Es aviso, no error |
| Ajuste un valor raro en `db/config.json` y «no pasa nada» | Es lo previsto: la app ignora valores inválidos y vuelve al default al arrancar |
| Un libro de la carpeta sale como «sin fichero» | Lo moviste fuera de la carpeta: muévelo de vuelta y re-escanea, o pulsa su botón de re-vincular y escribe la ruta nueva |
| Cambios en `prisma/schema.prisma` | `bun run db:push` para aplicarlos a la BD |

## Scripts de la mesa

| Comando | Qué hace |
|---------|----------|
| `bun run dev` | Arranca en desarrollo (puerto 3000) |
| `bun run build` | Compila para producción |
| `bun run start` | Sirve la compilación de producción (puerto 3000) |
| `bun run lint` | Revisión de código con ESLint |
| `bun run db:push` | Aplica el esquema de Prisma a la BD |
| `bun run db:generate` | Regenera el cliente Prisma |
| `bun run db:reset` | ⚠️ BORRA la base de datos entera y la recrea vacía |

## Mapa del tesoro (dónde vive cada cosa)

db/custom.db          → la base de datos (tu progreso, vocabulario)
db/config.json        → tus ajustes (legible/editable a mano)
public/uploads/       → tus PDFs y portadas
.env                  → configuración (1 línea, ya viene lista)
prisma/schema.prisma  → estructura de la base de datos
src/                  → el código de la app
```

## Resumen ultrarrápido

```bash
cp .env.example .env
bun install
bunx prisma db push
bun run dev
# → http://localhost:3000
```

¿Build? Solo si quieres modo producción. Sin prisa, sin paloma.

## Licencia

MIT — mira [`LICENSE`](LICENSE). Clona, modifica y auto-hospeda: tu
biblioteca es tuya.
