# Spec Delta

## Purpose

Define cuándo una página cuenta como leída y cómo se separa ese hecho de la posición de lectura, para que racha, meta diaria, ETA e insignias reflejen lectura real y no navegación.

## ADDED Requirements

### Requirement: Una página cuenta al terminarla, no al entrar en ella

El sistema SHALL registrar una página como leída solo cuando exista una señal de finalización: el flujo del teleprompter alcanza su última línea visible, o la página permanece como página actual durante el dwell mínimo con la pestaña visible. Entrar en una página, saltar con el riel, usar el carrusel o sincronizar NO SHALL sumar páginas.

#### Scenario: Lectura manual de una página completa

- **GIVEN** el lector está en la página 7 con la pestaña visible
- **WHEN** permanece en ella al menos el dwell mínimo
- **THEN** la página 7 suma una página leída aunque no gire a la siguiente

#### Scenario: Hojeo rápido no cuenta

- **GIVEN** el lector está en la página 7
- **WHEN** gira a la página 8 antes de cumplir el dwell mínimo
- **THEN** la página 7 no suma páginas leídas

#### Scenario: Salto silencioso no cuenta

- **WHEN** el lector salta de la página 7 a la 30 con el riel, el carrusel o una sincronización
- **THEN** no se suman páginas leídas por el tramo saltado

### Requirement: El conteo es idempotente por página y sesión

Una misma página SHALL sumar como máximo una vez por sesión de lectura, aunque el lector rebobine, vuelva a entrar o reciba varias señales de finalización.

#### Scenario: Rebobinar y releer

- **GIVEN** la página 7 ya sumó en esta sesión
- **WHEN** el lector rebobina a la 7 y la vuelve a terminar
- **THEN** el contador de páginas leídas no vuelve a subir por la página 7

#### Scenario: Dos señales para la misma página

- **GIVEN** el teleprompter marca la página 7 al llegar a su última línea
- **WHEN** el dwell mínimo también se cumple en la página 7
- **THEN** la página 7 sigue contando una sola vez

### Requirement: La posición de lectura no implica páginas leídas

`currentPage` SHALL seguir representando la posición para el riel, la ETA y los hitos, y SHALL guardarse con el mismo contrato actual. Las páginas leídas SHALL ser un contador independiente que no se deriva del delta de `currentPage`.

#### Scenario: Guardar progreso sin inflar páginas

- **WHEN** el lector gira de la página 7 a la 8 antes de terminar la 7
- **THEN** el progreso guarda `currentPage: 8` y `pagesRead` no aumenta

### Requirement: La unidad contada es la que el lector ve

Cada formato SHALL contar la unidad de página que muestra al lector: hoja real en el modo página del PDF, página virtual del reflujo en el modo texto y página virtual del EPUB. Una página virtual terminada en el modo texto SHALL contar aunque su página real de origen no cambie.

#### Scenario: Varias páginas virtuales de una hoja real

- **GIVEN** una hoja de PDF se refluye en tres páginas virtuales
- **WHEN** el lector termina la primera página virtual
- **THEN** suma una página leída, sin esperar a cruzar la hoja real

### Requirement: El contador de hoy sube al marcar, no al navegar

El par «hoy» del libro SHALL actualizarse en el momento en que una página se marca como leída, y SHALL usar la misma cifra para la cabecera del lector, la cabecera del teleprompter y el aviso de página leída.

#### Scenario: Cabecera viva

- **WHEN** una página se marca como leída
- **THEN** el contador «hoy» del libro sube en la misma interacción, sin recargar

### Requirement: El contrato de la API no cambia

El guardado SHALL seguir usando `PATCH /api/books/:id` con `pagesRead`, `minutes` y `currentPage`, y SHALL mantener la respuesta `{ ok, data?, error? }` y su espejo en el motor offline.

#### Scenario: Mismo contrato en web y APK

- **WHEN** se guarda una sesión con páginas leídas
- **THEN** la web y el motor offline aceptan el mismo cuerpo y devuelven la misma forma de respuesta
