# Spec Delta

## MODIFIED Requirements

### Requirement: Rebobinar el encendido
El modo SHALL permitir retroceder el encendido con la flecha izquierda o el control de retroceso, apagando caracteres ya encendidos en orden inverso al de encendido, y SHALL desplazar la vista acompañando la posición del rebobinado. El retroceso SHALL ser directo: apagar caracteres y títulos SHALL ser inmediato —sin transición, sin desplazamiento en reposo ni reutilización de la animación de aparición— y la vista SHALL acompañar la posición sin animación de cámara, de modo que el resultado dependa solo de qué caracteres están encendidos.

#### Scenario: Rebobinar dentro de la página
- **WHEN** el lector retrocede con caracteres encendidos en la página actual
- **THEN** el encendido se retira hacia atrás letra a letra de forma inmediata y la vista acompaña la posición

#### Scenario: Rebobinar cruzando el inicio de página
- **WHEN** el rebobinado alcanza el inicio de la página y el lector sigue retrocediendo
- **THEN** se carga la página anterior completa y encendida, sin re-tipeo, lista para releer, y sin fundido de página

#### Scenario: Retroceso con la tecla mantenida
- **WHEN** el lector mantiene `←` y el rebobinado cruza varias líneas
- **THEN** la vista sube de forma monótona hacia el texto —sin bajar, rebotar ni oscilar— y no queda ninguna animación en vuelo al soltar la tecla

#### Scenario: Retroceder por un título
- **WHEN** el rebobinado apaga un título
- **THEN** el título se apaga al instante y no se desplaza

### Requirement: Encadenado de páginas
Con Auto activo, al agotar el texto de la página el modo SHALL esperar 2 segundos y después continuar con la página siguiente, encadenando el flujo sin corte visible; durante la espera SHALL avisar del cambio inminente. Sin Auto, SHALL detenerse al final de la página y esperar la señal del lector (`Shift+→`) para pasar de página. La señal manual SHALL cambiar de página sin esperar.

#### Scenario: Auto encadenado
- **WHEN** Auto está activo y el encendido alcanza el final de la página con páginas restantes
- **THEN** tras la pausa de 2 segundos la página siguiente se carga y el flujo continúa sin detenerse

#### Scenario: Pausa con aviso
- **WHEN** el encendido alcanza el final de la página con Auto activo
- **THEN** el modo espera 2 segundos con el aviso de cambio de página visible antes de pasar a la página siguiente

#### Scenario: Cambio manual sin espera
- **WHEN** el lector pulsa `Shift+→` antes de que termine la pausa
- **THEN** la página cambia de inmediato

#### Scenario: Final sin Auto
- **WHEN** Auto está inactivo y el encendido alcanza el final de la página
- **THEN** el modo se detiene y espera la señal del lector (`Shift+→`) para pasar de página

### Requirement: Vista con transición breve
El modo SHALL acompañar el **avance** fino del flujo —avance de línea y asentamientos pequeños— con una transición breve y continua, de forma que el texto no aparezca de golpe y la columna no rebote. El rebobinado SHALL NOT usar esa transición: la vista acompaña la posición de forma directa. Los cambios de contexto —cruce de página y revelado completo— SHALL NOT producir barridos de columna: la vista se asienta en su posición sin recorrerla. El fundido de página SHALL aplicarse solo al avanzar de página. Con movimiento reducido o preset instantáneo SHALL NOT haber animación de vista.

#### Scenario: Aparición de un título
- **WHEN** el flujo llega a un título reconocido
- **THEN** la vista asienta el inicio del bloque del título en la zona cómoda con una transición breve —sin sumergirse hasta el final del título— y el título sigue apareciendo completo con fundido

#### Scenario: Cruce de página
- **WHEN** el flujo cruza a la página siguiente con Auto activo o por orden del lector
- **THEN** la vista pasa a la página nueva sin reacomodo visible ni barrido, y el seguimiento continúa desde la posición en que quedó la columna

#### Scenario: Revelado completo
- **WHEN** el lector completa la página de golpe (clic o espacio)
- **THEN** el resto del texto se enciende donde está y la vista no se desplaza al fondo de la página

#### Scenario: Rebobinado
- **WHEN** el lector rebobina el encendido con `←` o el control de retroceso
- **THEN** la vista acompaña la posición del rebobinado de forma directa, sin animación de cámara

#### Scenario: Movimiento reducido o instantánea
- **WHEN** el sistema pide movimiento reducido o el preset es instantáneo
- **THEN** los movimientos de vista son inmediatos, sin animación
