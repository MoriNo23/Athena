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
El modo SHALL permitir retroceder el encendido con la flecha izquierda o el control de retroceso, apagando caracteres ya encendidos en orden inverso al de encendido, y SHALL desplazar la vista acompañando la posición del rebobinado.

#### Scenario: Rebobinar dentro de la página
- **WHEN** el lector retrocede con caracteres encendidos en la página actual
- **THEN** el encendido se retira hacia atrás letra a letra y la vista acompaña la posición

#### Scenario: Rebobinar cruzando el inicio de página
- **WHEN** el rebobinado alcanza el inicio de la página y el lector sigue retrocediendo
- **THEN** se carga la página anterior completa y encendida, sin re-tipeo, lista para releer

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
Con Auto activo, al agotar el texto de la página el modo SHALL continuar con la página siguiente sin intervención, encadenando el flujo sin corte visible. Sin Auto, SHALL detenerse al final de la página y esperar la señal del lector.

#### Scenario: Auto encadenado
- **WHEN** Auto está activo y el encendido alcanza el final de la página con páginas restantes
- **THEN** la página siguiente se carga y el flujo continúa sin detenerse

#### Scenario: Final sin Auto
- **WHEN** Auto está inactivo y el encendido alcanza el final de la página
- **THEN** el modo se detiene y espera la señal del lector para pasar de página

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
El modo SHALL acompañar los movimientos de vista del flujo —avance de línea, aparición de un título, cruce de página, revelado completo y rebobinado— con una transición breve y continua, de forma que el texto no aparezca de golpe. Con movimiento reducido o preset instantáneo SHALL NOT haber animación de vista.

#### Scenario: Aparición de un título
- **WHEN** el flujo llega a un título reconocido
- **THEN** la vista llega hasta él con una transición breve —sin salto en seco— y el título sigue apareciendo completo con fundido

#### Scenario: Cruce de página
- **WHEN** el flujo cruza a la página siguiente con Auto activo o por orden del lector
- **THEN** la vista llega a la nueva página con transición breve, sin reacomodo visible de la columna

#### Scenario: Revelado completo
- **WHEN** el lector completa la página de golpe (clic o espacio)
- **THEN** la vista lo acompaña con transición breve en vez de saltar en seco al final

#### Scenario: Rebobinado
- **WHEN** el lector rebobina el encendido con `←` o el control de retroceso
- **THEN** la vista acompaña la posición del rebobinado con transición breve

#### Scenario: Movimiento reducido o instantánea
- **WHEN** el sistema pide movimiento reducido o el preset es instantáneo
- **THEN** los movimientos de vista son inmediatos, sin animación

### Requirement: La relectura manual manda
Mientras el lector se desplaza manualmente —rueda o `↑`— su desplazamiento SHALL mandar sobre el seguimiento automático: al reanudar el avance, el seguimiento SHALL re-sincronizarse con la posición real sin arrastrar la vista de vuelta ni dar tirones.

#### Scenario: Desplazamiento manual durante el avance
- **WHEN** el lector se desplaza hacia arriba con la rueda o `↑` mientras el flujo avanza
- **THEN** la vista obedece al desplazamiento manual y el avance automático queda en pausa, como ya define la relectura

#### Scenario: Reanudar tras releer
- **WHEN** el lector reanuda el avance después de haber releído hacia arriba
- **THEN** el seguimiento continúa desde la posición real del texto, sin tirón hacia la posición anterior
