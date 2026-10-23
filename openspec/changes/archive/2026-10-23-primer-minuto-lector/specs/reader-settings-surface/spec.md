# Spec Delta

## Purpose

Contract of the reader's settings surface: which controls exist, where low-frequency actions live, and how persisted settings migrate when the surface shrinks. Any addition, removal or relocation of reader controls lands here.

## ADDED Requirements

### Requirement: Filtros de imagen solo por presets

El render visual de la página se controla con presets nombrados; no hay edición fina de filtros.

#### Scenario: Panel de ajustes sin sliders de filtro
- **WHEN** la usuaria abre la hoja de ajustes del riel
- **THEN** existen los presets nombrados de comodidad visual y no existen sliders de brillo, contraste, sepia, saturación, inversión ni calidez

#### Scenario: Migración de estado con filtro custom
- **WHEN** el estado guardado trae un preset `custom` de la versión anterior (v11)
- **THEN** sube a v12 convirtiéndolo en `auto` (sigue al tema) y sin error de arranque

### Requirement: Ajuste fino retirado con defaults de casa

Los controles de navegación fina no existen en la superficie; sus valores quedan fijados por la casa.

#### Scenario: Sin sliders de paso, rueda ni segundos de ocultado
- **WHEN** la usuaria abre la hoja de ajustes
- **THEN** no hay slider de paso de flecha, ni de refuerzo de rueda, ni de segundos de auto-ocultado
- **AND** el comportamiento usa los defaults de casa (40% del visor, rueda nativa, 4 s)

#### Scenario: Migración de tuning
- **WHEN** el estado guardado trae valores propios de paso/rueda/segundos (v11)
- **THEN** suben a v12 y vuelven a los defaults de casa

### Requirement: Acciones de baja frecuencia bajo el menú «⋯»

La cabecera del lector reserva su fila para lectura; las acciones de baja frecuencia viven en un único menú de desbordamiento.

#### Scenario: Vocabulario y ajustes del riel
- **WHEN** la usuaria abre el menú «⋯» de la cabecera
- **THEN** encuentra la entrada de vocabulario (con contador si lo hay) y la de ajustes del riel, ambas operativas

#### Scenario: Sin duplicado de progreso en el subtítulo
- **WHEN** se muestra la cabecera del lector
- **THEN** el subtítulo identifica libro y autor; el porcentaje de lectura lo porta el riel, no el subtítulo
