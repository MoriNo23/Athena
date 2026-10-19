# Spec Delta

## ADDED Requirements

### Requirement: Pantalla despierta en pantalla completa
Con la lectura en pantalla completa —el lector en pantalla completa o el teleprompter abierto— la aplicación SHALL mantener la pantalla activa (Screen Wake Lock), SHALL volver a pedirla al regresar a la pestaña y SHALL liberarla al salir del modo. Si el navegador no la soporta, la lectura SHALL continuar sin error.

#### Scenario: Lectura larga sin tocar nada
- **WHEN** el lector permanece en pantalla completa sin interactuar
- **THEN** la pantalla no se suspende por inactividad

#### Scenario: Vuelta a la pestaña
- **WHEN** el lector cambia de pestaña o minimiza y luego regresa con la pantalla completa activa
- **THEN** la pantalla vuelve a quedar despierta

#### Scenario: Salida del modo
- **WHEN** el lector sale de pantalla completa y cierra el teleprompter
- **THEN** la aplicación libera el bloqueo y el navegador recupera su comportamiento normal de suspensión

#### Scenario: Navegador sin soporte
- **WHEN** el navegador no ofrece la API de pantalla despierta
- **THEN** la lectura continúa con normalidad, sin avisos

### Requirement: Recordatorio de teclas en pantalla completa
Con el lector en pantalla completa, cada vez que la interfaz se oculte o se muestre, el lector SHALL desplegar a la derecha un recordatorio en letras grandes y transparentes con cada tecla y qué hace, y SHALL retirarlo solo, sin bloquear la lectura ni capturar el puntero.

#### Scenario: Ocultar y mostrar la interfaz del lector
- **WHEN** el lector oculta o muestra la interfaz con su tecla o por inactividad en pantalla completa
- **THEN** el recordatorio de teclas aparece a la derecha con las teclas del lector y su efecto, en letras transparentes, y se desvanece solo

#### Scenario: Movimiento reducido
- **WHEN** el sistema pide movimiento reducido
- **THEN** el recordatorio aparece y se retira sin animación de desplazamiento
