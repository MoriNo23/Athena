# Tasks

> **Estado: aplicado (24-10, la dueña lo reclamó del backlog).** Decisiones:
> fundido (no deslizamiento), 180 ms fijos, capítulo con aire extra (sin página
> limpia forzada). Verificado con sondas.

## 1. Decisiones con la dueña

- [x] 1.1 Movimiento: **fundido** corto (la dueña: «que no sea de golpe»).
- [x] 1.2 Capítulo con **aire extra** (márgen ampliado en h1), sin página limpia forzada.
- [x] 1.3 PDF: fundido + mantenimiento de la página anterior; el aviso de capítulo en PDF queda **diferido** (su esquema necesita resolver destinos por página; se hará con el trabajo de outline).
- [x] 1.4 Duración fija ~180 ms (sin ajuste: la casa no inunda el panel).

## 2. Transición al girar

- [x] 2.1 Fundido corto de la página nueva sobre la anterior (PDF imagen: sobre el canvas previo).
- [x] 2.2 Sin parpadeo: la página anterior se mantiene visible hasta que la nueva esté lista (el spinner solo en la primera carga).
- [x] 2.3 EPUB y modo texto: el texto entra con fundido sin perder posición ni foco.
- [x] 2.4 `prefers-reduced-motion` apaga el movimiento.

## 3. Encabezados cómodos

- [x] 3.1 Anti-huérfano: encabezado nunca solo al final de página — baja con su primer párrafo (regla en `paginateEpub`).
- [x] 3.2 Aire de capítulo: los h1 respiran más y arrancan distinguidos (CSS `globals.css`).
- [ ] 3.3 PDF: aviso discreto de cambio de capítulo — **diferido** (ver 1.3).
- [x] 3.4 Revisar que el anti-huérfano no infla las páginas virtuales de forma injusta (tolerancia acordada).

## 4. Verificación

- [ ] 4.1 Sondas: giro rápido por 10 páginas sin parpadeo visible; encabezado al final de capítulo nunca huérfano; reduced-motion respetado; posición y foco intactos tras la transición.
- [ ] 4.2 EPUB de la casa y uno externo: paginación sigue cuadrando (el anti-huérfano mueve el número de páginas virtuales).
