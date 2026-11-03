# teleprompter — Delta de especificación (flujo continuo)

## MODIFIED Requirements

### Requirement: Encadenado de páginas
El modo SHALL ofrecer dos conductas de cruce de página virtual, elegibles con
el ajuste «Lectura continua» (`flujoContinuo`, default **true**, persistido).

Con lectura continua, el cruce SHALL NOT ser un evento: al agotar la página con
Auto el flujo SHALL continuar a ritmo normal —sin pausa de giro, sin animación
de columna y sin aviso flotante— y la posición de lectura SHALL conservarse con
el ancla atómica del cruce. El indicador de página de la cabecera sigue siendo
verdad, pero nada SHALL anunciar ni celebrar el cruce. Sin Auto, el modo SHALL
detenerse al final de la página y esperar la señal del lector como siempre; el
cruce autorizado SHALL ejecutarse sin animación ni pausa.

Con lectura continua desactivada, el cruce SHALL anunciarse como hoy: con Auto,
esperar 2 segundos con aviso visible antes de continuar; en ambos sentidos, la
columna nueva SHALL entrar con el fundido de página. La señal manual
(`Shift+→`) SHALL cambiar de página sin esperar. La pausa de 2 s del revelado
instantáneo con Auto SHALL conservarse también con lectura continua (no hay
ritmo de letras que proteger).

#### Scenario: Auto encadenado continuo
- **WHEN** lectura continua está activa, Auto está activo y el encendido alcanza el final de la página con páginas restantes
- **THEN** el flujo continúa con la página siguiente tras el retardo normal del carácter, sin pausa de 2 s, sin aviso y sin animación, y el carácter donde se reanuda queda donde estaba en pantalla

#### Scenario: Sin salto ni reacomodo en el cruce continuo
- **WHEN** el cruce continuo intercambia la ventana (página actual + siguiente)
- **THEN** el ancla atómica deja el texto en su posición visual —no aparece espacio en blanco entre páginas ni reacomodo de columna— y pausar y reanudar funciona inmediatamente

#### Scenario: Cambio en caliente
- **WHEN** la lectora activa o desactiva «Lectura continua» dentro del modo (tecla A)
- **THEN** la ventana no se reconstruye, la lectura no se interrumpe y el próximo cruce adopta la conducta nueva

#### Scenario: Auto encadenado clásico
- **WHEN** lectura continua está desactivada y Auto está activo
- **THEN** al agotarse la página el modo espera 2 segundos con el aviso de cambio visible antes de pasar a la página siguiente

#### Scenario: Cambio manual sin espera
- **WHEN** el lector pulsa `Shift+→` antes de que termine la pausa
- **THEN** la página cambia de inmediato (con el fundido del modo clásico, sin él en continuo)

#### Scenario: Final sin Auto
- **WHEN** Auto está inactivo y el encendido alcanza el final de la página
- **THEN** el modo se detiene y espera la señal del lector (`Shift+→`) para pasar de página, en ambas conductas

#### Scenario: Instantánea con Auto
- **WHEN** el preset es instantánea y Auto está activo
- **THEN** tras revelar la página el modo espera 2 segundos antes de cruzar, también con lectura continua (no hay ritmo de letras que proteger)

#### Scenario: Ajuste persistido
- **WHEN** la lectora cambia «Lectura continua»
- **THEN** el ajuste persiste entre sesiones (persist v15) y en `db/config.json`; una instalación v14 sin el ajuste arranca en continuo sin perder sus demás ajustes
