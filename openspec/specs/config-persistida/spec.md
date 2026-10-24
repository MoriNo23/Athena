# config-persistida Specification

## Purpose
Dónde viven los ajustes de la casa y cómo se editan a mano: un fichero JSON legible en la carpeta de datos de la máquina que sirve — nunca presos del navegador. La config es del host; la data, de la BD.

## Requirements

### Requirement: Ajustes en un fichero JSON editable

Los ajustes de configuración (idioma, riel, lectura, inmersión, modos, teleprompter, biblioteca) viven en `db/config.json`, legible y editable a mano. La UI sigue siendo el panel de siempre; su escritura aterriza en el fichero.

#### Scenario: El navegador cambia, la configuración no

- **WHEN** la dueña abre la biblio en otro navegador de la misma instalación
- **THEN** los ajustes son los del fichero JSON, no los de un localStorage recién nacido

#### Scenario: Edición a mano honesta

- **WHEN** la dueña edita a mano un valor válido del fichero (p. ej. `lang`) y arranca la app
- **THEN** la config editada manda y el panel la refleja, sin reescribirla sin intención

### Requirement: El fichero guarda config, no data

En el fichero no vive dato de lectura ninguno: el vocabulario (notas de la dueña) y todo progreso, sesión, hito, meta e insignia quedan en la BD.

#### Scenario: El vocabulario sobrevive a la mudanza de navegador

- **WHEN** la instalación migra del localStorage antiguo al fichero nuevo
- **THEN** la config llega al fichero y el vocabulario queda registrado en la BD, cada cosa en su sitio

#### Scenario: Migración de instalación existente

- **WHEN** hay ajustes en `riel-settings-v1` (localStorage) y todavía no existe fichero
- **THEN** el primer arranque los sube al fichero y a partir de ahí el fichero manda

### Requirement: El fichero acompaña el modo LAN

El fichero es de la máquina que sirve; la app no promete sincronizarlo entre hosts, y el LEEME lo explica.

#### Scenario: Dos navegadores del mismo host

- **WHEN** la dueña usa la biblio del portátil y del móvil en modo LAN contra la misma máquina
- **THEN** ambos leen el mismo fichero del host y ninguna escritura de ajustes de uno la rompe para el otro
