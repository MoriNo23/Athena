# LEEME — instrucciones para usar la app

> Guía rápida de instalación y arranque. No es el ReadMe del proyecto: es el
> «cómo se enciende esta cosa» paso a paso.

## Qué es esto

Una app de lectura gamificada para PDFs y EPUBs: riel de progreso configurable,
insignias por libros terminados, lectura dual (PDF compañero sincronizado),
OCR para libros escaneados, diccionario, modo cinematográfico (la página se lee
a ritmo, letra a letra), modo inmersión sin márgenes e interfaz en español,
inglés o portugués. Todo corre en TU máquina, TU biblioteca es TUYA.

## Requisitos

- **[Bun](https://bun.sh)** instalado (`curl -fsSL https://bun.sh/install | bash`
  en Linux/macOS, o el instalador oficial en Windows). Bun sustituye a Node y
  a npm: no necesitas instalar nada más.
- Un navegador (Chrome, Firefox, Edge… el que tengas).
- **Internet** solo para: instalar dependencias, la primera vez que uses el
  OCR (descarga los datos del idioma, ~1-2 MB, luego quedan en caché del
  navegador), el buscador de portadas y el diccionario. **Leer funciona
  sin internet.**

## Arranque en 3 comandos

```bash
bun install      # instala todo y auto-genera el cliente de base de datos
bun run dev      # arranca la app en http://localhost:3000
```

Y abre **http://localhost:3000** en el navegador. Ya está. A leer.

> El `bun install` ejecuta automáticamente `prisma generate` (hay un gancho
> `postinstall` que lo hace solo). Si algún día la biblioteca de libros
> fallara con un error raro, el remedio manual es: `bunx prisma generate`.

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

Estos dos sitios guardan TODO tu estado — si vienen en tu descarga, tus
libros, progreso, insignias y ajustes aparecen solos:

| Ruta | Qué guarda |
|------|------------|
| `db/custom.db` | La base de datos: libros, progreso, sesiones, insignias |
| `public/uploads/` | Los PDFs/EPUBs, portadas y PDFs compañeros |

Situaciones especiales:

- **Tu copia no trae `db/custom.db`** (empiezas de cero): crea la BD vacía con
  `bunx prisma db push` y listo.
- **Tu copia no trae `.env`, o trae uno con una ruta tipo `/home/z/...` que no
  existe en tu máquina**: crea (o edita) el `.env` en la raíz para que tenga
  esta única línea:
  ```
  DATABASE_URL=file:../db/custom.db
  ```
  (Es una ruta relativa a la carpeta `prisma/`: apunta a `db/custom.db` de la
  raíz del proyecto. Funciona en cualquier carpeta o máquina sin editar nada.)
- **Copia de seguridad**: con copiar esas dos rutas a otro sitio lo tienes
  todo. Devolverlas = estado restaurado.

## Problemas frecuentes

| Síntoma | Remedio |
|---------|---------|
| La biblioteca no carga / error 500 en `/api/books` | `bunx prisma generate` y recargar (el `postinstall` ya lo previene, esto es por si algo revienta node_modules) |
| El puerto 3000 está ocupado | Cierra la otra instancia, o usa otro puerto: `bunx next dev -p 3001` |
| Error de base de datos al arrancar | Revisa que `.env` tiene `DATABASE_URL=file:../db/custom.db` y que `db/custom.db` existe (si no: `bunx prisma db push`) |
| El OCR no carga el idioma | Necesita internet la primera vez; comprueba conexión y reintenta |
| Subo un PDF y dice «Ya está en tu biblioteca» | Anti-duplicados: mismo archivo y mismas páginas ya están subidos. Es aviso, no error |
| Cambios en `prisma/schema.prisma` | `bun run db:push` para aplicarlos a la BD |

## Scripts de la mesa

| Comando | Qué hace |
|---------|----------|
| `bun run dev` | Arranca en desarrollo (puerto 3000) |
| `bun run build` | Compila para producción |
| `bun run start` | Sirve la compilación de producción (puerto 3000) |
| `bun run lint` | Revisión de código con ESLint |
| `bun run crap` | Medidor de complejidad CRAP (Uncle Bob) sobre `src/` |
| `bun run crap:changed` | Igual, solo archivos cambiados |
| `bun run db:push` | Aplica el esquema de Prisma a la BD |
| `bun run db:generate` | Regenera el cliente Prisma |
| `bun run db:reset` | ⚠️ BORRA la base de datos entera y la recrea vacía |

## Mapa del tesoro (dónde vive cada cosa)

```
db/custom.db          → la base de datos (tu progreso)
public/uploads/       → tus PDFs y portadas
.env                  → configuración (1 línea, ya viene lista)
prisma/schema.prisma  → estructura de la base de datos
src/                  → el código de la app
CRAPPER.md            → spec de calidad de código (presupuestos de complejidad)
graphify-out/graph.html → grafo de conocimiento del código (ábrela en el navegador)
worklog.md            → diario de caza de cada tarea hecha
scripts/              → utilidades y pruebas (no hacen falta para usar la app)
tools/crapper/        → herramienta de métricas (opcional, necesita Python)
```

## Resumen ultrarrápido

```bash
bun install
bun run dev
# → http://localhost:3000
```

¿Build? Solo si quieres modo producción. Sin prisa, sin paloma.
