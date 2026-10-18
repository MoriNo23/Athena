# Spec Delta

## ADDED Requirements

### Requirement: Controles del lector legibles en azul sobre tinte
Los controles del lector que pinten texto en azul de enfoque sobre un tinte del mismo azul —al menos los botones «Pantalla completa» de la cabecera del lector y del chrome del teleprompter— SHALL cumplir contraste AA: al menos 4.5:1 en ambos temas y en los viewports soportados (1280×800 y 390×844), sin alterar el azul de interacción global (`--primary`).

#### Scenario: «Pantalla completa» en tema claro
- **WHEN** se audita el contraste del botón «Pantalla completa» en tema claro a 1280×800 y 390×844
- **THEN** el texto supera 4.5:1 contra su fondo real

#### Scenario: «Pantalla completa» en tema oscuro
- **WHEN** se audita el contraste del botón «Pantalla completa» en tema oscuro a 1280×800 y 390×844
- **THEN** el texto supera 4.5:1 contra su fondo real
