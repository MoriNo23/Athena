# pdf-text-mode Specification

## Purpose

Leer PDFs digitales como texto reflowable —la misma superficie que un EPUB— sin perder el aparato de progreso de la casa: riel, hitos, racha y ETA siguen hablando de páginas reales.

## Requirements

### Requirement: Extracción y paginación del PDF digital
El modo texto SHALL extraer el texto de un PDF con capa de texto y paginarlo en páginas virtuales de aproximadamente 320 palabras, agrupando líneas en párrafos y detectando encabezados por heurística conservadora.

#### Scenario: PDF digital en modo texto
- **WHEN** el lector abre en modo texto un PDF con capa de texto
- **THEN** el contenido se muestra como páginas de texto reflowable en orden de lectura

### Requirement: Toggle Página/Texto
El lector SHALL ofrecer un toggle Página/Texto para PDFs con capa de texto, alternando sin perder la posición de lectura. En PDFs sin capa de texto (escaneados) el modo texto SHALL no ofrecerse.

#### Scenario: Alternar modos
- **WHEN** el PDF tiene capa de texto y el lector alterna Página/Texto
- **THEN** el visor cambia de modo y la lectura continúa en la misma altura del libro

#### Scenario: PDF escaneado
- **WHEN** el PDF no tiene capa de texto
- **THEN** el toggle de modo texto no se ofrece y el libro se lee como página, igual que hoy

### Requirement: Correspondencia con páginas reales
Cada página virtual SHALL recordar de qué página real del PDF proviene, de modo que página mostrada, riel, hitos, racha y ETA sigan expresándose en páginas reales del libro.

#### Scenario: Cruce de página real
- **WHEN** el lector avanza por el texto hasta contenido de otra página real
- **THEN** el progreso mostrado corresponde a esa página real y los hitos se evalúan igual que en modo página

#### Scenario: Reapertura del libro
- **WHEN** el lector vuelve a abrir un libro leído en modo texto
- **THEN** la posición guardada (página real) se restaura en el modo recordado

### Requirement: Misma superficie y teleprompter
El modo texto SHALL renderizarse con la misma superficie de lectura que el EPUB (tema, fuente, tamaño y ancho completo) y su texto SHALL alimentar al teleprompter.

#### Scenario: Ajustes aplicados
- **WHEN** el lector ajusta tema, fuente o tamaño
- **THEN** el modo texto responde igual que el EPUB

#### Scenario: Teleprompter desde modo texto
- **WHEN** el lector entra al teleprompter leyendo un PDF en modo texto
- **THEN** el teleprompter recorre las páginas virtuales de texto de ese PDF

### Requirement: Preparación no bloqueante
La preparación del modo texto SHALL mostrar progreso y SHALL NOT bloquear la lectura: el lector puede empezar a leer en cuanto hay contenido listo mientras el resto se prepara en segundo plano.

#### Scenario: Primera entrada a modo texto
- **WHEN** el lector entra por primera vez a modo texto de un PDF largo
- **THEN** ve progreso de preparación, puede leer el contenido ya listo y la interfaz no se cuelga

### Requirement: Páginas sin texto extraíble
Cuando una página del PDF no produzca texto extraíble, el modo texto SHALL indicarlo explícitamente en lugar de mostrar un hueco vacío, y el flujo SHALL continuar.

#### Scenario: Página vacía en el flujo
- **WHEN** una página no aporta texto extraíble
- **THEN** se muestra un aviso de página sin texto y la lectura continúa en la siguiente
