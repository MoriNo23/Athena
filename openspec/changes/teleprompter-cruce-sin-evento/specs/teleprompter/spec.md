# teleprompter — Delta de especificación (cruce sin evento)

## MODIFIED Requirements

### Requirement: Encadenado de páginas
El texto ya leído SHALL permanecer en la columna: es el SCROLL, a ritmo de
lectura, el que lo saca de vista — NUNCA un evento del seguimiento. Al
agotar la página virtual el flujo SHALL anunciarse como progreso (página real
del lector) y la página nueva SHALL añadirse AL FINAL de la columna, por
debajo de la vista, sin mover nada de lo visible. Con Auto el encendido
SHALL continuar a ritmo normal; sin Auto SHALL detenerse al final de la
página y esperar la orden del lector. Las páginas leídas SHALL podarse del
DOM únicamente cuando su pie haya salido del encuadre con margen de respeto,
compensando el scroll antes del pintado (poda imperceptible). La única espera
conservada al agotar la página es la del revelado INSTANTÁNEO con Auto (2 s):
ahí no hay ritmo de letras que proteger.

#### Scenario: el scroll oculta el texto leído
- **WHEN** el encendido agota una página virtual y entra en la siguiente
- **THEN** el texto de la página anterior permanece en pantalla y se va hacia
  arriba al ritmo de lectura — no hay frame en el que desaparezca

#### Scenario: la página nueva entra sin mover lo visible
- **WHEN** el flujo entra en una página nueva de la ventana
- **THEN** la página se añade al final de la columna (debajo de la vista), se
  anuncia el progreso y se precarga la siguiente; ningún carácter visible
  cambia de posición ni aparece espacio en blanco entre páginas

#### Scenario: poda fuera de encuadre
- **WHEN** el pie de una página ya leída lleva fuera del encuadre el margen
  de respeto
- **THEN** la página se retira del DOM con el scroll compensado antes del
  pintado (ancla de vista): la poda es imperceptible y la memoria queda
  acotada; mientras el texto siga a la vista, no se poda

#### Scenario: pausa y re-lectura conservan contexto
- **WHEN** la lectora se pausa (espacio, rueda arriba, rebobinado)
- **THEN** el texto leído que aún está en pantalla permanece: puede releerlo
  con `←`/`Shift+←` y el flujo se re-ancla al reanudar

#### Scenario: Auto encadenado
- **WHEN** Auto está activo y el encendido alcanza el final de la página con
  páginas restantes
- **THEN** el flujo continúa con la página siguiente tras el retardo normal
  del carácter, sin pausa de 2 s, sin aviso y sin animación

#### Scenario: Final sin Auto
- **WHEN** Auto está inactivo y el encendido alcanza el final de la página
- **THEN** el modo se detiene y espera la señal del lector (`Shift+→`) para
  pasar de página; el texto leído sigue a la vista mientras decide

#### Scenario: Cambio manual sin espera
- **WHEN** el lector pulsa `Shift+→` antes de que termine la página
- **THEN** el resto de la página se enciende de golpe, la siguiente se
  anuncia y el flujo continúa; el texto saltado se va por el scroll, sin
  animación ni intercambio de ventana

#### Scenario: Instantánea con Auto
- **WHEN** el preset es instantánea y Auto está activo
- **THEN** tras revelar la página el modo espera 2 segundos antes de
  continuar (no hay ritmo de letras que proteger)

#### Scenario: Progreso por página real
- **WHEN** el carácter activo avanza por la columna
- **THEN** la barra de progreso y la cabecera reflejan la página real que se
  lee (la que contiene el carácter activo), no el inicio de la ventana
