# Solución de problemas

## Problemas frecuentes

| Síntoma | Remedio |
|---|---|
| La biblioteca no carga / error 500 en `/api/books` | `bunx prisma generate` y recargar (el `postinstall` ya lo previene; esto es por si algo revienta node_modules) |
| El puerto 3000 está ocupado | Cierra la otra instancia, o usa otro puerto: `bunx next dev -p 3001` |
| Error de base de datos al arrancar | Revisa que `.env` tiene `DATABASE_URL=file:../db/custom.db` y que la BD existe (si no: `bunx prisma db push`; con el CLI: `athena init`) |
| El OCR no carga el idioma | Necesita internet la primera vez; comprueba conexión y reintenta |
| Subo un PDF y dice «Ya está en tu biblioteca» | Anti-duplicados: mismo archivo y mismas páginas ya están subidos. Es aviso, no error |
| Ajuste un valor raro en `config.json` y «no pasa nada» | Es lo previsto: la app ignora valores inválidos y vuelve al default al arrancar |
| Un libro de la carpeta sale como «sin fichero» | Lo moviste fuera de la carpeta: muévelo de vuelta y re-escanea, o re-vincúlalo con su botón |
| Cambios en `prisma/schema.prisma` | `bun run db:push` para aplicarlos a la BD |
| El `.deb` instalado no arranca | Mira `~/.local/share/athena/server.log` y `athena doctor`; si falta Bun: `curl -fsSL https://bun.sh/install | bash` y `cd /opt/athena && sudo bun install --production` |

## Diagnóstico con el CLI

```bash
athena doctor   # bun, permisos, BD, uploads, build: qué falta y qué sobra
athena home     # las rutas resueltas de esta instalación
```

## Scripts de la mesa (clon del repo)

| Comando | Qué hace |
|---|---|
| `bun run dev` | Arranca en desarrollo (puerto 3000) |
| `bun run build` | Compila para producción |
| `bun run start` | Sirve la compilación de producción (puerto 3000) |
| `bun run lint` | Revisión de código con ESLint |
| `bun run db:push` | Aplica el esquema de Prisma a la BD |
| `bun run db:generate` | Regenera el cliente Prisma |
| `bun run db:reset` | ⚠️ BORRA la base de datos entera y la recrea vacía |

## Dónde vive cada cosa

```
~/.local/share/athena/   → la casa de datos (instalaciones nuevas)
  ├─ db/custom.db        → la base de datos (progreso, vocabulario, insignias)
  ├─ db/config.json      → tus ajustes (legible/editable a mano)
  ├─ db/athena-lock      → la contraseña autogenerada del candado (modo lan)
  ├─ uploads/            → tus PDFs/EPUBs subidos, portadas y fondos
  └─ server.log          → log del servidor
db/ + public/uploads/    → modo legacy (datos dentro del repo, se respetan)
.env                     → configuración del clon (DATABASE_URL, ATHENA_PASSWORD)
```

¿Nada de esto lo arregla? Abre un
[issue](https://github.com/MoriNo23/Athena/issues/new?template=bug_report.md)
con la salida de `athena doctor`.
