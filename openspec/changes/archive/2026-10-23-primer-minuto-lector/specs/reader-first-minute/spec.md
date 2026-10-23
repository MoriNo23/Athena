# Spec Delta

## Purpose

Contract of the reader's first minute: what a first-time visitor sees when opening a book, what happens when the chrome auto-hides, and how the zoom control communicates its state. Any reader default change or first-run aid lands here.

## ADDED Requirements

### Requirement: Primera visita sin chrome invasivo

Al abrir el primer libro de una instalación sin preferencias guardadas, el lector muestra el texto de la página sin paneles por encima.

#### Scenario: Primer libro de la instalación
- **WHEN** una usuaria sin regla guardada para la visibilidad del dock abre cualquier libro
- **THEN** el dock de modos de lectura no está montado y la página es el único contenido
- **AND** el botón de «Ajustes» de la cabecera sigue accesible para pedir el dock

#### Scenario: La decisión del usuario manda después
- **WHEN** la usuaria abre o cierra el dock con su toggle
- **THEN** la elección persiste por dispositivo y se respeta en lecturas siguientes, incluida la primera página de la sesión

### Requirement: Pista única del auto-ocultado

La primera vez por dispositivo que el chrome del lector se oculta solo por inactividad, el sistema lo explica una vez y nunca más.

#### Scenario: Primera inmersión automática
- **WHEN** el chrome se auto-oculta por inactividad y el dispositivo no tiene la pista marcada como vista
- **THEN** aparece una pastilla autodesmontable, en el idioma de la casa, que explica que el chrome vuelve al mover el mouse
- **AND** la pastilla se retira sola a los pocos segundos o al despertar el chrome, y el dispositivo queda marcado (no se repite nunca)

#### Scenario: Ocultado manual por tecla
- **WHEN** el chrome se oculta con la tecla de inmersión manual
- **THEN** no se muestra la pista (el mouse no despierta el chrome en ese camino; la explicación sería falsa)

#### Scenario: Timing intacto
- **WHEN** la pista se muestra o ya se mostró
- **THEN** el tiempo de auto-ocultado del chrome no cambia

### Requirement: El zoom nombra su modo

El control de zoom comunica qué modo está activo, no un número derivado del visor.

#### Scenario: Modo óptima activo
- **WHEN** el ajuste activo es el encaje al ancho del visor
- **THEN** el disparador muestra el nombre del modo («Óptima» u equivalente i18n) y ese nombre se mantiene al redimensionar la ventana

#### Scenario: Escala manual
- **WHEN** la usuaria fija un zoom manual (pasos o alejar)
- **THEN** el disparador muestra el porcentaje de la escala elegida

#### Scenario: Página completa sin recorte
- **WHEN** un PDF real (no un artefacto de prueba defectuoso) se lee en modo óptima en cualquier ancho de visor
- **THEN** las líneas se leen completas sin paneo horizontal
