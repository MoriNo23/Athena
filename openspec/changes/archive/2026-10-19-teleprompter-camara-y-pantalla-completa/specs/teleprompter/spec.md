# Spec Delta

## MODIFIED Requirements

### Requirement: Vista con transición breve
El modo SHALL acompañar el seguimiento fino del flujo —avance de línea, rebobinado y asentamientos pequeños— con una transición breve y continua, de forma que el texto no aparezca de golpe y la columna no rebote. Los cambios de contexto —cruce de página y revelado completo— SHALL NOT producir barridos de columna: la vista se asienta en su posición sin recorrerla. Con movimiento reducido o preset instantáneo SHALL NOT haber animación de vista.

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
- **THEN** la vista acompaña la posición del rebobinado con transición breve

#### Scenario: Movimiento reducido o instantánea
- **WHEN** el sistema pide movimiento reducido o el preset es instantáneo
- **THEN** los movimientos de vista son inmediatos, sin animación

## ADDED Requirements

### Requirement: Recordatorio de teclas en la inmersión
Cada vez que la interfaz del teleprompter se oculte o se muestre, el modo SHALL desplegar a la derecha un recordatorio en letras grandes y transparentes con cada tecla y qué hace, y SHALL retirarlo solo, sin bloquear la lectura ni capturar el puntero.

#### Scenario: Ocultar y mostrar la interfaz
- **WHEN** la interfaz del teleprompter se oculta o se muestra
- **THEN** el recordatorio de teclas aparece a la derecha con las teclas del modo y su efecto, en letras transparentes, y se desvanece solo

#### Scenario: Movimiento reducido
- **WHEN** el sistema pide movimiento reducido
- **THEN** el recordatorio aparece y se retira sin animación de desplazamiento
