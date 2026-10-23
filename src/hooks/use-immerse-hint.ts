import { useEffect, useState, type RefObject } from "react";

const IMMERSE_HINT_SEEN_KEY = "riel-immerse-hint-seen";
const IMMERSE_HINT_HOLD_MS = 4000;

/**
 * Pista única de inmersión (P0 #2): la primera vez POR DISPOSITIVO que el
 * chrome se esconde solo, una pastilla explica cómo vuelve y se retira sola.
 *
 * Solo el auto-ocultado por inactividad la dispara: si la UI la escondió la
 * tecla, el mouse NO la despierta y la pista de «mover el mouse» sería falsa.
 * El encendido corre en un temporizador de 0 ms (fuera de la fase de commit):
 * el setState sincrónico dentro del cuerpo del efecto encadena renders y es
 * exactamente lo que el lint react-hooks/set-state-in-effect señala.
 */
export function useImmerseHint(
  chromeHidden: boolean,
  hiddenByKeyRef: RefObject<boolean>
): boolean {
  const [immerseHint, setImmerseHint] = useState(false);

  useEffect(() => {
    if (!chromeHidden || hiddenByKeyRef.current) return;
    const fire = window.setTimeout(() => {
      if (hiddenByKeyRef.current) return;
      if (localStorage.getItem(IMMERSE_HINT_SEEN_KEY)) return;
      localStorage.setItem(IMMERSE_HINT_SEEN_KEY, "1");
      setImmerseHint(true);
    }, 0);
    return () => window.clearTimeout(fire);
  }, [chromeHidden, hiddenByKeyRef]);

  // se retira sola con su propio reloj; la puerta de render con el chrome
  // despierto (immerseHint && chromeHidden) la retira en cuanto despierta
  useEffect(() => {
    if (!immerseHint) return;
    const retire = window.setTimeout(() => setImmerseHint(false), IMMERSE_HINT_HOLD_MS);
    return () => window.clearTimeout(retire);
  }, [immerseHint]);

  return immerseHint;
}
