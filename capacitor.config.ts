import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuración de Capacitor para el APK de Athena (scripts/build-apk-web.mjs).
 *
 * - webDir "out": la web estática que genera la build del APK (vite --mode apk).
 * - server.androidScheme "https": el WebView sirve la app desde
 *   https://localhost — sin cleartext y con origen estable para
 *   IndexedDB/OPFS (la biblioteca persiste entre actualizaciones).
 * - android.allowMixedContent: la copia de la casa (Enmienda 1) habla con el
 *   servidor por http de LAN desde la página https de la app; el esquema NO
 *   cambia (el origen —y con él la biblioteca— se queda estable) y el permiso
 *   de cleartext vive en el AndroidManifest.
 * - Sin server externo: no hay `server.url`, todo va dentro del APK.
 */
const config: CapacitorConfig = {
  appId: "com.morino23.athena",
  appName: "Athena",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
