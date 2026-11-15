/**
 * Guardas del empaquetado móvil (change apk-*).
 *
 * Los puntos débiles de la versión Android no fallan ruidosamente: un
 * `adjustMarginsForEdgeToEdge` olvidado o un `versionName` hardcodeado no
 * rompen el build, simplemente se cuelan en el APK. Estas comprobaciones leen
 * los ficheros de configuración y clavan las decisiones, para que el siguiente
 * PR no las pierda por inercia.
 */
import { describe, test, expect } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

const RAIZ = dirname(import.meta.dir);

function leer(rel: string): string {
  return readFileSync(join(RAIZ, rel), "utf8");
}

describe("empaquetado móvil · capacitor.config.ts", () => {
  const cfg = leer("capacitor.config.ts");

  test("edge-to-edge con márgenes (Android 15 / targetSdk 35)", () => {
    // El default de Capacitor es "disable": el WebView quedaría a pantalla
    // completa y el status bar se comería la cabecera.
    expect(cfg).toContain('adjustMarginsForEdgeToEdge: "auto"');
  });

  test("mixed content sigue permitido (la copia de la casa habla por http LAN)", () => {
    expect(cfg).toContain("allowMixedContent: true");
  });
});

describe("empaquetado móvil · AndroidManifest", () => {
  const manifest = leer("android/app/src/main/AndroidManifest.xml");

  test("el teclado redimensiona en vez de tapar los inputs", () => {
    expect(manifest).toContain('android:windowSoftInputMode="adjustResize"');
  });

  test("la biblioteca local-first no se copia a la nube", () => {
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain("@xml/data_extraction_rules");
  });

  test("la regla de extracción excluye toda la copia de seguridad", () => {
    const reglas = leer("android/app/src/main/res/xml/data_extraction_rules.xml");
    expect(reglas).toContain('<exclude domain="root" />');
  });
});

describe("empaquetado móvil · firma", () => {
  test("el keystore no está trackeado por git", () => {
    let rastreado = "";
    try {
      rastreado = execFileSync("git", ["ls-files", "android/keystore/"], {
        cwd: RAIZ,
        encoding: "utf8",
      });
    } catch {
      rastreado = "";
    }
    expect(rastreado.trim()).toBe("");
  });

  test("el build lee la firma de los secretos del CI", () => {
    const gradle = leer("android/app/build.gradle");
    expect(gradle).toContain("ANDROID_KEYSTORE_BASE64");
    expect(gradle).toContain("ANDROID_STORE_PASSWORD");
    expect(gradle).toContain("ANDROID_KEY_ALIAS");
    expect(gradle).toContain("ANDROID_KEY_PASSWORD");
  });

  test("las variables de firma no tapan las propiedades de SigningConfig", () => {
    // `storePassword storePassword` dentro de signingConfigs: Groovy resuelve
    // la variable local antes que el delegate y intenta llamar a una String
    // (String.call()) → el build revienta al configurar, solo en CI
    const gradle = leer("android/app/build.gradle");
    const colapsan =
      gradle.match(/^[ \t]*(storeFile|storePassword|keyAlias|keyPassword)[ \t]+\1[ \t]*$/gm) ?? [];
    expect(colapsan).toEqual([]);
  });

  test("la huella del keystore del build es la del keystore del repo", () => {
    const gradle = leer("android/app/build.gradle");
    const m = gradle.match(/huellaKeystore\s*=\s*"([0-9a-f]{64})"/);
    expect(m).not.toBeNull();
    const ruta = join(RAIZ, "android/keystore/athena.keystore");
    if (!existsSync(ruta)) return; // en un clon limpio no hay keystore que comparar
    const huella = createHash("sha256").update(readFileSync(ruta)).digest("hex");
    expect(m![1]).toBe(huella);
  });

  test("el workflow se para en voz alta si falta un secreto de firma", () => {
    const wf = leer(".github/workflows/release-android.yml");
    // sin este paso, un secreto ausente daría un APK firmado con debug y el
    // release saldría «bien» pero roto para quienes ya lo tienen instalado
    expect(wf).toContain("Comprobar los secretos de firma");
    expect(wf).toContain("ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}");
  });
});

