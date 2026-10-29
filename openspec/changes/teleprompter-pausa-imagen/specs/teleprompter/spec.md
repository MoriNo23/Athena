# teleprompter — Delta de especificación (pausa de imagen)

## ADDED Requirements

### Requirement: Pausa de imagen con exposición recomendada
El modo SHALL detectar las imágenes relevantes de la página —en PDF por operator list con
heurística conservadora, en EPUB por las imágenes reales del spine— y SHALL insertarlas en
el flujo en su posición vertical real como pasos de imagen con un tiempo de exposición
(`holdMs`) recomendado. Durante la exposición la imagen SHALL mostrarse completa en columna
(sin encendido letra a letra) con una indicación visible del tiempo restante, y el flujo
SHALL NOT continuar hasta vencer el hold, saltarlo el lector o pausarlo. La exposición
recomendada por defecto SHALL ser de 5 segundos y SHALL poder ajustarse entre 2 y 30
segundos; con el modo recomendado activo, la exposición base SHALL ponderar el tamaño
renderizado (clamp 3–8 s). Las imágenes SHALL NOT disparar el tic de sonido ni contar como
páginas leídas.

#### Scenario: Figura tras el párrafo que la anuncia
- **WHEN** el flujo termina de leer un párrafo y la siguiente posición de la página contiene una imagen relevante
- **THEN** la imagen aparece completa en columna y el encendido queda detenido el hold configurado antes de continuar

#### Scenario: Pausa del hold
- **WHEN** el lector pulsa Espacio durante la exposición
- **THEN** el cronómetro del hold se congela con la imagen visible y reanuda con el siguiente Espacio

#### Scenario: Saltar la imagen
- **WHEN** el lector pulsa `→` durante la exposición
- **THEN** el hold se cancela y el encendido retoma en el paso siguiente

#### Scenario: Re-exposición por rebobinado
- **WHEN** el rebobinado retrocede sobre una imagen ya consumida
- **THEN** la figura se re-muestra y el hold arranca de nuevo

#### Scenario: Auto con hold pendiente
- **WHEN** Auto está activo y el final de la página coincide con una imagen en exposición o pendiente
- **THEN** el cruce de página espera a que venza el hold (con su aviso habitual) y solo después gira

#### Scenario: Ajuste del tiempo
- **WHEN** el lector cambia la duración del hold en los ajustes del teleprompter
- **THEN** el valor se limita al rango 2–30 s, persiste entre sesiones y aplica a las siguientes exposiciones

#### Scenario: Desactivar la pausa
- **WHEN** el lector desactiva «Pausa en imágenes»
- **THEN** las imágenes se muestran sin detener el flujo y el ajuste persiste

## MODIFIED Requirements

### Requirement: Encendido letra a letra con ritmo
El modo SHALL encender el texto carácter a carácter con el ritmo del preset de velocidad
elegido, aplicando pausas mayores tras puntuación fuerte y menores tras coma o similar. SHALL
existir un preset instantáneo que revele todo de golpe. Los pasos de imagen SHALL formar
parte del mismo timeline: su retardo es el hold de exposición y, en preset instantáneo o
movimiento reducido, la imagen SHALL mostrarse con el mismo holdMs (es tiempo, no movimiento).

#### Scenario: Cambio de velocidad
- **WHEN** el lector elige una velocidad distinta de la instantánea
- **THEN** los caracteres aparecen uno a uno con las pausas de puntuación y la nueva velocidad aplica desde el carácter siguiente, sin alterar el hold de las imágenes

#### Scenario: Instantánea o movimiento reducido
- **WHEN** el preset es instantánea o el sistema pide movimiento reducido
- **THEN** el texto de la página se muestra encendido sin animación y las imágenes mantienen su exposición de holdMs

### Requirement: Rebobinar el encendido
El modo SHALL permitir retroceder el encendido con la flecha izquierda o el control de
retroceso, apagando caracteres ya encendidos en orden inverso al de encendido, y SHALL
desplazar la vista acompañando la posición del rebobinado de forma directa. Al retroceder
sobre un paso de imagen ya consumido, el modo SHALL re-mostrar la imagen y reiniciar su
exposición.

#### Scenario: Retroceso sobre una imagen
- **WHEN** el rebobinado alcanza un paso de imagen ya pasado
- **THEN** la figura se re-muestra completa y el hold reinicia, sin re-tipeo del texto previo

### Requirement: Encadenado de páginas
Con Auto activo, al agotar el texto de la página el modo SHALL esperar 2 segundos y después
continuar con la página siguiente, encadenando el flujo sin corte visible; durante la espera
SHALL avisar del cambio inminente. Si quedan pasos de imagen pendientes en la página, el
cruce SHALL esperar a que venzan sus holds. Sin Auto, SHALL detenerse al final de la página
y esperar la señal del lector (`Shift+→`) para pasar de página.

#### Scenario: Auto encadenado con imágenes pendientes
- **WHEN** Auto alcanza el final de la página y aún quedan imágenes sin exponer
- **THEN** cada imagen completa su hold antes del aviso y el cruce posterior a 2 segundos
