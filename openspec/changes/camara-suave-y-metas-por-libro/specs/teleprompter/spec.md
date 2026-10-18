# Spec Delta

## ADDED Requirements

### Requirement: Vista con transición breve
El modo SHALL acompañar los movimientos de vista del flujo —avance de línea, aparición de un título, cruce de página, revelado completo y rebobinado— con una transición breve y continua, de forma que el texto no aparezca de golpe. Con movimiento reducido o preset instantáneo SHALL NOT haber animación de vista.

#### Scenario: Aparición de un título
- **WHEN** el flujo llega a un título reconocido
- **THEN** la vista llega hasta él con una transición breve —sin salto en seco— y el título sigue apareciendo completo con fundido

#### Scenario: Cruce de página
- **WHEN** el flujo cruza a la página siguiente con Auto activo o por orden del lector
- **THEN** la vista llega a la nueva página con transición breve, sin reacomodo visible de la columna

#### Scenario: Revelado completo
- **WHEN** el lector completa la página de golpe (clic o espacio)
- **THEN** la vista lo acompaña con transición breve en vez de saltar en seco al final

#### Scenario: Rebobinado
- **WHEN** el lector rebobina el encendido con `←` o el control de retroceso
- **THEN** la vista acompaña la posición del rebobinado con transición breve

#### Scenario: Movimiento reducido o instantánea
- **WHEN** el sistema pide movimiento reducido o el preset es instantáneo
- **THEN** los movimientos de vista son inmediatos, sin animación

### Requirement: La relectura manual manda
Mientras el lector se desplaza manualmente —rueda o `↑`— su desplazamiento SHALL mandar sobre el seguimiento automático: al reanudar el avance, el seguimiento SHALL re-sincronizarse con la posición real sin arrastrar la vista de vuelta ni dar tirones.

#### Scenario: Desplazamiento manual durante el avance
- **WHEN** el lector se desplaza hacia arriba con la rueda o `↑` mientras el flujo avanza
- **THEN** la vista obedece al desplazamiento manual y el avance automático queda en pausa, como ya define la relectura

#### Scenario: Reanudar tras releer
- **WHEN** el lector reanuda el avance después de haber releído hacia arriba
- **THEN** el seguimiento continúa desde la posición real del texto, sin tirón hacia la posición anterior
