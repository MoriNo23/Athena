/**
 * Marca de Athena: el pórtico ateniense.
 *
 * Mismo dibujo que public/brand/athena-icon.svg (el del README y los assets),
 * en versión React con `currentColor` para poder heredar el color del texto.
 * Dos variantes:
 *  - `portico`: el edificio completo, con frontón, friso, columnas y
 *    estilóbato. Es la marca.
 *  - `sello`: la marca reducida a trazos, la que sobrevive a 16-24 px (el
 *    sello de la cabecera de la biblioteca y el favicon).
 *
 * Si tocas las coordenadas del pórtico, toca también
 * public/brand/athena-icon.svg: son el mismo dibujo.
 */

/** El pórtico completo (240×244). Hereda el color con currentColor. */
export function AthenaPortico({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 244"
      fill="none"
      className={className}
      role="img"
      aria-label="Athena"
      data-testid="athena-portico"
    >
      {/* frontón */}
      <polygon
        points="120,20 200,68 40,68"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
        opacity="0.9"
      />
      {/* tímpano */}
      <polygon points="120,33 148,58 92,58" fill="var(--card)" stroke="currentColor" strokeWidth="2.5" />
      {/* entablamento */}
      <rect x="36" y="68" width="168" height="12" stroke="currentColor" strokeWidth="3.5" />
      <rect x="64" y="68" width="8" height="12" fill="currentColor" />
      <rect x="116" y="68" width="8" height="12" fill="currentColor" />
      <rect x="168" y="68" width="8" height="12" fill="currentColor" />
      {/* columnas */}
      <g stroke="currentColor" strokeWidth="3">
        <rect x="52" y="80" width="12" height="48" />
        <rect x="88" y="80" width="12" height="48" />
        <rect x="140" y="80" width="12" height="48" />
        <rect x="176" y="80" width="12" height="48" />
      </g>
      <g stroke="currentColor" strokeWidth="2">
        <line x1="58" y1="80" x2="58" y2="128" />
        <line x1="94" y1="80" x2="94" y2="128" />
        <line x1="146" y1="80" x2="146" y2="128" />
        <line x1="182" y1="80" x2="182" y2="128" />
      </g>
      {/* estilóbato */}
      <rect x="28" y="128" width="184" height="8" stroke="currentColor" strokeWidth="3.5" />
      <rect x="20" y="136" width="200" height="10" fill="currentColor" stroke="currentColor" strokeWidth="3.5" />
    </svg>
  );
}

/** El sello de trazos: legible a 16 px (favicon, cabecera de la biblioteca). */
export function AthenaSello({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="Athena"
      data-testid="athena-sello"
    >
      <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="square">
        <path d="M14 25 L32 13 L50 25" strokeLinejoin="miter" />
        <line x1="13" y1="30" x2="51" y2="30" />
        <line x1="19" y1="36" x2="19" y2="48" />
        <line x1="27.6" y1="36" x2="27.6" y2="48" />
        <line x1="36.3" y1="36" x2="36.3" y2="48" />
        <line x1="45" y1="36" x2="45" y2="48" />
        <line x1="14" y1="52" x2="50" y2="52" />
      </g>
    </svg>
  );
}
