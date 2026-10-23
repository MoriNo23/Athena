# Spec Delta

## ADDED Requirements

### Requirement: Herramientas vivas en scripts/
`scripts/` SHALL contener únicamente herramientas vivas del clon self-host, cada una de una de estas clases: (a) prueba de verificación del comportamiento actual de `src/`, (b) herramienta de flujo self-host (instalación, seed, empaquetado, BD del clon), o (c) sonda o fixture de una sonda canónica activa. Un script one-off SHALL eliminarse en el change que lo vuelve obsoleto, y un script cuyo único referente era otro script eliminado SHALL eliminarse también.

#### Scenario: Auditoría de herramientas vivas
- **WHEN** se revisa cada archivo de `scripts/` contra `package.json`, `LEEME.md`, `docs/` vigente, `src/` y el resto de `scripts/`
- **THEN** cada archivo cae en la clase (a), (b) o (c), o es eliminado como one-off —debug de un punto del tiempo, diagnóstico de un incidente cerrado, parche puntual ya aplicado, migración de datos histórica o sonda de un modo eliminado de `src/`— con su evidencia de reposo

#### Scenario: Modo eliminado
- **WHEN** un modo o engine se elimina de `src/`
- **THEN** sus sondas y fixtures exclusivas (p. ej. las del modo VN) se eliminan en el mismo change que confirma la muerte

#### Scenario: Reinventario post-purga
- **WHEN** la auditoría se repite después de aplicar la purga
- **THEN** no queda ningún script de la clase one-off ni script orbitado, y los refrescos de `LEEME.md` no apuntan a archivos borrados

### Requirement: Minutería histórica fuera del repo
El repo SHALL NOT llevar minutería histórica: informes de auditoría fechados, informal de verificación cerrada ni capturas de pantalla de sesiones pasadas. `docs/` SHALL contener solo documentación viva del clon (`LEEME.md` y doc de uso). La evidencia pasada queda en la historia de git.

#### Scenario: Clon fresco sin minutería
- **WHEN** un usuario clona el repositorio
- **THEN** `docs/` no contiene `docs/auditoria` ni `docs/screenshots` ni informes de auditoría fechados, y `LEEME.md` no apunta a documentación eliminada

#### Scenario: Historia intacta
- **WHEN** se necesita recuperar un informe o captura anterior
- **THEN** se recupera de la historia de git (`git log --follow docs/...`), sin perder nada
