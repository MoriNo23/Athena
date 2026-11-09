# Roadmap — para que otros puedan montar su casa

Backlog vivo y ordenado de Athena, decidido con la dueña. El README queda como
puerta de entrada; este fichero es la lista de pendientes. Cada fase entra al
taller como un change de openspec cuando empieza.

## Norte (ya escrito en docs/PRODUCT.md)

Éxito = libros terminados. Nada que exija nube, nada de adorno. Dirección
elegida el 24-10-2026: **preparar Athena para que otros monten la suya**.

## Hecho (en orden, con su change de openspec)

- Candado cómodo y login de casa completa (`candado-completo-y-athena`).
- Guardarraíles: primeros tests de la casa, lint en verde.
- Primera hora del otro: biblioteca vacía con dos caminos, rutas a prueba de
  macOS/Windows, README sin trampas.
- Touch refinado: lector pensado en móvil/tablet, escala por libro, tema claro.
- Escaparate: docs de uso en español (`docs/INDICE.md` + `docs/guias/`,
  sin LEEME) y README en inglés (`94b6e1a`).
- Núcleo único de la casa: reglas y contratos en `src/core/`, sin Next ni
  Prisma dentro; el pegamento vive en `src/lib/` (`ae13d0d`).
- Copia de la casa: pull/push manual de biblioteca y progreso por LAN entre
  tus propios dispositivos — APK offline incluido (**Enmienda 1** de
  PRODUCT.md, `f57754b`).
- Salida standalone que vale por sí sola: `.next/standalone` completa (cierre
  de Prisma + `start.sh`), paquete solo-Node con `bin/athena bundle`, imagen
  Docker alineada y arranque fresco arreglado (`568b93d`).

## En el taller (pendiente real)

- Probar el sync LAN de verdad en el teléfono de la dueña contra su servidor
  (checklist 11-12 de `docs/APK-OFFLINE.md`) — requiere el APK del próximo
  release.
- Publicar `athena-standalone-<versión>.tar.gz` en la página de releases
  junto al APK y el `.deb` (tarea 4.5 de `salida-standalone`).
- Demo en el README: GIF o vídeo corto con capturas reales.
- Prueba de instalación limpia en máquina ajena (el test de «4 comandos» ya
  pasó en sandbox con entorno limpio: dev y build/start — falta la máquina
  ajena de verdad).

## No es el camino

- Cualquier función que pida nube, cuentas o telemetría (contradice
  docs/PRODUCT.md).
- Sincronización como servicio: la copia entre dispositivos propios es
  manual, por LAN y a petición (Enmienda 1); nada de sync automático en la
  nube ni entre instalaciones de gente distinta.
- Paneles de métricas o gamificación de adorno.
- Demo alojada en la red.
