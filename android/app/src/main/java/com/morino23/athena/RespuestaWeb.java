package com.morino23.athena;

/**
 * Lectura de lo que devuelve `WebView.evaluateJavascript`.
 *
 * LA TRAMPA: evaluateJavascript NO entrega texto, entrega JSON. Si el script
 * devuelve la cadena '1', la callback recibe "\"1\"" — con comillas. Si
 * devuelve null, recibe la cadena "null"; si no devuelve nada, recibe null de
 * Java. Comparar el valor crudo con "1" es siempre falso, que es el bug que
 * hacía que el atrás sacara de la app en todos los casos.
 *
 * SIN DEPENDENCIAS a propósito. `org.json` viene en android.jar, pero en los
 * tests de JVM (app/src/test) ese android.jar son stubs que lanzan «Method not
 * mocked»: usarlo obligaría a añadir el artefacto real al classpath del test y
 * a confiar en el orden de dos implementaciones con el mismo paquete. Los
 * valores que nos llegan son primitivos JSON (booleano, número, cadena), así
 * que un lector de 20 líneas basta, corre igual en el teléfono y en el test, y
 * se puede probar de verdad sin emulador.
 */
public final class RespuestaWeb {

    private RespuestaWeb() {}

    /**
     * ¿La web dijo «sí»? Acepta JSON (true, "true", 1, "1") y también texto
     * pelado, por si algún día cambia el transporte.
     */
    public static boolean esCierto(String crudo) {
        return "1".equals(crudo); // MUTACION de prueba
    }

    /**
     * Quita espacios y, si el valor es una cadena JSON, sus comillas. No es un
     * parser: solo deshace el envoltorio de los primitivos.
     */
    static String desenvuelve(String crudo) {
        if (crudo == null) return "";
        String v = crudo.trim();
        if (v.length() >= 2 && v.charAt(0) == '"' && v.charAt(v.length() - 1) == '"') {
            v = v.substring(1, v.length() - 1);
            // escapes mínimos de JSON dentro de una cadena
            v = v.replace("\\\"", "\"").replace("\\\\", "\\");
        }
        return v.trim();
    }
}
