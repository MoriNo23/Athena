# Spec Delta

## ADDED Requirements

### Requirement: Páginas de hoy del libro en el teleprompter
La barra superior del teleprompter SHALL mostrar las páginas que el conteo del hábito registra hoy para este libro contra su meta efectiva —el mismo conteo que la cabecera del lector—, actualizándose durante la sesión sin recargar.

#### Scenario: Conteo en vivo en el teleprompter
- **WHEN** el lector avanza páginas con el teleprompter abierto
- **THEN** el par de hoy del libro en la barra sube sin recargar la página

#### Scenario: Teleprompter de otro libro
- **WHEN** el lector abre el teleprompter de otro libro
- **THEN** la barra muestra las páginas de hoy y la meta efectiva de ese libro, no las del anterior
