# Athena — documentación

**Athena** es una app de lectura local-first para PDFs y EPUBs con una idea
clara: **el producto es la última página**. Riel de progreso segmentado, racha
de lectura, ETA honesta, insignias por libros terminados, lectura dual con PDF
compañero, OCR, diccionario y modo teleprompter. Todo corre en TU máquina,
TU biblioteca es TUYA: **sin nube, sin cuentas, sin telemetría**.

- Descargas: [releases](https://github.com/MoriNo23/Athena/releases) —
  instalador `.deb`, tarball Linux con build incluido y APK Android offline.
- Código y puerta pública (inglés): [README del repo](https://github.com/MoriNo23/Athena).
- Documentación de la casa (constitución, seguridad, auto-alojamiento): [docs/ de este repo](https://github.com/MoriNo23/Athena/tree/main/docs).
- Problemas e ideas: [issues](https://github.com/MoriNo23/Athena/issues).

## Mapa de la documentación

| Página | Qué encuentras |
|---|---|
| [Instalación](instalacion.md) | Los cuatro caminos: `.deb`, tarball, Docker y clon del repo |
| [Guía de lectura](guia-de-lectura.md) | Riel, racha, insignias, teleprompter, inmersión, OCR, diccionario |
| [Biblioteca por carpeta](biblioteca-por-carpeta.md) | Registra una carpeta entera sin subir nada: garantías y detalles |
| [Ajustes](ajustes.md) | `db/config.json`: tus ajustes en un fichero legible y editable a mano |
| [Auto-alojamiento](auto-alojamiento.md) | Modos normal/lan, candado, casa de datos, CLI `athena`, Caddy, backups |
| [Copiar con el ordenador](sincronizar.md) | La copia de la casa: biblioteca y progreso entre el APK y el servidor por la red de casa |
| [APK Android](apk-android.md) | La versión offline para el teléfono y cómo se compila |
| [Solución de problemas](solucion-de-problemas.md) | Síntomas, remedios y los scripts de la mesa |

## Documentación de la casa

| Fichero | Qué es |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | La constitución del producto (plataforma, usuarios, principios, enmiendas) |
| [`SECURITY.md`](SECURITY.md) | Riesgo del keystore público del APK y sus mitigaciones |
| [`SELFHOSTING.md`](SELFHOSTING.md) | Análisis técnico del auto-alojamiento (Docker, TLS, límites honestos) |
| [`APK-OFFLINE.md`](APK-OFFLINE.md) | Guía completa del APK Android offline |
| [`ROADMAP.md`](ROADMAP.md) | El camino del producto, fase a fase |

## Arranque ultrarrápido

**Debian/Ubuntu/Mint** — descarga `athena_<versión>_amd64.deb` de
[releases](https://github.com/MoriNo23/Athena/releases) y:

```bash
sudo apt install ./athena_<versión>_amd64.deb
athena init      # solo la primera vez: casa de datos + esquema
athena start     # → http://localhost:3000
```

**Cualquier Linux/macOS con Bun** — clon del repo:

```bash
cp .env.example .env && bun install && bunx prisma db push && bun run dev
# → http://localhost:3000
```

Sube un PDF o EPUB arrastrándolo a la biblioteca. Ya está. A leer.
