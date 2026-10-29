# reading-habit — Delta de especificación (feedback de hábito)

## ADDED Requirements

### Requirement: Lenguaje de estados de hábito
Todo indicador de hábito de la interfaz SHALL declararse en uno de tres estados —sin
empezar, en curso, meta cumplida— determinado por las páginas de hoy contra la meta efectiva
aplicable. Cada estado SHALL tener color, icono y microcopy fijos y coherentes en las tres
superficies (franja del inicio, tarjeta de libro, cabecera del lector) y en los tres idiomas.
El estado SHALL comunicarse sin depender solo del color (arco, icono o texto lo acompañan) y
los números SHALL presentarse con cifras tabulares. El anillo SHALL exponer su estado con un
aria-label descriptivo («N de M páginas leídas hoy; faltan K») y sin animación de llenado
bajo movimiento reducido.

#### Scenario: Un lenguaje en todas las superficies
- **WHEN** la dueña compara la franja del inicio, una tarjeta de libro y la cabecera del lector en un mismo día
- **THEN** los tres indicadores usan el mismo color, icono y microcopy para el estado que les corresponde

#### Scenario: Accesible sin color
- **WHEN** la franja muestra el estado «en curso»
- **THEN** el arco del anillo y el microcopy declaran el estado sin depender únicamente del color

## MODIFIED Requirements

### Requirement: Mínimo diario de lectura
El lector SHALL definir un mínimo diario de páginas (1–500) que rige como meta por defecto
de toda la biblioteca y se conserva entre sesiones. La franja de hábitos del inicio SHALL
mostrar las páginas leídas hoy en la biblioteca contra ese mínimo mediante un indicador
canónico (anillo de progreso con el par n/goal y estado del lenguaje de hábito), SHALL
señalar cuánto falta o si ya se cumplió, y SHALL mantener racha, minutos y libros terminados
como contexto secundario sin competir con la meta de hoy.

#### Scenario: Cumplimiento del mínimo
- **WHEN** las páginas leídas hoy en la biblioteca alcanzan el mínimo
- **THEN** la franja pasa al estado «meta cumplida» con el anillo completo y, mientras no lo alcance, indica cuántas páginas faltan

### Requirement: Resumen de hoy en las tarjetas del inicio
Cada tarjeta de libro del inicio SHALL mostrar el estado de hoy de ese libro —páginas y
minutos— contra la meta efectiva del libro mediante una píldora fija bajo el mini-riel,
visible sin interacción también en pantallas estrechas. Sin actividad hoy, la píldora SHALL
declarar el estado «sin empezar» («sin lectura hoy») sin inventar progreso. La tarjeta del
libro con lectura hoy SHALL distinguirse con el tratamiento de borde del design system.

#### Scenario: Tarjeta con actividad
- **WHEN** un libro tiene sesiones de lectura de hoy
- **THEN** su píldora muestra el estado y el par de hoy contra la meta efectiva de ese libro, y la tarjeta lleva el borde distintivo

#### Scenario: Tarjeta sin actividad
- **WHEN** un libro no tiene sesiones de lectura de hoy
- **THEN** su píldora declara «sin lectura hoy» y no muestra un resumen de progreso falso

#### Scenario: Legible sin hover en móvil
- **WHEN** la biblioteca se ve a 320 px de ancho
- **THEN** el par de hoy/meta de cada tarjeta es legible sin hover ni interacción adicional
