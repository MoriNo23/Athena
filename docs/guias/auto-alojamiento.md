# Auto-alojamiento

Athena es local-first de verdad: la biblioteca y la configuración viven en
ficheros locales y **leer no necesita red**. Esta página es el manual de
uso diario del servidor; el análisis técnico completo vive en
[`docs/SELFHOSTING.md`](../SELFHOSTING.md).

## Modos: normal vs lan

- **`athena start`** (o `bun run start` tras build) → **modo normal**:
  escucha solo en `127.0.0.1`; ningún otro equipo de la red puede conectar y
  la biblioteca abre sin candado.
- **`athena start --lan`** (o `start:lan`) → **modo lan**: escucha en
  `0.0.0.0` (tablet, otro PC del WiFi). Con candado: usa la
  `ATHENA_PASSWORD` del `.env` si la definiste; si no, Athena genera una al
  primer arranque, la muestra por terminal y la guarda en
  `<casa>/db/athena-lock` para que los reinicios no te la cambien.
- **¿Lan abierta sin candado?** `ATHENA_ABIERTO=1`: la biblioteca queda
  accesible para cualquiera que llegue a la dirección. Si defines una
  contraseña explícita (`ATHENA_PASSWORD` manda), la apertura no hace nada.
- Si defines `ATHENA_PASSWORD`, el candado también actúa en modo normal:
  toda la interfaz espera el login en `/login` y el navegador recuerda la
  sesión 30 días. Nombres viejos (`ATENA_PASSWORD`, `db/atena-lock`) se
  siguen leyendo.
- El candado es ligero y no sustituye a HTTPS: la cookie viaja sin cifrar
  bajo HTTP. Si expones la app a internet, ponla detrás de un reverse proxy
  con TLS (más abajo).

## La casa de los datos (ATHENA_HOME)

Una instalación nueva guarda TODO fuera del árbol del programa:

| Qué | Dónde (modo home) | Dónde (modo legacy) |
|---|---|---|
| BD SQLite | `<casa>/db/custom.db` | `db/custom.db` |
| Config, candado, papelera deshacer | `<casa>/db/` | `db/` |
| Libros subidos, portadas, fondos | `<casa>/uploads/` | `public/uploads/` |
| Log del servidor | `<casa>/server.log` | `server.log` |

`<casa>` = `ATHENA_HOME` si la defines, o `$XDG_DATA_HOME/athena`, o por
defecto `~/.local/share/athena`. Reglas (la primera que aplica):
`ATHENA_HOME` explícita → datos legacy en el repo (se respetan, nunca se
mueven solos) → Docker (el compose fija sus volúmenes) → default XDG.

¿Instalación antigua con los datos dentro del repo? Se respeta tal cual.
Para moverla a su casa:

```bash
./bin/athena migrate-home     # mueve db/ y public/uploads/ a la casa, sin tocar la BD
./bin/athena doctor           # comprueba que todo está en orden
```

## El CLI `athena`

| Comando | Qué hace |
|---|---|
| `athena init` | Crea la casa de datos y aplica el esquema (`migrate deploy`) |
| `athena start [--lan]` | Arranca Athena con los datos en su casa |
| `athena doctor` | Revisa bun, casa de datos, BD, uploads y permisos |
| `athena backup [dest]` | Copia de seguridad completa (db + uploads) en un tar.gz |
| `athena home` | Imprime las rutas resueltas de esta instalación |
| `athena migrate-home` | Mueve una instalación legacy a la casa de datos |

Con el `.deb` instalado, el comando está en el PATH; en un clon, usa
`./bin/athena` o `bun run athena`.

## Copias de seguridad

- Con el CLI: `athena backup` — tar.gz completo (BD + config + candado +
  ficheros) en `<casa>/backups/`.
- A mano: copia `<casa>/db/` y `<casa>/uploads/` (o las dos rutas del modo
  legacy). Devolverlas = estado restaurado.

## Exponer a internet con TLS (Caddy)

El repo trae `deploy/Caddyfile`. Para un dominio propio con HTTPS automático:

```caddy
tu-biblioteca.ejemplo.com {
    reverse_proxy 127.0.0.1:3000
}
```

1. **Pon siempre `ATHENA_PASSWORD`** (la autogenerada es robusta, pero la
   tuya la controlas tú).
2. Sirve el tráfico por **HTTPS** (Caddy lo resuelve solo con un dominio).
3. No publiques el puerto 3000 directamente: que el proxy TLS sea la puerta.
4. La regla de oro de una biblioteca personal: si no confías en la red, no
   la abras.

## Qué NO es (límites honestos)

- **No es multiusuario con cuentas**: un candado de entrada, no perfiles.
- **No sincroniza** instalaciones distintas (cada biblioteca es un mundo).
- OCR, diccionario y buscador de portadas son las únicas comodidades que
  pueden pedir red; sin internet, el resto funciona igual.
