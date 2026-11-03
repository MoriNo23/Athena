# teleprompter — Delta de especificación (solo continuo)

## MODIFIED Requirements

### Requirement: Encadenado de páginas
El cruce de página virtual SHALL NOT ser un evento: al agotar la página con
Auto el flujo SHALL continuar a ritmo normal —sin pausa de giro, sin animación
de columna y sin aviso flotante— y la posición de lectura SHALL conservarse
con el ancla atómica del cruce. El indicador de página de la cabecera sigue
siendo verdad, pero nada SHALL anunciar ni celebrar el cruce. Sin Auto, el
modo SHALL detenerse al final de la página y esperar la señal del lector
(`Shift+→`) para pasar de página; el cruce autorizado SHALL ejecutarse sin
animación ni pausa. La única espera conservada al agotar la página es la del
revelado INSTANTÁNEO con Auto (2 s): ahí no hay ritmo de letras que proteger.

#### Scenario: Auto encadenado
- **WHEN** Auto está activo y el encendido alcanza el final de la página con páginas restantes
- **THEN** el flujo continúa con la página siguiente tras el retardo normal del carácter, sin pausa de 2 s, sin aviso y sin animación, y el carácter donde se reanuda queda donde estaba en pantalla

#### Scenario: Sin salto ni reacomodo en el cruce
- **WHEN** el cruce intercambia la ventana (página actual + siguiente)
- **THEN** el ancla atómica deja el texto en su posición visual —no aparece espacio en blanco entre páginas ni reacomodo de columna— y pausar y reanudar funciona inmediatamente

#### Scenario: Cambio manual sin espera
- **WHEN** el lector pulsa `Shift+→` antes de que termine la página
- **THEN** la página cambia de inmediato, sin animación

#### Scenario: Final sin Auto
- **WHEN** Auto está inactivo y el encendido alcanza el final de la página
- **THEN** el modo se detiene y espera la señal del lector (`Shift+→`) para pasar de página

#### Scenario: Instantánea con Auto
- **WHEN** el preset es instantánea y Auto está activo
- **THEN** tras revelar la página el modo espera 2 segundos antes de cruzar (no hay ritmo de letras que proteger)

#### Scenario: Sin ajuste de conducta
- **WHEN** la lectora abre la sheet de ajustes del modo o el panel de configuración
- **THEN** no existe interruptor «Lectura continua»: el cruce a ritmo normal es el único comportamiento y una instalación vieja con el ajuste guardado no conserva la opción (persist v16)
