/**
 * CORS de la copia de la casa (Enmienda 1): solo el WebView del APK tiene
 * permiso para hablar con el servidor desde otro origen. Cualquier otro
 * Origin recibe una respuesta SIN cabeceras CORS: el navegador lo bloquea.
 *
 * No viajan cookies: la sincronización se autentica con la cabecera
 * `X-Athena-Token` (el mismo derivado que guarda la cookie de sesión), así
 * que no hacen falta credenciales ni `Allow-Credentials`.
 *
 * Firma neutral (origen como string): la usan las rutas de Express
 * (server/api.ts) sin adaptadores de framework.
 */
const ORIGENES_APK = new Set([
  "https://localhost", // Capacitor · androidScheme https (el de la casa)
  "http://localhost", // Capacitor con esquema http
  "capacitor://localhost", // iOS
  "ionic://localhost", // Ionic legacy
]);

export function origenPermitido(origen: string | undefined): string | null {
  return origen && ORIGENES_APK.has(origen) ? origen : null;
}

/** Cabeceras CORS para las rutas que la copia usa (vacío si el origen no es el APK) */
export function cabecerasSync(origen: string | undefined): Record<string, string> {
  const permitido = origenPermitido(origen);
  if (!permitido) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Athena-Token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
