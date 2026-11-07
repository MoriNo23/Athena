/**
 * CORS de la copia de la casa (Enmienda 1): solo el WebView del APK tiene
 * permiso para hablar con el servidor desde otro origen. Cualquier otro
 * Origin recibe una respuesta SIN cabeceras CORS: el navegador lo bloquea.
 *
 * No viajan cookies: la sincronización se autentica con la cabecera
 * `X-Athena-Token` (el mismo derivado que guarda la cookie de sesión), así
 * que no hacen falta credenciales ni `Allow-Credentials`.
 */
const ORIGENES_APK = new Set([
  "https://localhost", // Capacitor · androidScheme https (el de la casa)
  "http://localhost", // Capacitor con esquema http
  "capacitor://localhost", // iOS
  "ionic://localhost", // Ionic legacy
]);

export function origenPermitido(req: Request): string | null {
  const origen = req.headers.get("origin") ?? "";
  return ORIGENES_APK.has(origen) ? origen : null;
}

/** Cabeceras CORS para las rutas que la copia usa (vacío si el origen no es el APK) */
export function cabecerasSync(req: Request): Record<string, string> {
  const origen = origenPermitido(req);
  if (!origen) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origen,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Athena-Token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** Preflight: 204 sin datos, con cabeceras solo si el origen es el APK */
export function preflightSync(req: Request): Response {
  return new Response(null, { status: 204, headers: cabecerasSync(req) });
}
