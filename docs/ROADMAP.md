# Roadmap — para que otros puedan montar su casa

Backlog vivo y ordenado de Athena, decidido con la dueña. El README queda como
puerta de entrada; este fichero es la lista de pendientes. Cada fase entra al
taller como un change de openspec cuando empieza.

## Norte (ya escrito en docs/PRODUCT.md)

Éxito = libros terminados. Nada que exija nube, nada de adorno. Dirección
elegida el 24-10-2026: **preparar Athena para que otros monten la suya**.

## Fase 0 — El candado cómodo (aquí y ahora)

- LAN sin contraseña a elección: `ATENA_PASSWORD` fija manda igual que hoy;
  si la dueña quiere abrir el modo lan, una opción del `.env` lo dice.
- Toda la interfaz se pausa hasta iniciar sesión: hoy la puerta solo cubre la
  parrilla de libros.
- La sesión sigue recordando en el navegador (cookie de 30 días, sin cambios).

## Fase 1 — Guardarraíles (red de seguridad)

- Primeiros tests de la casa (happy-dom ya está instalado): API de libros,
  riel, round-trip de `db/config.json`, candado de `access.ts`.
- `bun run lint` en verde y sin sorpresas.

Por qué va aquí: cada cambio que llegue a otros viaja hoy a ciegas.

## Fase 2 — La primera hora del otro

- Estado de biblioteca vacía con los dos caminos a la vista (arrastrar un PDF,
  botón «Carpeta»).
- `.env` y rutas a prueba de macOS/Windows (la ruta `file:../db/custom.db` ya
  es relativa; verificar el resto).
- LEEME sin trampas: los 4 comandos reales, sin pasos de repente.

## Fase 3 — Touch refinements

- Pendiente viejo del README fuera: el lector pensado en móvil/tablet
  (viewport, botones de dedo, scroll del teleprompter). El escritorio sigue
  mandando; touch no rompe nada de lo que ya funciona.
- Junto a otros pendientes viejos: escala de fuente por libro, sombras del
  tema claro.

## Fase 4 — El escaparate

- Demo en el README: GIF o vídeo corto con capturas reales.
- Prueba de instalación limpia en máquina ajena (el test de «4 comandos»).

## No es el camino

- Cualquier función que pida nube, cuentas o sincronización (contradice
  docs/PRODUCT.md).
- Paneles de métricas o gamificación de adorno.
- Demo alojada en la red.
