package com.morino23.athena;

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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
