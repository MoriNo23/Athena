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
cp .env.example .env          # DATABASE_URL; ATHENA_PASSWORD opcional
bun install                   # genera el cliente Prisma (postinstall)
bunx prisma db push           # crea db/custom.db (solo la primera vez)
bun run build
bun run start:lan             # 0.0.0.0:3000 con candado
```

- `start` (normal): solo `127.0.0.1`, sin candado — para usarlo en el mismo equipo.
- `start:lan` (lan): `0.0.0.0`, con candado — para tablet/móvil/otro PC del WiFi.
- La contraseña autogenerada queda en `db/athena-lock` (no se regenera en cada boot).

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
- **Logs**: `docker logs athena` (o `server.log` en modo nativo).
- **Esquema de BD**: las actualizaciones hacen `db push` al arrancar; si un
  cambio pidiera recortar datos, Prisma lo avisa y pide confirmación — en
  Docker se ve en los logs y se arregla siguiendo la nota del release.
