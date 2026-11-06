# Self-hosting de Athena — análisis y guía

> Revisión de si la app se puede autoalojar y si es práctico hacerlo
> (petición de la casa). Respuesta corta: **sí se puede y ya lo es**: no hay
> ningún servicio externo obligatorio, la biblioteca y la configuración viven
> en ficheros locales, y con Docker queda una sola orden.

## 1. Veredicto: ¿se puede? ¿es práctico?

| Pregunta | Respuesta | Por qué |
|---|---|---|
| ¿Alguna nube obligatoria? | **No** | Libros, portadas y fondos se guardan en disco (`public/uploads/`, carpeta de biblioteca); la BD es **SQLite** (`db/custom.db` vía Prisma); la config vive en `db/config.json`. |
| ¿Servicios externos en runtime? | **Opcionales** | Solo tres funciones salen a internet si tú quieres: OCR la primera vez (datos de idioma al caché del **navegador**), el buscador de portadas y el diccionario. **Leer no necesita red.** |
| ¿Requisitos de máquina? | **Mínimos** | Cualquier caja con 1 vCPU y 1 GB de RAM sobra: es un servidor de ficheros + renderizado del lado cliente. PDFs de hasta 200 MB pasan por el API (tope 256 MB del proxy). |
| ¿Práctico hoy, sin tocar nada? | **Sí** | `bun install && bunx prisma db push && bun run build && bun run start:lan` — y con el `Dockerfile` incluido, `docker compose up -d` y listo. |
| ¿Multiusuario? | **Uno (la dueña) + invitados** | El candado (`ATHENA_PASSWORD`) protege la entrada en modo lan; no hay cuentas múltiples ni sincronización entre installs — es una biblioteca por instalación. |

Conclusión: Athena es **local-first de verdad** — el self-hosting no es un
añadido, es su estado natural. Lo único que faltaba para que fuera
práctico de golpe (imagen Docker, volúmenes, despliegue tras proxy) es lo
que trae este change.

## 2. Camino rápido: Docker (recomendado)

```bash
git clone https://github.com/MoriNo23/Athena && cd Athena
docker compose up -d --build
docker logs -f athena        # la primera vez muestra la contraseña si no pusiste ATHENA_PASSWORD
```

Abre `http://<tu-servidor>:3000`. Qué incluye la imagen:

- **Build con Bun** (el gestor de la casa), **runtime con la salida
  `standalone` de Next 16** servida por Node: imagen ligera y sin sorpresas.
- **`prisma db push` automático al arrancar**: la primera vez crea la BD; en
  actualizaciones alinea el esquema sin borrar datos.
- **Volúmenes** (los datos sobreviven al contenedor y a las actualizaciones):
  - `athena-db` → `/app/db` (SQLite, `config.json`, candado `athena-lock`)
  - `athena-uploads` → `/app/public/uploads` (libros subidos, portadas, fondos)

Actualizarse es `git pull && docker compose up -d --build`. Copia de
seguridad: para los dos volúmenes (o montalos sobre carpetas del host en el
`compose` si prefieres rsync directo).

## 3. Camino sin Docker (Bun nativo)

```bash
bun install                   # genera el cliente Prisma (postinstall)
./bin/athena init             # casa de datos (~/.local/share/athena) + esquema
./bin/athena start --lan      # 0.0.0.0:3000 con candado
```

- `athena start` (normal): solo `127.0.0.1`, sin candado — para el mismo equipo.
- `athena start --lan`: `0.0.0.0`, con candado — para tablet/móvil/otro PC del WiFi.
- La contraseña autogenerada queda en `<casa>/db/athena-lock` (no se regenera en cada boot).
- El método clásico sigue funcionando (`cp .env.example .env && bun run build && bun run start`):
  sin `ATHENA_HOME`, si `db/custom.db` ya existe en el repo se usa como siempre.

### La casa de los datos (ATHENA_HOME)

Desde el change `athena-home-cli`, una instalación nueva guarda TODO fuera del
árbol del programa:

| Qué | Dónde (modo home) | Dónde (modo legacy, dentro del repo) |
|---|---|---|
| BD SQLite | `<casa>/db/custom.db` | `db/custom.db` |
| Config (`config.json`), candado, papelera deshacer | `<casa>/db/` | `db/` |
| Libros subidos, portadas, fondos | `<casa>/uploads/` | `public/uploads/` |
| Log del servidor (`athena start`) | `<casa>/server.log` | `server.log` |