describe("empaquetado móvil · versión", () => {
  test("el build solo usa propiedades que existen en variables.gradle", () => {
    // un nombre mal tecleado (minSdkSdkVersion) no rompe el build en local si
    // hay keystore local: solo revienta en CI, tarde y sin contexto
    const gradle = leer("android/app/build.gradle");
    const vars = leer("android/variables.gradle");
    const definidas = new Set([...vars.matchAll(/^\s*(\w+)\s*=/gm)].map((m) => m[1]));
    const usadas = [...gradle.matchAll(/rootProject\.ext\.(\w+)/g)].map((m) => m[1]);
    const faltan = [...new Set(usadas)].filter((u) => !definidas.has(u));
    expect(faltan).toEqual([]);
  });

  test("versionName/versionCode nacen de package.json, no se hardcodean", () => {
    const gradle = leer("android/app/build.gradle");
    expect(gradle).toContain("JsonSlurper");
    expect(gradle).toContain("versionName paquete.version");
    expect(gradle).toContain("versionCode versionCodeCalculado");
    // un versionCode fijado a mano es justo lo que se quiere evitar
    expect(gradle).not.toMatch(/versionCode\s+\d/);
    expect(gradle).not.toMatch(/versionName\s+"/);
  });
});

describe("empaquetado móvil · atrás de Android", () => {
  test("MainActivity registra el callback de atrás", () => {
    const java = leer("android/app/src/main/java/com/morino23/athena/MainActivity.java");
    expect(java).toContain("OnBackPressedCallback");
    expect(java).toContain("__athenaBack");
  });

  test("la web decide qué cerrar con el atrás", () => {
    expect(leer("src/lib/back-handler.ts")).toContain("export function athenaBack");
    expect(leer("src/components/reader/ReaderView.tsx")).toContain("setBackHandler");
    expect(leer("src/components/library/LibraryView.tsx")).toContain("setBackHandler");
  });
});

/**
 * El blanco que rompía la lectura en horizontal.
 *
 * Con edge-to-edge, al girar el teléfono el sistema deja fuera del WebView la
 * franja del recorte de cámara y de los systemBars. Ese hueco lo pinta la
 * VENTANA nativa: si hereda el blanco de Theme.AppCompat.Light (Capacitor no
 * fija android:windowBackground), aparece una barra blanca sobre una app
 * sepia. La franja tiene que ser del mismo color que el fondo de la app, en
 * los tres sitios donde se decide: el tema, el config y la actividad.
 */
describe("empaquetado móvil · el blanco del borde no vuelve", () => {
  const SEPIA = "#211d16";

  test("el tema pinta la ventana y las barras del sistema del sepia de la casa", () => {
    const styles = leer("android/app/src/main/res/values/styles.xml");
    const noActionBar = styles.slice(styles.indexOf("<style name=\"AppTheme.NoActionBar\""));
    expect(noActionBar).toContain("<item name=\"android:windowBackground\">@color/athena_ventana</item>");
    expect(noActionBar).toContain("<item name=\"android:navigationBarColor\">@color/athena_ventana</item>");
    // Iconos claros: el default de AppCompat sigue al tema del SISTEMA y un
    // teléfono en modo claro pintaba iconos oscuros sobre el sepia.
    expect(noActionBar).toContain("<item name=\"android:windowLightNavigationBar\">false</item>");
  });

  test("athena_ventana es el mismo color que el theme-color del APK", () => {
    const colors = leer("android/app/src/main/res/values/colors.xml");
    const m = colors.match(/<color name="athena_ventana">(#[0-9A-Fa-f]{6})<\/color>/);
    expect(m).not.toBeNull();
    expect(m![1].toLowerCase()).toBe(SEPIA);
    // y el theme-color del index.html (modo oscuro) es el mismo valor
    const index = leer("index.html");
    expect(index.toLowerCase()).toContain(`content="${SEPIA}"`);
  });

  test("las barras del sistema se declaran para que no heredan el índigo de Capacitor", () => {
    // styles.xml referencia @color/colorPrimary|colorPrimaryDark|colorAccent.
    // Capacitor los aporta (#3F51B5...): se declaran en el proyecto con el
    // bronce de la casa. Si alguien borra colors.xml, styles.xml deja de
    // resolver y el build muere en aapt — este test lo para antes.
    const styles = leer("android/app/src/main/res/values/styles.xml");
    const colors = leer("android/app/src/main/res/values/colors.xml");
    for (const nombre of styles.matchAll(/@color\/([a-z_]+)/gi)) {
      expect(colors).toContain(`<color name="${nombre[1]}">`);
    }
  });

  test("el WebView no arranca blanco (capacitor.config.ts)", () => {
    expect(leer("capacitor.config.ts").toLowerCase()).toContain(`backgroundcolor: "${SEPIA}"`);
  });

  test("la actividad repinta su ventana al recrearse", () => {
    const act = leer("android/app/src/main/java/com/morino23/athena/MainActivity.java");
    expect(act).toContain("setBackgroundDrawable");
    expect(act.toUpperCase()).toContain(SEPIA.toUpperCase());
  });
});

/**
 * El atrás que sacaba de la app.
 *
 * `evaluateJavascript` entrega JSON, no texto: una cadena JS '1' vuelve como
 * "\"1\"". La primera versión comparaba con "1".equals(valor), que es siempre
 * falso, así que el atrás cerraba la app en TODOS los casos aunque el código
 * de la web fuese correcto. El bug es invisible en revisión: el nativo
 * "pregunta a la web y la web dice que sí". Este test fija el contrato.
 */
describe("empaquetado móvil · el atrás pregunta de verdad", () => {
  // sin comentarios: el propio fichero explica el bug antiguo citándolo, y un
  // test que se lee las explicaciones se dispara solo
  const act = leer("android/app/src/main/java/com/morino23/athena/MainActivity.java")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("la consulta devuelve un booleano, no una cadena", () => {
    // una cadena llega envuelta en comillas por evaluateJavascript
    const consulta = act.replace(/\s+/g, " ").match(/CONSULTA_ATRAS = "([^"]+)"/);
    expect(consulta).not.toBeNull();
    expect(consulta![1]).toContain("=== true;");
    expect(consulta![1]).not.toContain("? '1':'0'");
  });

  test("la respuesta se lee con la lógica probada, no con un equals suelto", () => {
    expect(act).toContain("RespuestaWeb.esCierto(valor)");
    // "1".equals(valor) fue el bug; no puede volver
    expect(act).not.toContain('"1".equals(valor)');
  });

  test("la salida es explícita: si la web consume el gesto, no se llama a finish", () => {
    const cuerpo = act.slice(act.indexOf("private void delegarAtras"));
    expect(cuerpo).toContain("boolean consumido = RespuestaWeb.esCierto(valor);");
    expect(cuerpo).toContain("if (!consumido)");
    expect(cuerpo).toContain("finish();");
  });

  test("deja rastro en logcat (un atrás que falla no puede ser silencioso)", () => {
    expect(act).toContain('TAG = "AthenaAtras"');
    expect(act).toContain("Log.i(TAG");
  });
});

/**
 * El atrás, probado en Java de verdad.
 *
 * El bug original (`"1".equals(valor)` contra lo que evaluateJavascript
 * entrega) era lógica, no configuración: un test que lee el fichero con un
 * grep no lo habría cazado. La lógica vive ahora en RespuestaWeb, con un test
 * JUnit que corre en la JVM (sin emulador) y que el CI ejecuta ANTES de
 * compilar el APK. Aquí se vigila que las tres piezas sigan conectadas.
 */
describe("empaquetado móvil · el atrás tiene test ejecutable", () => {
  // sin comentarios: las explicaciones citan el código roto a propósito
  const main = leer("android/app/src/main/java/com/morino23/athena/MainActivity.java")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const logica = leer("android/app/src/main/java/com/morino23/athena/RespuestaWeb.java");
  const junit = leer("android/app/src/test/java/com/morino23/athena/RespuestaWebTest.java");
  const workflow = leer(".github/workflows/release-android.yml");

  test("la actividad usa la lógica probada, no una comparación suelta", () => {
    expect(main).toContain("RespuestaWeb.esCierto(valor)");
    // la comparación rota no puede volver
    expect(main).not.toContain('"1".equals(valor)');
  });

  test("el test JUnit cubre las cadenas reales de evaluateJavascript", () => {
    // true → "true" | '1' → "\"1\"" | null → "null" | undefined → null Java
    expect(junit).toContain('esCierto("true")');
    expect(junit).toContain('esCierto("\\"1\\"")');
    expect(junit).toContain('esCierto("null")');
    expect(junit).toContain("esCierto(null)");
  });

  test("el CI ejecuta los tests de JVM antes de compilar el APK", () => {
    // el COMANDO, no la mención: la cabecera del workflow ya nombra
    // assembleRelease en un comentario
    const tests = workflow.indexOf("./gradlew testDebugUnitTest");
    const build = workflow.indexOf("./gradlew assembleRelease");
    expect(tests).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(-1);
    // el test va ANTES: un APK que cierra la app no debe llegar a publicarse
    expect(tests).toBeLessThan(build);
  });

  test("la lógica no depende de org.json (en tests de JVM son stubs)", () => {
    // `Method not mocked`: android.jar en los unit tests no trae implementación
    const codigo = logica.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(codigo).not.toContain("org.json");
    expect(codigo).not.toContain("JSONTokener");
  });
});
