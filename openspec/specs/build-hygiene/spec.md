# build-hygiene Specification

## Purpose

Garantizar que el repositorio de Athena sea un clon limpio, confiable y sin peso muerto: solo dependencias que producen código en uso, un único lockfile como fuente de instalación, y un build de Next que nunca oculta errores de tipos. Aplica a todo clon self-host y a toda dependencia futura.

## Requirements

### Requirement: Dependencias declaradas en uso
El `package.json` SHALL declarar únicamente dependencias cuyo código es importado (directa o transitivamente) desde `src/` o configuración activa (`tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css`). No SHALL existir dependencias "por si acaso" heredadas de scaffolds.

#### Scenario: Auditoría de dependencia muerta
- **WHEN** se lista cada dependencia de `package.json` y se buscan sus imports en `src/` más la configuración activa
- **THEN** cada una tiene al menos una coincidencia, o se elimina en el mismo change

#### Scenario: Reinventario post-limpieza
- **WHEN** la auditoría se repite después de aplicar el change
- **THEN** la lista de dependencias sin uso es vacía

### Requirement: Un único lockfile
El repositorio SHALL mantener exactamente un lockfile: `bun.lock` (Bun es el runtime y gestor declarados para el self-host) y SHALL NOT contener lockfiles de otros gestores (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`).

#### Scenario: Clon fresco determinista
- **WHEN** un usuario clona el repositorio y ejecuta `bun install`
- **THEN** la instalación se resuelve con `bun.lock` y no existe otro lockfile en la raíz del repo

### Requirement: El build no oculta errores de tipos
La configuración de Next SHALL NOT desactivar `typescript.ignoreBuildErrors`: `next build` MUST fallar ante errores de tipos de TypeScript, de modo que el build de producción sea una red real y no un duplicado textual del checklist manual.

#### Scenario: Error de tipos en build
- **WHEN** el código introduce un error de tipos y se ejecuta `next build`
- **THEN** el build falla reportando el error de TypeScript antes del reporte de rutas

### Requirement: Strict mode reactivo o decisión documentada
`reactStrictMode` SHALL estar activado (`true`) en producción y dev. Si la doble invocación de efectos en dev rompe un modo de lectura (p. ej., el teleprompter), la desactivación SHALL quedar documentada en el propio `next.config.ts` con la razón y la condición para reintentar.

#### Scenario: Efectos dobles visibles en dev
- **WHEN** se ejecuta `next dev` con `reactStrictMode: true`
- **THEN** los flujos de lectura (PDF, EPUB, teleprompter) y las API routes funcionan sin estado duplicado

#### Scenario: Desactivación excepcional
- **WHEN** el strict mode rompe un flujo y se decide mantenerlo desactivado
- **THEN** `next.config.ts` contiene un comentario `strict: <razón>, <cuándo reintentar>` y el release checklist sigue pasando

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
