# teleprompter — Delta de especificación (ajustes in-mode)

## ADDED Requirements

### Requirement: Ajustes avanzados dentro del modo
El teleprompter SHALL exponer dentro del propio modo un panel de ajustes que concentre todos
los ajustes del teleprompter: ritmo (velocidad, instantánea, tarjetas por frase, Auto),
imágenes (pausa y duración del hold), fondo del escenario (tema, portada o imagen propia con
subida y filtro) y sonido y letra. El panel SHALL abrirse sin salir del modo —con un control
de la barra del overlay y con la tecla `A`— SHALL escribir en la misma persistencia que los
ajustes del lector, y los cambios SHALL aplicar en caliente sin reiniciar la reproducción.
Con el panel abierto, la tecla Escape SHALL cerrar el panel antes que el modo, y los atajos
del teleprompter SHALL quedar suprimidos mientras el foco esté en el panel. El panel SHALL
ser completamente operable por teclado, con el foco atrapado y devuelto al cerrar.

#### Scenario: Abrir el panel sin salir del modo
- **WHEN** el lector pulsa `A` o el control de engranaje con el teleprompter abierto
- **THEN** el panel se abre sobre el escenario atenuado y la reproducción continúa

#### Scenario: Jerarquía de Escape
- **WHEN** el lector pulsa Escape con el panel abierto
- **THEN** el panel se cierra y el teleprompter permanece; un segundo Escape cierra el modo

#### Scenario: Fondo en caliente
- **WHEN** el lector cambia el fondo a portada o imagen propia y ajusta el filtro desde el panel
- **THEN** el escenario refleja el cambio al instante, sin cerrar el teleprompter

#### Scenario: Ajustes conservados
- **WHEN** el lector cambia cualquier ajuste desde el panel
- **THEN** el ajuste persiste entre sesiones en el bloque `teleprompter` de `db/config.json`, igual que si se hubiera cambiado desde los ajustes del lector

#### Scenario: Operable por teclado
- **WHEN** el lector recorre el panel solo con teclado
- **THEN** todos los controles son alcanzables y operables, con el foco atrapado mientras está abierto y devuelto al control que lo abrió al cerrar
