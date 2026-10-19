# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Encadenado de páginas
Con Auto activo, al agotar el texto de la página el modo SHALL continuar con la página siguiente sin intervención, encadenando el flujo sin corte visible. Sin Auto, SHALL detenerse al final de la página y esperar la señal del lector (`Shift+→`) para pasar de página.

#### Scenario: Auto encadenado
- **WHEN** Auto está activo y el encendido alcanza el final de la página con páginas restantes
- **THEN** la página siguiente se carga y el flujo continúa sin detenerse

#### Scenario: Final sin Auto
- **WHEN** Auto está inactivo y el encendido alcanza el final de la página
- **THEN** el modo se detiene y espera la señal del lector (`Shift+→`) para pasar de página
