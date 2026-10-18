# Spec Delta

## Purpose

La superficie donde se lee: el libro sigue el tema de la app —noche o mañana— y ocupa el ancho disponible con la tipografía de lectura de la casa, en EPUB y en PDF.

## ADDED Requirements

### Requirement: El libro sigue el tema de la app
La superficie de lectura SHALL usar los colores del tema activo en ambos formatos: fondo y tinta del texto en EPUB, y tono aplicado a la página imagen en PDF. El cambio de tema SHALL reflejarse de inmediato sin reiniciar la lectura.

#### Scenario: Cambio de tema en vivo
- **WHEN** el lector alterna entre tema oscuro y claro con un libro abierto
- **THEN** la superficie y la página cambian de tono al instante y la posición de lectura se conserva

### Requirement: Render nocturno por defecto en PDF
En tema oscuro la página de PDF SHALL mostrarse con render nocturno legible por defecto, sin doble inversión cuando el preset elegido ya sea nocturno. Los presets de comodidad SHALL actuar como override manual explícito.

#### Scenario: PDF en tema oscuro
- **WHEN** el tema es oscuro y el libro es un PDF sin preset manual elegido
- **THEN** la página se muestra oscurecida y legible, no como una hoja blanca

#### Scenario: Override manual
- **WHEN** el lector elige un preset de comodidad (Normal, Papel, Sepia, Cálido o Noche)
- **THEN** ese preset manda sobre el render por defecto del tema

### Requirement: Texto a todo el ancho con padding
El texto de lectura SHALL ocupar el ancho completo del área del visor con un padding intencional; no SHALL existir una columna centrada con franjas laterales vacías.

#### Scenario: Notebook 1280×800
- **WHEN** el lector abre un libro reflowable en un viewport de notebook
- **THEN** las líneas usan el ancho disponible separadas solo por su padding, sin franja vacía a los lados

### Requirement: Fuente de lectura configurable
El lector SHALL permitir elegir la fuente del texto reflowable (EPUB y modo texto de PDF) entre las opciones curadas de la casa, con una predeterminada recomendada, y SHALL persistir la elección.

#### Scenario: Cambio de fuente
- **WHEN** el lector elige otra fuente de lectura
- **THEN** el texto reflowable cambia de inmediato y la elección se conserva entre sesiones

### Requirement: Tamaño de lectura ajustable y conservado
El lector SHALL ajustar el tamaño del texto reflowable (A−/A+ y Ctrl+rueda) y conservar el ajuste. En la página imagen del PDF solo aplica el zoom.

#### Scenario: Ajuste de tamaño
- **WHEN** el lector usa A+ o A− durante la lectura
- **THEN** el texto reflowable cambia de tamaño y el ajuste persiste; la página del PDF mantiene su tamaño y se controla con zoom

### Requirement: Contraste AA+ en ambos temas
Los pares fondo/tinta de la superficie de lectura SHALL cumplir contraste AA en ambos temas: al menos 4.5:1 para el cuerpo de texto y al menos 3:1 para títulos.

#### Scenario: Auditoría de contraste
- **WHEN** se auditan los colores de lectura de cada tema
- **THEN** el cuerpo supera 4.5:1 y los títulos superan 3:1 contra su fondo real
