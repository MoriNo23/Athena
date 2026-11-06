# Seguridad — riesgos aceptados y reglas de la casa

## El keystore del APK vive en el repo (público)

`android/keystore/athena.keystore` y sus contraseñas
(`android/keystore/athena.properties`) están commiteados, y el repo es
público (MIT). Cualquiera puede descargarse la llave con la que se firma el
APK. Es una decisión consciente para que el workflow «Athena APK» firme en
la nube sin secretos añadidos. Este documento explica qué implica de verdad
y cómo convivir con ello.

### Qué implica de verdad

- Android identifica una app por su firma: un APK firmado con esta llave se
  instala ENCIMA de una Athena ya instalada como si fuera una actualización
  oficial.
- Nadie puede firmar «otra Athena» con otra identidad de paquete: el paquete
  `com.morino23.athena` queda atado a esta llave (a menos que se rote).
- El riesgo concreto: si algún día se instala un Athena que NO salió de tus
  releases (ni de tus GitHub Actions), esa instalación firmada con esta
  misma llave convencería al teléfono de que es una actualización legítima.

### Mitigaciones de la casa (sin rotar la llave)

1. Instalar APKs SOLO de dos sitios: artifacts de tus GitHub Actions o
   releases oficiales del repo. Desconfiar de cualquier otro canal.
2. El workflow «Athena APK» corre los tests antes de firmar: un APK no sale
   de un run rojo.
3. No prestar el teléfono a quien no quieras que instale nada.

### Si algún día se quiere rotar la llave (opción, no decisión hoy)

1. Generar un keystore nuevo FUERA del repo y no subirlo nunca.
2. Consecuencia obligatoria: Android exigirá desinstalar la app actual en
   cada dispositivo (rechaza una firma distinta sin desinstalar), y al
   desinstalar SE PIERDE la biblioteca local del APK (vive en el
   almacenamiento privado de la app).
3. Antes de desinstalar: exportar lo que se quiera conservar. Los ficheros
   fuente de los libros siguen siendo la fuente de la verdad.

### Decisión vigente (2026-11-06)

Riesgo aceptado y documentado; sin rotación. Esta decisión se revisa si el
repo algún día deja de ser personal (p. ej. contribuciones de terceros con
acceso de escritura).

## Nunca commitear

- Secretos: `.env*` (salvo `.env.example`), tokens, `*.pem`, contraseñas
  nuevas. La excepción histórica es solo el keystore de arriba.
- Estado privado de la biblioteca: `*.db`, `db/*`, `public/uploads/*`.
- Ruido: `dev.log`, `server.log`, snapshots de estado
  (`scripts/user-state-snapshot/`).

Si un secreto nuevo acaba en el historial por accidente: rotarlo cuanto
antes (cambiar la credencial, no solo borrar el fichero — el historial no
se limpia solo).
