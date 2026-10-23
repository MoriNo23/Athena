# Spec Delta

## Purpose

La biblioteca respira con la carpeta del disco que la dueña elija: los libros se registran en su sitio — sin copia, sin tocar los ficheros — y el re-escaneo mantiene la app fiel a la carpeta. El progreso y la data quedan en la BD, jamás junto a los ficheros.

## ADDED Requirements

### Requirement: Libros en su lugar, sin copia

Elegida una carpeta, cada PDF/EPUB que encuentre se registra apuntando al fichero real (`filePath` = ruta de la dueña). La app nunca mueve, renombra ni escribe dentro de un libro.

#### Scenario: Señalar la carpeta una vez

- **WHEN** la dueña elige su carpeta de libros y escanea
- **THEN** los PDF/EPUB aparecen en la biblioteca sin subida alguna y los ficheros siguen donde estaban, byte a byte

#### Scenario: Terminar de leer no deja rastro en el fichero

- **WHEN** la dueña lee, marca hitos o termina un libro registrado en sitio
- **THEN** toda la data va a la BD y el fichero original queda sin tocar (el re-escaneo por hash no lo detecta como «cambiado»)

### Requirement: El re-escaneo es fiel a la carpeta, no destructivo

El re-escaneo (botón; y opcional al arranque) refleja añadidos y retiradas sin borrar por su cuenta: lo retirado pasa a «sin fichero», con progreso intacto y re-vínculo posible.

#### Scenario: Fichero movido por la dueña

- **WHEN** un libro registrado se mueve a otra subcarpeta y se re-escanea
- **THEN** la fila queda en «sin fichero» con su riel, racha e insignia intactas, y re-vincular con la nueva ruta lo devuelve vivo

#### Scenario: Fichero reemplazado por una versión distinta

- **WHEN** el fichero de la ruta cambia de contenido (misma ruta) y la dueña lo escanea
- **THEN** se recalculan las páginas totales y el progreso se ajusta con un clamp honesto — avisando si el recorte es brusco

### Requirement: Añadidos sin duplicados

El registro desduplica por ruta y, ante rutas distintas de igual contenido, por hash del fichero.

#### Scenario: Re-escanear la misma carpeta dos veces

- **WHEN** la dueña re-escanea y nada cambió
- **THEN** la biblioteca queda idéntica: ningún libro repetido, ninguna fila nueva
