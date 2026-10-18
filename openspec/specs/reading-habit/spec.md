# reading-habit Specification

## Purpose

El hábito de lectura hecho visible y configurable: un mínimo diario global, una meta propia por libro que lo hereda, y el avance de hoy del libro —en el lector y en el inicio.

## Requirements

### Requirement: Mínimo diario de lectura
El lector SHALL definir un mínimo diario de páginas (1–500) que rige como meta por defecto de toda la biblioteca y se conserva entre sesiones. La franja de hábitos del inicio SHALL mostrar las páginas leídas hoy en la biblioteca contra ese mínimo, y SHALL señalar cuánto falta o si ya se cumplió.

#### Scenario: Ajuste del mínimo
- **WHEN** el lector cambia el mínimo diario en los ajustes
- **THEN** el mínimo persiste entre sesiones y la franja del inicio y la meta por defecto de los libros lo reflejan

#### Scenario: Cumplimiento del mínimo
- **WHEN** las páginas leídas hoy en la biblioteca alcanzan el mínimo
- **THEN** la franja del inicio lo señala como cumplido y, mientras no lo alcance, indica cuántas páginas faltan

### Requirement: Meta propia por libro
Cada libro SHALL poder fijar su propia meta diaria de páginas. Sin meta propia, el libro SHALL heredar el mínimo diario global. La meta efectiva SHALL regir el avance del día tanto en la cabecera del lector como en las tarjetas del inicio, y SHALL viajar en el respaldo de la base como el resto de la ficha.

#### Scenario: Herencia del mínimo
- **WHEN** un libro no tiene meta propia y el lector cambia el mínimo diario global
- **THEN** la meta efectiva de ese libro cambia con el mínimo

#### Scenario: Meta propia fijada
- **WHEN** se le fija meta propia a un libro
- **THEN** solo ese libro la usa, el resto de la biblioteca no cambia, y la meta persiste al cerrar y volver a abrir la app

#### Scenario: Se retira la meta propia
- **WHEN** se quita la meta propia de un libro
- **THEN** el libro vuelve a heredar el mínimo diario global

### Requirement: Meta por libro editable en lector e inicio
La meta propia SHALL poder ajustarse durante la lectura, en la sección de hábito de los ajustes del lector, junto a los hitos propios del libro, y SHALL poder fijarse o retirarse desde la ficha editable que abren las tarjetas del inicio. El valor SHALL limitarse al rango de 1–500 páginas.

#### Scenario: Ajuste en el lector
- **WHEN** el lector activa la meta propia de este libro desde los ajustes del lector y elige un valor
- **THEN** la meta efectiva del libro queda fijada al valor elegido y el control lo muestra

#### Scenario: Ajuste desde el inicio
- **WHEN** el lector edita la ficha de un libro desde su tarjeta y fija o retira la meta propia
- **THEN** la tarjeta refleja la meta efectiva resultante al volver

#### Scenario: Fuera de rango
- **WHEN** se introduce un valor de meta fuera de 1–500 páginas
- **THEN** el valor se rechaza o se limita al extremo válido más cercano

### Requirement: Páginas de hoy del libro en la cabecera del lector
La cabecera del lector SHALL mostrar las páginas que el conteo del hábito registra hoy para **este** libro contra su meta efectiva, y SHALL actualizarse durante la sesión sin recargar. La racha SHALL seguir siendo global y los minutos SHALL seguir siendo de la sesión activa. Los saltos silenciosos (riel, saltador de página, sincronización) SHALL seguir sin contar como leídos.

#### Scenario: Conteo en vivo
- **WHEN** el lector avanza páginas durante la sesión actual
- **THEN** el par de hoy del libro en la cabecera sube sin recargar la página

#### Scenario: Cambio de libro
- **WHEN** el lector abre otro libro
- **THEN** la cabecera muestra las páginas de hoy y la meta efectiva de ese libro, no las del anterior

#### Scenario: Salto silencioso
- **WHEN** el lector salta de página por el riel o por la sincronización
- **THEN** el conteo de hoy del libro no lo registra como página leída

### Requirement: Resumen de hoy en las tarjetas del inicio
Cada tarjeta de libro del inicio SHALL mostrar el resumen de actividad de hoy —páginas y minutos— junto al avance hacia la meta efectiva del libro. Sin actividad hoy, la tarjeta SHALL declararlo sin inventar progreso (por ejemplo, sin resumen o con «sin lectura hoy»).

#### Scenario: Tarjeta con actividad
- **WHEN** un libro tiene sesiones de lectura de hoy
- **THEN** su tarjeta muestra las páginas y minutos de hoy y el avance hacia la meta efectiva

#### Scenario: Tarjeta sin actividad
- **WHEN** un libro no tiene sesiones de lectura de hoy
- **THEN** su tarjeta no muestra un resumen de progreso falso
