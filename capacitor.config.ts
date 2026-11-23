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
 * - backgroundColor "#211d16": color del lienzo del WebView antes de que la
 *   web pinte (y de las zonas que la web no cubre). Sin él, el WebView
 *   arranca blanco y, al girar a horizontal, el hueco del recorte de cámara
 *   —que el sistema deja fuera del WebView— se veía blanco sobre la lectura
 *   sepia. Se acompaña de android:windowBackground en styles.xml: uno pinta
 *   el WebView, el otro la ventana nativa que lo rodea.
 * - Edge-to-edge: Capacitor 8 eliminó `adjustMarginsForEdgeToEdge`. El WebView
 *   ocupa la pantalla completa y la app respeta la barra de estado y el recorte
 *   con `env(safe-area-inset-*)` en CSS (ya lo hacían el teleprompter y el
 *   dock). Para bloques nativos que lo necesiten, el plugin System Bars de
 *   Capacitor sustituye la antigua opción de márgenes.
 */
const config: CapacitorConfig = {
  appId: "com.morino23.athena",
  appName: "Athena",
  webDir: "out",
  // Mismo sepia que --background del tema oscuro (globals.css) y que
  // android/app/src/main/res/values/colors.xml@athena_ventana.
  backgroundColor: "#211d16",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
