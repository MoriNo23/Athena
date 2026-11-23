# Spec Delta

## Purpose

Controla cómo se perciben los encabezados del teleprompter: tiempo de lectura, coreografía de encendido y alternativa de texto normal, para que un título nunca parezca saltado.

## ADDED Requirements

### Requirement: El encendido del título espera lo suficiente para verse completo

El motor SHALL mantener el encendido en un bloque de encabezado durante `max(unidadesDelTitulo · msPorUnidad(wps), pisoMs)`, con `pisoMs` suficiente para que termine la animación de encendido. El valor SHALL actualizarse cuando cambie la velocidad en marcha, sin reconstruir el flujo.

#### Scenario: Velocidad alta no recorta el fundido

- **GIVEN** el teleprompter está a 4,0 pal/s y un título se acaba de encender
- **WHEN** el motor programa el siguiente paso
- **THEN** la espera es al menos la duración completa de la animación del título, aunque las unidades de tempo den menos milisegundos

#### Scenario: Cambio de velocidad en marcha

- **GIVEN** un título ya está encendido y el lector sube la velocidad
- **WHEN** se programa el paso siguiente
- **THEN** se usa el piso en milisegundos y el fundido no se interrumpe

### Requirement: Coreografía de encendido en dos tiempos

Con el estilo `coreografiados` (por defecto), un encabezado SHALL aparecer primero atenuado y desplazado ~0,3 em durante ~300 ms, y después SHALL encenderse completamente con un fundido de ~900 ms y un silencio de ~400 ms antes del primer carácter del cuerpo. El movimiento SHALL declararse únicamente en el estado encendido, nunca al apagar.

#### Scenario: Título seguido de cuerpo

- **GIVEN** un bloque `h2` y a continuación un párrafo
- **WHEN** el encendido entra en el `h2`
- **THEN** se ven los dos tiempos y el cuerpo no empieza hasta terminar el silencio final

#### Scenario: Rebobinar sobre un título

- **GIVEN** el lector rebobina mientras un título está encendido
- **WHEN** se apaga el bloque
- **THEN** no corre la animación inversa: el título se atenúa al instante y sin desplazamiento

### Requirement: Títulos consecutivos tienen respiración propia

Cuando dos encabezados se suceden sin cuerpo entre ellos, cada uno SHALL recibir su propio compás de encendido. El segundo SHALL esperar a que el primero termine su coreografía; las pausas NO SHALL acumularse (gana la mayor).

#### Scenario: Portadilla y título de sección

- **GIVEN** un `h1` seguido inmediatamente de un `h2`
- **WHEN** el encendido pasa del primero al segundo
- **THEN** ambos se iluminan suavemente, el segundo empieza después de que el primero se haya asentado, y el total no suma dos pausas largas

### Requirement: Estilo «Como texto normal»

El lector SHALL poder elegir `headingStyle: "texto"` desde los ajustes del teleprompter. En ese modo los encabezados SHALL usar la misma cadencia y la misma animación por carácter que el cuerpo: sin piso en milisegundos, sin dos tiempos y sin respiro adicional. El estilo elegido SHALL persistir con los demás ajustes.

#### Scenario: Usuario que quiere el título a ritmo normal

- **GIVEN** el lector cambia «Títulos» a «Como texto normal»
- **WHEN** llega un encabezado
- **THEN** se enciende letra a letra con la misma pausa por unidad que el texto, sin movimiento extra

#### Scenario: Persistencia del ajuste

- **GIVEN** el lector eligió «Como texto normal»
- **WHEN** cierra y vuelve a abrir el teleprompter
- **THEN** el ajuste sigue aplicado

### Requirement: Movimiento reducido

Con `prefers-reduced-motion: reduce` el sistema SHALL conservar el tiempo de lectura del encabezado pero NO SHALL aplicar desplazamiento ni fundido animado.

#### Scenario: Sistema con movimiento reducido

- **GIVEN** el sistema pide movimiento reducido y el estilo es `coreografiados`
- **WHEN** se enciende un título
- **THEN** aparece quieto y se mantiene encendido el mismo tiempo de lectura

### Requirement: Encabezado centrado en la zona cómoda

La cámara SHALL llevar el centro del bloque de encabezado a la zona cómoda de lectura, en vez de anclar únicamente su primera línea.

#### Scenario: Título de dos líneas

- **GIVEN** un encabezado que ocupa dos líneas visuales
- **WHEN** se enciende
- **THEN** ambas líneas quedan dentro de la zona cómoda antes de que empiece el cuerpo
