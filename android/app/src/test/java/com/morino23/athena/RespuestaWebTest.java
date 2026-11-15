package com.morino23.athena;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * El contrato del atrás: lo que `evaluateJavascript` entrega de verdad.
 *
 * Las cadenas de este test NO son inventadas: son las que documenta Android
 * (y confirma la propia documentación del API). El bug original comparaba con
 * la cadena sin comillas y por eso el atrás sacaba de la app siempre.
 *
 * Corre en la JVM con `./gradlew testDebugUnitTest` — sin emulador. El CI lo
 * ejecuta antes de compilar el APK: si esta lógica se rompe, el release se
 * para en vez de publicar un APK que cierra la app al deslizar atrás.
 */
public class RespuestaWebTest {

    // ---------- lo que devuelve un script que responde «sí» ----------

    @Test
    public void booleanoTrueLlegaComoTextoTrue() {
        // return true  →  "true"
        assertTrue(RespuestaWeb.esCierto("true"));
    }

    @Test
    public void cadenaUnoLlegaEntreComillas() {
        // return '1'  →  "\"1\""   (ESTE era el caso roto)
        assertTrue(RespuestaWeb.esCierto("\"1\""));
    }

    @Test
    public void cadenaTrueLlegaEntreComillas() {
        // return 'true'  →  "\"true\""
        assertTrue(RespuestaWeb.esCierto("\"true\""));
    }

    @Test
    public void numeroUnoLlegaSinComillas() {
        // return 1  →  "1"
        assertTrue(RespuestaWeb.esCierto("1"));
    }

    @Test
    public void toleraEspacios() {
        assertTrue(RespuestaWeb.esCierto("  \"1\"  "));
        assertTrue(RespuestaWeb.esCierto(" true "));
    }

    // ---------- lo que devuelve un script que responde «no» ----------

    @Test
    public void booleanoFalse() {
        assertFalse(RespuestaWeb.esCierto("false"));
    }

    @Test
    public void cadenaCeroEntreComillas() {
        assertFalse(RespuestaWeb.esCierto("\"0\""));
    }

    @Test
    public void numeroCero() {
        assertFalse(RespuestaWeb.esCierto("0"));
    }

    @Test
    public void nullDeJsLlegaComoCadenaNull() {
        // return null  →  la Cadena "null", NO un null de Java
        assertFalse(RespuestaWeb.esCierto("null"));
    }

    @Test
    public void undefinedLlegaComoNullDeJava() {
        // sin return  →  null de Java
        assertFalse(RespuestaWeb.esCierto(null));
    }

    @Test
    public void cadenaVaciaLlegaComoDosComillas() {
        // return ''  →  "\"\""
        assertFalse(RespuestaWeb.esCierto("\"\""));
    }

    @Test
    public void basuraNoRompe() {
        assertFalse(RespuestaWeb.esCierto("{no es json"));
        assertFalse(RespuestaWeb.esCierto("undefined"));
    }

    @Test
    public void objetoNoEsUnSi() {
        // return {ok:true}  →  "{\"ok\":true}"  — no es un gesto consumido.
        // No hay parser a propósito: esto solo se pregunta por un booleano.
        assertFalse(RespuestaWeb.esCierto("{\"ok\":true}"));
    }

    // ---------- el bug, clavado ----------

    @Test
    public void laComparacionOriginalHaciaSiempreFalso() {
        // Así estaba escrito: "1".equals(valor). Con la respuesta real de
        // Android ("\"1\"") da false → finish() → el atrás sacaba de la app.
        String loQueLlegaDeAndroid = "\"1\"";
        assertFalse("1".equals(loQueLlegaDeAndroid));
        // y la lectura correcta lo entiende
        assertTrue(RespuestaWeb.esCierto(loQueLlegaDeAndroid));
    }
}
