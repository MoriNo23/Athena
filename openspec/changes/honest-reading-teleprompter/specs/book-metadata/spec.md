# Spec Delta

## Purpose

Define cómo Athena completa la sinopsis de un libro a partir de su título y autor, la guarda localmente para leer sin conexión y la muestra en la biblioteca sin convertir la app en un servicio en la nube.

## ADDED Requirements

### Requirement: La sinopsis se busca sola cuando falta

El sistema SHALL buscar una sinopsis cuando el libro tenga título y su sinopsis esté vacía. El autor SHALL ser opcional: sin autor se busca solo por título. La búsqueda NO SHALL ejecutarse si ya hay sinopsis guardada.

#### Scenario: Libro nuevo con título y autor

- **WHEN** se guarda un libro con título y autor y sin sinopsis
- **THEN** el sistema intenta completar la sinopsis sin pedir permiso ni bloquear la interfaz

#### Scenario: Sinopsis ya guardada

- **GIVEN** el libro ya tiene sinopsis
- **WHEN** se vuelve a abrir o editar
- **THEN** no se lanza otra búsqueda automática

#### Scenario: Título sin autor

- **WHEN** el libro tiene título pero no autor
- **THEN** la búsqueda se hace solo por título

### Requirement: Fuentes públicas en orden y fallo silencioso

La búsqueda SHALL intentar primero Google Books y, si no devuelve descripción, OpenLibrary. SHALL usar un tiempo máximo de espera, NO SHALL reintentar en bucle y, ante error, timeout o sin resultados, SHALL dejar la sinopsis vacía sin mostrar un error al lector.

#### Scenario: Google Books responde

- **WHEN** Google Books devuelve una descripción
- **THEN** se usa esa descripción y no se consulta OpenLibrary

#### Scenario: Sin red

- **WHEN** no hay conexión
- **THEN** la biblioteca sigue funcionando y la sinopsis queda vacía

### Requirement: La sinopsis se guarda localmente y se lee offline

La sinopsis SHALL persistirse dentro de `extras` del libro, de modo que se lea sin conexión y sobreviva a reinicios. NO SHALL requerir una migración de esquema ni una columna nueva.

#### Scenario: Leer sin conexión

- **GIVEN** la sinopsis ya se descargó una vez
- **WHEN** se abre la biblioteca sin conexión
- **THEN** la sinopsis sigue visible

### Requirement: La edición manual manda

El lector SHALL poder editar o borrar la sinopsis. Una sinopsis editada manualmente NO SHALL ser reemplazada por una búsqueda automática posterior. Debe existir una acción explícita para volver a buscarla.

#### Scenario: Corregir la sinopsis

- **GIVEN** el lector edita la sinopsis de un libro
- **WHEN** guarda el cambio
- **THEN** ese texto se conserva y no se pisa solo

#### Scenario: Volver a buscar

- **WHEN** el lector pulsa la acción de buscar sinopsis de nuevo
- **THEN** se consulta la fuente y se propone el texto nuevo

### Requirement: La sinopsis se muestra sin romper la tarjeta

La biblioteca SHALL mostrar la sinopsis recortada a un máximo de dos líneas cuando exista, y NO SHALL reservar espacio cuando falte. La tarjeta SHALL mantener su altura y sus controles utilizables en móvil.

#### Scenario: Libro con sinopsis

- **WHEN** la tarjeta se pinta con sinopsis
- **THEN** muestra como máximo dos líneas y el resto queda recortado

#### Scenario: Libro sin sinopsis

- **WHEN** la tarjeta se pinta sin sinopsis
- **THEN** no aparece un hueco vacío ni un texto de relleno

### Requirement: La búsqueda respeta el contrato local-first

La búsqueda SHALL enviar solo título y autor a la fuente pública, NO SHALL enviar datos de lectura, NO SHALL usar cuentas ni telemetría y NO SHALL cambiar el contrato `{ ok, data?, error? }` de la API ni su espejo offline.

#### Scenario: Sin cuentas ni telemetría

- **WHEN** se busca una sinopsis
- **THEN** la petición solo contiene el título y el autor del libro

#### Scenario: Mismo contrato en web y APK

- **WHEN** se guarda la sinopsis
- **THEN** web y motor offline la aceptan dentro de `extras` con la misma forma