`<casa>` = `ATHENA_HOME` si la defines, o `$XDG_DATA_HOME/athena`, o por defecto
`~/.local/share/athena`. Reglas de resolución (primera que aplica): `ATHENA_HOME`
explícita → datos legacy en el repo (se respetan, nunca se mueven solos) → Docker
(el compose fija sus volúmenes) → default XDG. El código vive en
`src/lib/data-home.ts`; el CLI en `bin/athena` comparte la misma lógica.

¿Instalación antigua con los datos dentro del repo? Se respeta tal cual. Para
moverla a su casa (recomendado antes de una actualización de versión):

```bash
./bin/athena migrate-home     # mueve db/ y public/uploads/ a la casa, sin tocar la BD
./bin/athena doctor           # comprueba que todo está en orden
```

## 3a. Camino paquete .deb (Debian/Ubuntu)

Para las máquinas Debian/Ubuntu/Mint hay instalador `.deb` en la página de
releases (`athena_<versión>_amd64.deb`):

```bash
sudo apt install ./athena_<versión>_amd64.deb
athena init      # primera vez: casa de datos + esquema (migrate deploy)
athena start     # → http://localhost:3000  (en tu red: athena start --lan)
```

Qué hace el paquete:

- **App en `/opt/athena`** con el build de producción dentro, y el CLI como
  `/usr/bin/athena` (symlink). No recompila nada al arrancar.
- **postinst**: si detecta Bun, deja las dependencias de producción
  instaladas (`bun install --production`); si no, imprime la orden exacta
  para hacerlas después. Sin red o sin Bun la instalación igualmente
  termina bien: nunca rompe el `apt`.
- **Los datos NO van en el paquete**: la biblioteca vive en la casa de
  datos (`~/.local/share/athena` o `ATHENA_HOME`), así que actualizar
  (instalar el `.deb` encima) y desinstalar (`sudo apt remove athena`)
  no toca ni un libro. El `postrm` limpia solo `/opt/athena`.
- **Logs**: `athena start` escribe el log del servidor en la casa de datos
  (`<casa>/server.log`) porque `/opt` es del root y la app corre con tu
  usuario. En modo legacy el log sigue siendo el `server.log` del repo.

## 3b. Mantenimiento con el CLI

- `./bin/athena backup [dest]` — tar.gz completo (BD + config + candado + ficheros).
- `./bin/athena doctor` — bun, permisos, BD, uploads, build: qué falta y qué sobra.
- `./bin/athena home` — imprime las rutas resueltas de esta instalación.

## 4. Exponer a internet con TLS (Caddy)

El repo ya trae `deploy/Caddyfile` (proxy simple a `localhost:3000`). Para
un dominio propio con HTTPS automático, un Caddy delante basta:

```caddy
tu-biblioteca.ejemplo.com {
    reverse_proxy 127.0.0.1:3000
}
```

Notas de seguridad si abres fuera de tu red:

1. **Pon siempre `ATHENA_PASSWORD`** (la autogenerada es robusta, pero la
   tuya la controlas tú).
2. Sirve el tráfico por **HTTPS** (Caddy lo resuelve solo con un dominio).
3. No publiques el puerto 3000 directamente: que el proxy TLS sea la puerta.
4. La app no sube ejecutables ni sirve rutas arbitrarias del disco (solo
   `basenames` de `/uploads/` en el fondo, y libros desde su registro en BD),
   pero la regla de oro de una biblioteca personal aplica: si no confías en
   la red, no la abras.

## 5. Qué NO es (límites honestos)

- **No es multiusuario con cuentas**: un candado de entrada, no perfiles.
- **No sincroniza** instalaciones distintas (cada biblioteca es un mundo).
- El OCR depende del navegador (tesseract wasm): en servidores no cambia nada
  porque corre en el cliente; sin internet la primera vez, OCR pendiente de
  caché, el resto funciona.
- Diccionario y buscador de portadas piden a servicios externos; si tu
  instalación no sale a la red, esas dos comodidades se apagan solas.

## 6. Mantenimiento

- **Backup**: para `athena-db` (BD + config + candado) y `athena-uploads`
  (ficheros). Con volúmenes con nombre:
  `docker run --rm -v athena-db:/data -v "$PWD":/bk alpine tar czf /bk/athena-db.tgz -C /data .`
- **Logs**: `docker logs athena` (o `<casa>/server.log` en modo nativo; `server.log` del repo en modo legacy).
- **Esquema de BD**: las actualizaciones hacen `db push` al arrancar; si un
  cambio pidiera recortar datos, Prisma lo avisa y pide confirmación — en
  Docker se ve en los logs y se arregla siguiendo la nota del release.
