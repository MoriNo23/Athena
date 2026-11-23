# Spec Delta

## Purpose

Define cómo el teleprompter respira en español, cuándo da por leída la página, cómo lo avisa sin invadir y cómo su interfaz respeta el móvil real (notch, puntero táctil y contador visible).

## ADDED Requirements

### Requirement: Los números españoles no se leen como puntuación de frase

El motor SHALL tratar el punto entre dígitos (`1.500`, `12.000`) como separador de miles y la coma entre dígitos (`3,14`) como separador decimal: ninguno SHALL añadir pausa de frase ni SHALL cortar la tarjeta por ese carácter.

#### Scenario: Miles con punto

- **WHEN** el flujo encuentra `1.500 euros`
- **THEN** revela la cifra sin pausa de punto y sin cortar la tarjeta

#### Scenario: Decimal con coma

- **WHEN** el flujo encuentra `3,14`
- **THEN** revela la cifra sin pausa de coma

### Requirement: Las abreviaturas no cortan la lectura

El motor SHALL reconocer las abreviaturas españolas frecuentes (`Sr.`, `Sra.`, `Dr.`, `Dra.`, `Ud.`, `Uds.`, `etc.`, `p. ej.`, `EE. UU.`, `a. C.`) y NO SHALL aplicarles pausa de punto ni cortar la tarjeta en ese punto.

#### Scenario: Tratamiento y abreviatura

- **WHEN** el flujo encuentra `El Sr. Pérez llegó`
- **THEN** revela la frase completa como una sola tarjeta, sin pausa larga tras `Sr.`

### Requirement: Los signos de apertura y los párrafos abren respiro

El motor SHALL dar un respiro breve antes de `¿` y `¡`, y SHALL añadir una pausa de párrafo al primer carácter de un bloque de cuerpo que sigue a otro bloque de cuerpo. Las tarjetas creadas al partir un mismo párrafo NO SHALL recibir esa pausa de párrafo.

#### Scenario: Pregunta tras coma

- **WHEN** el texto pasa de una coma a `¿Qué hora es?`
- **THEN** el `¿` se revela tras un respiro breve, no pegado a la coma

#### Scenario: Dos párrafos seguidos

- **WHEN** termina un bloque de cuerpo y empieza otro sin título entre medias
- **THEN** el primer carácter del segundo bloque paga la pausa de párrafo

### Requirement: La raya respira al abrir y al cerrar

La raya de diálogo (`—` o `–`) SHALL añadir una pausa breve tanto al abrir el parlamento como al cerrarlo.

#### Scenario: Diálogo con raya

- **WHEN** el flujo encuentra `—Hola —dijo`
- **THEN** hay un respiro tras la raya de apertura y otro tras la de cierre

### Requirement: La página se marca al entrar en su última línea visible

El teleprompter SHALL marcar la página en curso como leída cuando el encendido alcanza la primera línea visible del final de esa página, medido sobre los caracteres reales del DOM. NO SHALL marcarla al entrar en la página ni al anunciarla para el progreso.

#### Scenario: Cerrar en la última línea

- **GIVEN** el flujo va por la última línea de la página 7
- **WHEN** el lector cierra el teleprompter sin pulsar «siguiente»
- **THEN** la página 7 ya sumó como leída

#### Scenario: Entrar no cuenta

- **WHEN** el flujo empieza la página 8
- **THEN** la página 8 todavía no suma como leída

### Requirement: Aviso no invasivo de página leída

Al marcarse una página como leída, el teleprompter SHALL mostrar un aviso efímero con la cifra de hoy del libro, sin capturar el puntero, sin mover el texto y sin pausar el flujo. El aviso SHALL usar `role="status"` con `aria-live="polite"` y SHALL reiniciar su animación en cada página.

#### Scenario: Aviso tras terminar página

- **WHEN** la página 7 se marca como leída
- **THEN** aparece «Página leída · hoy N/meta» durante unos segundos y desaparece solo

#### Scenario: No tapa la lectura

- **WHEN** el aviso está visible
- **THEN** un toque o clic sobre él sigue pausando o reanudando el flujo como si no estuviera

### Requirement: El contador de hoy es visible también en móvil

El par «hoy N/meta» del teleprompter SHALL mostrarse en pantallas estrechas, no solo en escritorio, sin empujar los controles fuera de la barra.

#### Scenario: Móvil

- **WHEN** el teleprompter se abre en un teléfono
- **THEN** el contador de hoy es visible en la cabecera

### Requirement: La interfaz respeta el safe-area del móvil

La barra de progreso, los avisos y la cabecera SHALL calcular su posición a partir de la altura real de la cabecera más `safe-area-inset-top`, de modo que no se solapen en dispositivos con notch.

#### Scenario: Teléfono con notch

- **WHEN** el teleprompter se abre en un dispositivo con safe-area superior
- **THEN** el progreso y los avisos quedan por debajo del texto de la cabecera

### Requirement: Los avisos no repintan el fondo en puntero táctil

En punteros gruesos, los avisos del teleprompter NO SHALL usar `backdrop-filter`, por la misma clase de parpadeo del WebView que ya se corrigió en cabecera y pie.

#### Scenario: APK Android

- **WHEN** el aviso de página aparece en el APK
- **THEN** no aplica desenfoque de fondo

### Requirement: Prioridad entre avisos

Si el aviso de descanso está visible, el aviso de página leída SHALL esperar su turno o compartir el mismo hueco sin solaparse; nunca SHALL mostrarse dos píldoras superpuestas.

#### Scenario: Descanso armado y página terminada

- **GIVEN** el aviso de descanso está en pantalla
- **WHEN** se termina una página
- **THEN** no aparecen dos avisos superpuestos
