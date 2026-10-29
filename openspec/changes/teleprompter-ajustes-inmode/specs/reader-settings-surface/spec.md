# reader-settings-surface — Delta de especificación (superficie del teleprompter)

## MODIFIED Requirements

### Requirement: Superficie de ajustes del teleprompter
Los ajustes del teleprompter SHALL poder ajustarse desde dos superficies equivalentes que
leen y escriben la misma persistencia: el panel de ajustes del lector (ConfigPanel) y el
panel de ajustes dentro del propio modo (sheet del teleprompter). Ninguna superficie SHALL
duplicar lógica de control: ambas SHALL usar los mismos componentes de control compartidos.
El inventario de ajustes expuesto SHALL ser idéntico en ambas superficies, salvo los controles
exclusivos de sesión del overlay (pantalla completa).

#### Scenario: Equivalencia de superficies
- **WHEN** el lector cambia el fondo o el ritmo desde el ConfigPanel y desde el sheet del modo en sesiones distintas
- **THEN** ambas escrituras producen el mismo estado persistido y la misma experiencia al abrir el modo

#### Scenario: Controles compartidos
- **WHEN** se añade o modifica un control del teleprompter
- **THEN** el cambio se hace en el componente compartido y ambas superficies lo reflejan sin duplicación
