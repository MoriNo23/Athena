# Tasks

> **Estado: backlog (propuesta en espera de la dueña).** Antes del apply se
> cierran las 4 preguntas de la proposal. Nada implementado aún.

## 1. Decisiones con la dueña

- [ ] 1.1 Movimiento: fundido, deslizamiento (pasar hoja) o ambos a elegir.
- [ ] 1.2 Capítulo nuevo: página limpia siempre, o solo aire extra.
- [ ] 1.3 PDF: ¿basta fundido + aviso de capítulo, o también salto a capítulo desde el riel/índice?
- [ ] 1.4 Duración: fija (~180 ms) o ajuste en el panel de lectura.

## 2. Transición al girar

- [ ] 2.1 Fundido corto de la página nueva sobre la anterior (PDF imagen: sobre el canvas previo).
- [ ] 2.2 Sin parpadeo: la página anterior se mantiene visible hasta que la nueva esté lista (el spinner solo en la primera carga).
- [ ] 2.3 EPUB y modo texto: el texto entra con fundido sin perder posición ni foco.
- [ ] 2.4 `prefers-reduced-motion` apaga el movimiento.

## 3. Encabezados cómodos

- [ ] 3.1 Anti-huérfano: encabezado nunca solo al final de página — baja con su primer párrafo (regla en `paginateEpub`).
- [ ] 3.2 Aire de capítulo: los h1 respiran más y arrancan distinguidos (CSS `globals.css`).
- [ ] 3.3 PDF: aviso discreto de cambio de capítulo cuando el libro trae esquema (usa el outline existente).
- [ ] 3.4 Revisar que el anti-huérfano no infla las páginas virtuales de forma injusta (tolerancia acordada).

## 4. Verificación

- [ ] 4.1 Sondas: giro rápido por 10 páginas sin parpadeo visible; encabezado al final de capítulo nunca huérfano; reduced-motion respetado; posición y foco intactos tras la transición.
- [ ] 4.2 EPUB de la casa y uno externo: paginación sigue cuadrando (el anti-huérfano mueve el número de páginas virtuales).
