# teleprompter Specification

## Purpose

Lectura a ritmo continuo: la página se lee como una columna que sube sola mientras las letras se encienden, con retroceso real (rebobinar y releer) y títulos reconocidos con pausa.

## Requirements

### Requirement: Flujo continuo sin tarjetas
El modo teleprompter SHALL presentar el texto de la página como una única columna continua que se desplaza sola a medida que avanza el encendido; no SHALL segmentar el texto en tarjetas ni exponer numeración de tarjetas en la interfaz.

#### Scenario: Lectura de una página
- **WHEN** el lector inicia el teleprompter en una página con texto
- **THEN** el texto se muestra en una sola columna continua que se desplaza con el avance y no existe indicador de «tarjeta X de Y»

### Requirement: Encendido letra a letra con ritmo
El modo SHALL encender el texto carácter a carácter con el ritmo del preset de velocidad elegido, aplicando pausas mayores tras puntuación fuerte y menores tras coma o similar. SHALL existir un preset instantáneo que revele todo de golpe.

#### Scenario: Cambio de velocidad
- **WHEN** el lector elige una velocidad distinta de la instantánea
- **THEN** los caracteres aparecen uno a uno con las pausas de puntuación y la nueva velocidad aplica desde el carácter siguiente

#### Scenario: Instantánea o movimiento reducido
- **WHEN** el preset es instantánea o el sistema pide movimiento reducido
- **THEN** todo el texto visible de la página se muestra encendido, sin animación de encendido

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

### Requirement: Releer sin apagar el texto
El modo SHALL permitir desplazarse hacia arriba (rueda o flecha arriba) para releer el texto ya encendido: el texto permanece legible, el avance automático se pausa mientras se relee y el encendido no se apaga.

#### Scenario: Relectura hacia arriba
- **WHEN** el lector se desplaza hacia arriba durante la lectura
- **THEN** el texto ya encendido se lee completo, el avance queda en pausa y, al reanudar, el encendido continúa donde estaba

### Requirement: Títulos reconocidos con pausa
El modo SHALL reconocer títulos —encabezados reales del libro en EPUB y heurística conservadora en PDF— y presentarlos completos con un fundido, en tamaño mayor, seguidos de una pausa antes de continuar con el cuerpo.

#### Scenario: Aparición de un título
- **WHEN** el flujo llega a un título reconocido
- **THEN** el título aparece entero con fundido (sin encendido letra a letra) y el cuerpo no comienza hasta transcurrir la pausa

#### Scenario: Título por heurística en PDF
- **WHEN** el texto proviene de un PDF y un bloque corto sin puntuación final cumple los criterios de título
- **THEN** se presenta como título, aceptando la posibilidad de clasificar algún falso positivo

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

### Requirement: Controles y ajustes bajo el nombre Teleprompter
El modo SHALL llamarse «Teleprompter» en toda la interfaz (en los tres idiomas) y SHALL conservar velocidad, sonido de tipeo, Auto, pantalla completa, tamaño de letra y salida, con los ajustes persistidos entre sesiones.

#### Scenario: Nombre visible
- **WHEN** el lector mira el acceso al modo en la cabecera del lector
- **THEN** aparece como Teleprompter en español, inglés y portugués, y ninguna superficie de la interfaz menciona «cine» ni «novela visual»

#### Scenario: Ajustes conservados
- **WHEN** el lector cambia velocidad, sonido o tamaño de letra del modo
- **THEN** el ajuste persiste entre sesiones, migrando lo guardado del modo anterior

### Requirement: Sin marca de inicio de primer palabra
El modo SHALL NOT mostrar la marca asimétrica que resaltaba la primera palabra de cada bloque.

#### Scenario: Comienzo de bloque
- **WHEN** comienza el encendido de un bloque de texto
- **THEN** el primer carácter se enciende como cualquier otro, sin resaltado de fondo

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

### Requirement: La relectura manual manda
Mientras el lector se desplaza manualmente —rueda o `↑`— su desplazamiento SHALL mandar sobre el seguimiento automático: al reanudar el avance, el seguimiento SHALL re-sincronizarse con la posición real sin arrastrar la vista de vuelta ni dar tirones. La rueda SHALL mandar también sobre una animación de vista que siga en curso: al llegar la rueda, la vista se queda donde el lector la puso.

#### Scenario: Desplazamiento manual durante el avance
- **WHEN** el lector se desplaza hacia arriba con la rueda o `↑` mientras el flujo avanza
- **THEN** la vista obedece el desplazamiento manual y el avance automático queda en pausa, como ya define la relectura

#### Scenario: Reanudar tras releer
- **WHEN** el lector reanuda el avance después de haber releído hacia arriba
- **THEN** el seguimiento continúa desde la posición real del texto, sin tirón hacia la posición anterior

#### Scenario: Rueda con la cámara en vuelo
- **WHEN** el lector gira la rueda mientras una animación de vista sigue en curso
- **THEN** la vista se queda donde el lector la puso y la cámara no la arrastra de vuelta

### Requirement: Banda de lectura estable
El modo SHALL mantener el carácter activo dentro de la banda de lectura —el 40 % del alto visible— en todo momento, incluidos el inicio y el final de cada página y el cruce de página. Para ello la columna SHALL reservar el espacio necesario por encima del primer carácter de cada página, de modo que la cámara nunca apunte a una posición de desplazamiento inalcanzable y el texto no pelee con los márgenes.

#### Scenario: Inicio de página
- **WHEN** el flujo enciende el primer carácter de una página
- **THEN** el carácter queda en la banda de lectura y la columna no se mueve

#### Scenario: Cruce de página con Auto
- **WHEN** Auto encadena la página siguiente
- **THEN** el primer carácter de la página nueva queda en la banda de lectura y la columna no invierte su dirección

#### Scenario: Fin de página
- **WHEN** el flujo alcanza el final del texto encendible
- **THEN** el texto permanece legible y la columna no oscila

### Requirement: Un gesto por tecla
El modo SHALL mover el encendido una letra con `→` y con `←`, y SHALL cambiar de página con `Shift+→` (página siguiente) y `Shift+←` (página anterior). Cada tecla SHALL tener un único efecto, con independencia del estado del flujo.

#### Scenario: Avance de una letra
- **WHEN** el lector pulsa `→`
- **THEN** se enciende un único carácter más y la vista lo acompaña

#### Scenario: Retroceso de una letra
- **WHEN** el lector pulsa `←`
- **THEN** se apaga un único carácter y la vista lo acompaña

#### Scenario: Salto a la página siguiente
- **WHEN** el lector pulsa `Shift+→`
- **THEN** el flujo pasa a la página siguiente, con su primer carácter en la banda de lectura

#### Scenario: Salto a la página anterior
- **WHEN** el lector pulsa `Shift+←`
- **THEN** el flujo vuelve a la página anterior, encendida y lista para releer

### Requirement: Recordatorio de teclas en la inmersión
Cada vez que la interfaz del teleprompter se oculte o se muestre, el modo SHALL desplegar a la derecha un recordatorio en letras grandes y transparentes con cada tecla y qué hace, y SHALL retirarlo solo, sin bloquear la lectura ni capturar el puntero.

#### Scenario: Ocultar y mostrar la interfaz
- **WHEN** la interfaz del teleprompter se oculta o se muestra
- **THEN** el recordatorio de teclas aparece a la derecha con las teclas del modo y su efecto, en letras transparentes, y se desvanece solo

#### Scenario: Movimiento reducido
- **WHEN** el sistema pide movimiento reducido
- **THEN** el recordatorio aparece y se retira sin animación de desplazamiento
