package com.morino23.athena;

import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

/**
 * Actividad única de Athena.
 *
 * Capacitor no registra ningún OnBackPressedCallback (verificado en
 * capacitor-android 7.6.10): el atrás de Android terminaría la actividad
 * SIEMPRE, de modo que salir del lector (o del teleprompter) cerraba la app.
 * Aquí el atrás lo decide la propia web: `window.__athenaBack()` devuelve
 * true si consumió el gesto (cerrar teleprompter → dock → paneles → volver a
 * la biblioteca) y false si no queda nada por cerrar, que es cuando sí
 * terminamos la actividad.
 *
 * DOS TRAMPAS que costaron un APK roto:
 *
 * 1. `evaluateJavascript` devuelve JSON, no texto. Una cadena JS '1' llega
 *    como "\"1\"" (con comillas). Comparar con "1".equals(valor) siempre daba
 *    falso y el atrás salía de la app en TODOS los casos — el bug seguía vivo
 *    con el código correcto en la web. Se devuelve un booleano y se acepta
 *    tanto JSON (lo normal) como el texto pelado (por si cambia el transporte).
 *
 * 2. `finish()` se llama a mano: como el callback está habilitado, el sistema
 *    ya no cierra la actividad por su cuenta y la salida tiene que ser
 *    explícita.
 */
public class MainActivity extends BridgeActivity {

    /** El sepia de la casa: el mismo de background (tema oscuro) y de
     *  res/values/colors.xml@athena_ventana. */
    private static final int SEPIA_VENTANA = Color.parseColor("#211D16");

    /**
     * El atrás es un gesto que cierra la app en silencio: si algo falla, no
     * queda rastro. Este tag deja la decisión en logcat (`adb logcat -s
     * AthenaAtras`) sin ruido en la app.
     */
    private static final String TAG = "AthenaAtras";

    /** La web decide si el atrás tiene algo que cerrar. */
    private static final String CONSULTA_ATRAS =
        "(function(){try{return (window.__athenaBack && window.__athenaBack()) === true;}catch(e){return false;}})();";

    private OnBackPressedCallback callbackAtras;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // El lienzo de la ventana, también en código: styles.xml pone
        // android:windowBackground (y cubre el arranque en frío), pero el
        // decor view de BridgeActivity puede volver a pintarse al recrear la
        // actividad. Sin esto, el hueco del displayCutout y de los systemBars
        // al girar a horizontal se veía BLANCO en mitad de la lectura.
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(SEPIA_VENTANA));

        callbackAtras = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                delegarAtras();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, callbackAtras);
    }

    /** Pregunta a la web; si no tenía nada que cerrar, se sale de la app. */
    private void delegarAtras() {
        Bridge puente = bridge;
        if (puente == null || puente.getWebView() == null) {
            Log.w(TAG, "sin WebView: el atrás sale de la app");
            finish();
            return;
        }
        puente.eval(
            CONSULTA_ATRAS,
            valor -> {
                // La web consumió el gesto (true) o no queda nada por cerrar
                // (false): solo en el segundo caso se sale de la app.
                boolean consumido = esCierto(valor);
                Log.i(TAG, "la web devolvió [" + valor + "] → " + (consumido ? "lo cierro yo" : "salgo de la app"));
                if (!consumido) {
                    finish();
                }
            }
        );
    }

    /**
     * `evaluateJavascript` entrega JSON: true llega como "true", y una cadena
     * llegaría entre comillas. Se aceptan las dos formas.
     */
    private static boolean esCierto(String valor) {
        if (valor == null) return false;
        String limpio = valor.trim();
        return limpio.equals("true") || limpio.equals("\"true\"") || limpio.equals("1") || limpio.equals("\"1\"");
    }
}
