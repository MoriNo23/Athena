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

  test("edge-to-edge sin la opción eliminada en Capacitor 8", () => {
    // Capacitor 8 quitó adjustMarginsForEdgeToEdge: el WebView va a pantalla
    // completa y el safe-area se resuelve en CSS.
    expect(cfg).not.toContain("adjustMarginsForEdgeToEdge:");
    expect(leer("src/styles/globals.css")).toContain("env(safe-area-inset-top");
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
    // y en la lógica tampoco puede quedar la comparación cruda
    const logicaSinComentarios = logica.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(logicaSinComentarios).not.toContain('"1".equals(crudo)');
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

/**
 * Versionado: que el merge a main no publique una versión que los móviles
 * ignoran.
 *
 * Cada push a `main` publica un release y mueve el tag `v<versión>`. Si la
 * versión no ha cambiado, el tag se reescribe con otra APK y el versionCode
 * queda idéntico: Android trata el nuevo APK como la MISMA versión, así que
 * quien ya tenga la app instalada no recibe la actualización. Es un fallo
 * silencioso — el release sale verde y el móvil no se entera.
 */
describe("empaquetado móvil · el versionado del release", () => {
  const pkg = JSON.parse(leer("package.json")) as { version: string };

  /** la MISMA fórmula que android/app/build.gradle */
  function versionCode(version: string): number {
    const [mayor = 0, menor = 0, parche = 0] = version.split(".").map(Number);
    return mayor * 100000 + menor * 1000 + parche * 10;
  }

  test("build.gradle deriva el versionCode con la fórmula documentada", () => {
    const gradle = leer("android/app/build.gradle");
    expect(gradle).toContain("vMayor * 100000 + vMenor * 1000 + vParche * 10");
  });

  test("el versionCode es mayor que el del release publicado (v2.1.0)", () => {
    // 2.1.0 → 201000. Si esto falla, mergear publicaría un APK que los
    // móviles con la 2.1.0 instalada no reciben como actualización.
    expect(versionCode(pkg.version)).toBeGreaterThan(201000);
  });

  test("la versión es semver con tres partes", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

/**
 * El release que no se publicó.
 *
 * `release.yml` llama a `release-android.yml` como reusable workflow, y un
 * reusable workflow NO hereda secretos del llamante: hay que declararlos en
 * `on.workflow_call.secrets` y pasarlos en `secrets:` del llamante. Sin las
 * dos mitades, GitHub no se queja, los secretos llegan vacíos, el guard de
 * firma se para y el release no se publica — con el tag ya creado, así que la
 * versión se queda gastada. Pasó exactamente así al primer push a main.
 */
describe("empaquetado móvil · el release recibe los secretos de firma", () => {
  const SECRETOS = [
    "ANDROID_KEYSTORE_BASE64",
    "ANDROID_STORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
  ];
  const apk = leer(".github/workflows/release-android.yml");
  const release = leer(".github/workflows/release.yml");

  test("el workflow del APK declara los secretos en workflow_call", () => {
    const bloque = apk.slice(apk.indexOf("workflow_call:"), apk.indexOf("permissions:"));
    for (const s of SECRETOS) {
      expect(bloque).toContain(s);
    }
    // declarados y obligatorios: si falta uno, el release debe romper claro
    expect(bloque).toContain("required: true");
  });

  test("el llamante se los pasa (un reusable workflow no los hereda)", () => {
    const bloque = release.slice(release.indexOf("uses: ./.github/workflows/release-android.yml"));
    const hastaSiguiente = bloque.slice(0, bloque.indexOf("linux:"));
    for (const s of SECRETOS) {
      // el literal de GitHub Actions, sin que JS lo interprete
      const esperado = s + ": $" + "{{ secrets." + s + " }}";
      expect(hastaSiguiente).toContain(esperado);
    }
  });

  test("el disparo manual sigue funcionando (Ahora sí: los secretos del repo)", () => {
    // workflow_dispatch usa los secretos del propio repo: no necesita bloque
    expect(apk).toContain("workflow_dispatch:");
  });
});

/**
 * El icono que seguía siendo el de Capacitor.
 *
 * El fondo del icono adaptativo ya era sepia, el vector del pórtico existía en
 * drawable/… y aun así el launcher seguía enseñando la X azul de la plantilla:
 * `mipmap-anydpi-v26/ic_launcher.xml` apuntaba a `@mipmap/ic_launcher_foreground`,
 * el PNG de Capacitor, y nadie referenciaba el vector. Ningún test miraba el
 * dibujo, solo los colores — así que el fallo pasó el PR y llegó al release.
 */
describe("empaquetado móvil · el icono del launcher es el pórtico", () => {
  // sin comentarios: el XML explica el bug antiguo citando la ruta mala
  const sinComentarios = (t: string) => t.replace(/<!--[\s\S]*?-->/g, "");
  const icono = sinComentarios(leer("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"));
  const redondo = sinComentarios(leer("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml"));

  test("el adaptive icon apunta al VECTOR, no al PNG de la plantilla", () => {
    for (const [nombre, xml] of [["ic_launcher", icono], ["ic_launcher_round", redondo]] as const) {
      expect(`${nombre}:${xml.includes('android:drawable="@drawable/ic_launcher_foreground"')}`).toBe(`${nombre}:true`);
      // el PNG de Capacitor no puede volver
      expect(xml).not.toContain('@mipmap/ic_launcher_foreground');
    }
  });

  test("el vector existe y dibuja el pórtico, no un marco vacío", () => {
    const vector = leer("android/app/src/main/res/drawable/ic_launcher_foreground.xml");
    // las cuatro piezas del templo: frontón, entablamento, columnas, estilóbato
    expect(vector).toContain("#B58A3A"); // frontón (bronce)
    expect(vector).toContain("#E0A94E"); // tímpano y metopas (oro)
    expect(vector).toContain("#F1EEE6"); // mármol
    // al menos 4 columnas (un path con varios sub-trazos)
    expect(vector.match(/M[\d.]+,[\d.]+ L/g)!.length).toBeGreaterThanOrEqual(6);
  });

  test("capa monocroma para los iconos con tema (Android 13+)", () => {
    expect(icono).toContain("<monochrome");
    const mono = leer("android/app/src/main/res/drawable/ic_launcher_monochrome.xml");
    // monocroma de verdad: una sola tinta, sin bronce ni oro
    expect(mono.toUpperCase()).not.toContain("#B58A3A");
    expect(mono.toUpperCase()).not.toContain("#E0A94E");
  });

  test("sin restos de la plantilla de Capacitor", () => {
    // el escudo verde/azul de la plantilla no puede estar en el proyecto
    expect(existsSync(join(RAIZ, "android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml"))).toBe(false);
    expect(existsSync(join(RAIZ, "android/app/src/main/res/drawable/ic_launcher_background.xml"))).toBe(false);
  });

  test("los PNG ic_launcher_foreground no vuelven (los caza el enlazador)", () => {
    // Si existen, un adaptive icon mal escrito puede volver a apuntar a ellos y
    // compilar sin queja: es exactamente el bug que se coló dos veces. Sin
    // ellos, `@mipmap/ic_launcher_foreground` no enlaza y el build falla.
    for (const dpi of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
      const png = `android/app/src/main/res/mipmap-${dpi}/ic_launcher_foreground.png`;
      expect(`${png}:${existsSync(join(RAIZ, png))}`).toBe(`${png}:false`);
    }
  });

  test("la capa monocroma cubre las mismas piezas que el frente", () => {
    const frente = leer("android/app/src/main/res/drawable/ic_launcher_foreground.xml");
    const mono = leer("android/app/src/main/res/drawable/ic_launcher_monochrome.xml");
    // La monocroma omite tímpano y metopas a propósito: en una sola tinta
    // desaparecerían. Pero lo que dibuja tiene que ser LA MISMA geometría del
    // frente, no un dibujo aparte que se quede atrás si el pórtico se redibuja.
    const trazados = (xml: string) => (xml.match(/android:pathData="([^"]+)"/g) ?? [])
      .map((p) => p.slice('android:pathData="'.length, -1));
    const delFrente = trazados(frente);
    const deMono = trazados(mono);
    expect(deMono.length).toBeGreaterThanOrEqual(4);
    for (const t of deMono) {
      expect(`${t.slice(0, 12)} en el frente: ${delFrente.includes(t)}`).toBe(`${t.slice(0, 12)} en el frente: true`);
    }
  });

  test("el splash es del pórtico sobre sepia, no la X azul sobre blanco", () => {
    // los PNG no se pueden leer como texto: se mira el tamaño y que exista el
    // splash de Android 12+, que es el que manda en móviles nuevos
    expect(existsSync(join(RAIZ, "android/app/src/main/res/values-v31/styles.xml"))).toBe(true);
    const v31 = leer("android/app/src/main/res/values-v31/styles.xml");
    expect(v31).toContain("windowSplashScreenBackground");
    expect(v31).toContain("@drawable/ic_launcher_foreground");
  });
});
