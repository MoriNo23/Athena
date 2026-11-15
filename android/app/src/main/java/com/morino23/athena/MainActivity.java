package com.morino23.athena;

import android.graphics.Color;
import android.os.Bundle;
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
 */
public class MainActivity extends BridgeActivity {

    /** El sepia de la casa: el mismo de --background (tema oscuro) y de
     *  res/values/colors.xml@athena_ventana. */
    private static final int SEPIA_VENTANA = Color.parseColor("#211D16");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // El lienzo de la ventana, también en código: styles.xml pone
        // android:windowBackground (y cubre el arranque en frío), pero el
        // decor view de BridgeActivity puede volver a pintarse al recrear la
        // actividad. Sin esto, el hueco del displayCutout y de los systemBars
        // al girar a horizontal se veía BLANCO en mitad de la lectura.
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(SEPIA_VENTANA));

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    Bridge puente = bridge;
                    if (puente == null || puente.getWebView() == null) {
                        finish();
                        return;
                    }
                    puente.eval(
                        "(function(){try{return (window.__athenaBack && window.__athenaBack()) === true ? '1':'0';}catch(e){return '0';}})();",
                        valor -> {
                            // La web no tenía nada que cerrar: atrás = salir.
                            if (!"1".equals(valor)) {
                                finish();
                            }
                        }
                    );
                }
            }
        );
    }
}
