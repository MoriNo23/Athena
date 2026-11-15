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
