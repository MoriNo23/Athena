# Instalación

Hay **cuatro caminos**, todos con la misma app. Elige uno:

| Camino | Para quién | Esfuerzo |
|---|---|---|
| **[.deb](#1-instalador-deb-debianubuntu)** | Debian, Ubuntu, Mint | `sudo apt install` y listo |
| **[Tarball](#2-tarball-con-build-hecho)** | Cualquier Linux, sin ensuciar el sistema | Descomprimir y arrancar |
| **[Docker](#3-docker)** | Servidores, NAS, cajas siempre encendidas | `docker compose up -d` |
| **[Clon del repo](#4-clon-del-repo)** | Desarrollo o curiosidad | 4 comandos |

## Requisitos

- **[Bun](https://bun.sh)** (excepto en Docker): sustituye a Node y a npm —
  `curl -fsSL https://bun.sh/install | bash`. No necesitas instalar nada más.
- Un navegador (Chrome, Firefox, Edge… el que tengas).
- **Internet** solo para: instalar dependencias, la primera vez que uses el
  OCR (descarga los datos del idioma, ~1-2 MB, luego quedan en caché del
  navegador), el buscador de portadas y el diccionario. **Leer funciona sin
  internet.**

## 1. Instalador .deb (Debian/Ubuntu)

Descarga `athena_<versión>_amd64.deb` de
[releases](https://github.com/MoriNo23/Athena/releases) y:

```bash
sudo apt install ./athena_<versión>_amd64.deb   # app en /opt/athena + comando «athena»
athena init      # solo la primera vez: casa de datos + esquema
athena start     # → http://localhost:3000   (en tu red: athena start --lan)
```

Qué hace el paquete:

- Instala la app con **build de producción ya hecho** en `/opt/athena` y el
  CLI como `/usr/bin/athena`. No recompila nada al arrancar.
- Si detecta Bun, deja las dependencias instaladas; si no, te da la orden
  exacta para hacerlas después. Sin red o sin Bun, la instalación igualmente
  termina bien: nunca rompe el `apt`.
- **Tus datos NO van en el paquete**: viven en la casa de datos
  (`~/.local/share/athena`, personalizable con `ATHENA_HOME`). Actualizar =
  instalar el `.deb` nuevo encima; desinstalar (`sudo apt remove athena`) no
  toca ni un libro.
- El log del servidor va a `<casa>/server.log`.

## 2. Tarball con build hecho

En [releases](https://github.com/MoriNo23/Athena/releases) está
`Athena-<versión>-linux-x64.tar.gz`: descomprime, entra en la carpeta y sigue
el `COMO-ARRANCAR.txt` que viene dentro:

```bash
tar -xzf Athena-*-linux-x64.tar.gz && cd Athena-*-linux-x64
cat COMO-ARRANCAR.txt
```

Dentro: `bun install` → `./bin/athena init` → `./bin/athena start`. El build
de producción ya viene hecho: no recompila nada.

## 3. Docker

```bash
git clone https://github.com/MoriNo23/Athena && cd Athena
docker compose up -d --build
docker logs -f athena   # la primera vez muestra la contraseña si no pusiste ATHENA_PASSWORD
```

- Build con Bun y runtime con la salida `standalone` de Next servida por Node.
- `prisma db push` automático al arrancar: la primera vez crea la BD; en
  actualizaciones alinea el esquema sin borrar datos.
- **Volúmenes** (los datos sobreviven al contenedor): `athena-db` → `/app/db`
  y `athena-uploads` → `/app/public/uploads`.
- Actualizarse: `git pull && docker compose up -d --build`.

## 4. Clon del repo

```bash
git clone https://github.com/MoriNo23/Athena.git && cd Athena
cp .env.example .env    # una línea obligatoria (DATABASE_URL); ATHENA_PASSWORD es opcional
bun install             # instala todo y auto-genera el cliente de base de datos
bunx prisma db push     # crea la BD vacía (solo la primera vez)
bun run dev             # → http://localhost:3000
```

- `bun run dev` = desarrollo con recarga automática; para uso diario es más
  que suficiente. `bun run build` + `bun run start` = producción (opcional).
- Cada libro puede pesar hasta **200 MB**: `next.config.ts` sube el tope del
  proxy a 256 MB para que lleguen enteros; por encima, el API responde 413.
- La ruta `file:../db/custom.db` es relativa a `prisma/` y funciona en
  cualquier máquina sin editar nada.

## Siguiente paso

Sube un PDF o EPUB arrastrándolo a la biblioteca y abre
[la guía de lectura](guia-de-lectura.md). Si tu biblioteca va a crecer,
mira [biblioteca por carpeta](biblioteca-por-carpeta.md).
