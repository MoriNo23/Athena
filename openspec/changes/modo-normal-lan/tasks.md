# Tasks: modo-normal-lan

## 1. Punto de partida y mecanismos (probes baratos, sin código definitivo)

- [x] 1.1 Evidencia de la apertura actual: con `bun run dev` sin env, `dev.log` muestra `Network: http://<ip-lan>:3000` (exposición) y la matriz da 200 sin cookie en los endpoints de la casa.
- [x] 1.2 Confirmar el bind con `-H 127.0.0.1`: curl desde localhost responde y desde la IP LAN falla; con `-H 0.0.0.0` el log imprime la línea `Network:` (middleware de prueba, se quita).
- [x] 1.3 Confirmar que el runner de `bun run` aplica env-prefix inline (`ATENA_MODO=lan next dev ...` en package.json); si el runner se lo traga, ajustar el enfoque (wrapper mínimo) antes de escribir los scripts definitivos.

## 2. Código: modo por comando + contraseña autogenerada

- [x] 2.1 `package.json`: `dev`/`start` (y `lint` intactos) fija `ATENA_MODO=offline` + `-H 127.0.0.1`; nuevas `dev:lan`/`start:lan` con `ATENA_MODO=lan` + `-H 0.0.0.0`, manteniendo `tee dev.log`/`server.log` y el puerto 3000.
- [x] 2.2 `src/lib/access.ts`: `contraseñaEfectiva()` con la semántica del design §2 + `garantizaContraseña()`: archivo `db/atena-lock`, creación `wx` race-free con `mode 0o600`, reutilización si ya existe.
- [x] 2.3 `src/instrumentation.ts` (`register()`): banner de arranque con los tres casos del design §3 (lan-auto imprime la contraseña; lan-fija no; normal informa localhost).
- [x] 2.4 `src/middleware.ts` y `src/app/api/auth/login/route.ts` consumen `contraseñaEfectiva()`; mensaje 400 del login "solo local" (design §4); eliminar la sutileza del vacío=abierto de auth-api.

## 3. Verificación como usuario (matriz + browser)

- [x] 3.1 Matriz HTTP de tres escenarios: normal (todo 200 + login 400), lan-auto (401 sin cookie; login con la contraseña leída de `db/atena-lock` → cookie → 200), lan con `ATENA_PASSWORD` fija (idéntico al candado de auth-api); más el segundo arranque lan reutilizando la contraseña (cookie del navegador sigue válido).
- [x] 3.2 Sonda playwright de dos arranques: normal → biblioteca visible sin puerta; lan → lock visible al abrir, desbloquea con la contraseña del arranque, cards de vuelta, 0 errores reales de página/consola.

## 4. Sondas y documentación

- [x] 4.1 `scripts/with-dev.sh`: fuerza `ATENA_MODO=offline` (sustituye el forcing `ATENA_PASSWORD=""` del change anterior) y regresión de las sondas existentes en verde (matriz base + probe perf).
- [x] 4.2 `.env.example` (nota del candado y de los modos) + LEEME: bloque "¿Cómo arranco? — normal vs lan", contraseña generada al primer arranque lan, actualización de la nota HTTP/HTTPS/reverse proxy y del texto del candado opt-in que quedó desfasado.

## 5. Cierre

- [x] 5.1 `bun run lint` + `bunx tsc --noEmit` en verde.
- [ ] 5.2 Commits por palanca con la matriz antes/después en el mensaje y push.
