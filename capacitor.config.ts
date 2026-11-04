import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuración de Capacitor para el APK de Athena (docs/APK-OFFLINE.md).
 *
 * - webDir "out": la web estática que genera scripts/build-apk-web.mjs.
 * - server.androidScheme "https": el WebView sirve la app desde
 *   https://localhost — sin cleartext y con origen estable para
 *   IndexedDB/OPFS (la biblioteca persiste entre actualizaciones).
 * - Sin server externo: no hay `server.url`, todo va dentro del APK.
 */
const config: CapacitorConfig = {
  appId: "com.morino23.athena",
  appName: "Athena",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
