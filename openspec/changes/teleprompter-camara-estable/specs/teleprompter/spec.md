# teleprompter — Delta de especificación (cámara estable)

## MODIFIED Requirements

### Requirement: Vista con transición breve
El modo SHALL acompañar el avance fino del flujo —avance de línea y asentamientos
pequeños— con una transición breve y continua, de forma que el texto no aparezca de golpe
y la columna no rebote. La transición SHALL ser el seguimiento continuo de la cámara hacia
el objetivo: actualizar el objetivo (nuevo carácter, título, cruce) SHALL NOT reiniciar ni
cancelar ninguna animación en vuelo. El rebobinado SHALL NOT usar esa transición: la vista
acompaña la posición de forma directa. Los cambios de contexto —cruce de página y revelado
completo— SHALL NOT producir barridos de columna. El fundido de página SHALL aplicarse solo
al avanzar de página. Con movimiento reducido o preset instantáneo SHALL NOT haber animación
de vista.

#### Scenario: Retarget durante el vuelo
- **WHEN** el motor enciende el carácter siguiente mientras el seguimiento anterior converge
- **THEN** la cámara solo actualiza su objetivo y la convergencia continúa desde la posición actual, sin acelerones ni vaivén

#### Scenario: Rebobinado
- **WHEN** el lector rebobina el encendido con `←` o el control de retroceso
- **THEN** la vista acompaña la posición del rebobinado de forma directa, sin animación de cámara

#### Scenario: Movimiento reducido o instantánea
- **WHEN** el sistema pide movimiento reducido o el preset es instantáneo
- **THEN** los movimientos de vista son inmediatos, sin animación

## ADDED Requirements

### Requirement: Cámara como servidor de objetivos
El modo SHALL mantener un único bucle de cámara (`requestAnimationFrame` persistente) que
converja de forma continua y monótona hacia el objetivo vertical con interpolación
exponencial normalizada por tiempo. SOLO la cámara SHALL escribir `scrollTop` durante la
reproducción: si el `scrollTop` real difiere del último valor escrito por la cámara en más
del margen de subpíxel, la cámara SHALL ceder el control (yield) y SHALL NOT volver a
escribir hasta que la reproducción se reanude, momento en el que SHALL re-sincronizar el
objetivo contra el DOM real sin arrastrar la vista.

#### Scenario: El gesto manual manda
- **WHEN** la rueda o `↑` mueven la vista mientras la cámara sigue
- **THEN** la cámara detecta la escritura ajena, cede y no recupera el control hasta reanudar

#### Scenario: Reanudar tras releer
- **WHEN** el lector reanuda el avance después de desplazarse manualmente
- **THEN** el objetivo se recalcula contra la posición real y la cámara converge sin tirón

#### Scenario: Convergencia monótona con tecla mantenida
- **WHEN** el lector mantiene `←` y el rebobinado cruza varias líneas
- **THEN** la vista sube de forma monótona hacia el texto —sin bajar, rebotar ni oscilar— y no queda ninguna animación en vuelo al soltar

### Requirement: Banda garantizada por layout
El escenario SHALL reservar por layout el espacio necesario para que el objetivo de cámara
siempre sea un desplazamiento válido: padding superior igual a la banda de lectura (40 % del
alto visible) por encima del primer carácter de cada página y reserva inferior equivalente
tras el último. La cámara SHALL NOT depender del clamp del navegador para alcanzar su punto
de reposo.

#### Scenario: Inicio de página
- **WHEN** el flujo enciende el primer carácter de una página
- **THEN** el carácter queda en la banda de lectura y la columna no retrocede ni pelea con el margen

#### Scenario: Fin de página
- **WHEN** el flujo alcanza el final del texto encendible
- **THEN** el último carácter descansa en la banda sin superar el tope de desplazamiento
