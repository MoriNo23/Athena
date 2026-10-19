# Spec Delta

## MODIFIED Requirements

### Requirement: La relectura manual manda
Mientras el lector se desplaza manualmente —rueda o `↑`— su desplazamiento SHALL mandar sobre el seguimiento automático: al reanudar el avance, el seguimiento SHALL re-sincronizarse con la posición real sin arrastrar la vista de vuelta ni dar tirones. La rueda SHALL mandar también sobre una animación de vista que siga en curso: al llegar la rueda, la vista se queda donde el lector la puso.

#### Scenario: Desplazamiento manual durante el avance
- **WHEN** el lector se desplaza hacia arriba con la rueda o `↑` mientras el flujo avanza
- **THEN** la vista obedece el desplazamiento manual y el avance automático queda en pausa, como ya define la relectura

#### Scenario: Reanudar tras releer
- **WHEN** el lector reanuda el avance después de haber releído hacia arriba
- **THEN** el seguimiento continúa desde la posición real del texto, sin tirón hacia la posición anterior

#### Scenario: Rueda con la cámara en vuelo
- **WHEN** el lector gira la rueda mientras una animación de vista sigue en curso
- **THEN** la vista se queda donde el lector la puso y la cámara no la arrastra de vuelta
