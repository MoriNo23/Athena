/**
 * Aviso de cambio de página del Auto (sin navegador):  bun scripts/test-page-notice.tsx
 * Renderiza el componente con react-dom/server y comprueba cuándo aparece.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { TeleprompterPageNotice, PAGE_SOON_CHARS } from "../src/components/reader/TeleprompterPageNotice";

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  ok ? pass++ : fail++;
}
const base = { auto: true, playing: true, pageDone: false, hasNext: true, start: 180, lit: 0, firstLen: 12, todayPages: 4, todayGoal: 10 };
const html = (o: Partial<typeof base>) => renderToStaticMarkup(<TeleprompterPageNotice {...base} {...o} />);

check("sin aviso al empezar la página", html({ lit: 0, firstLen: 600 }) === "");
const soon = html({ lit: 600 - PAGE_SOON_CHARS, firstLen: 600 });
check("avisa al acercarse al final de la página", soon.includes('data-kind="soon"') && /181/.test(soon), soon.replace(/<[^>]+>/g, " ").trim());
check("página solo-título (12 letras): avisa en cuanto el título se enciende",
  html({ lit: 12, firstLen: 12 }).includes('data-kind="soon"'));
check("sin Auto no hay aviso", html({ auto: false, lit: 590, firstLen: 600 }) === "");
check("en pausa no hay aviso", html({ playing: false, lit: 590, firstLen: 600 }) === "");
check("sin página siguiente no hay aviso", html({ hasNext: false, lit: 590, firstLen: 600 }) === "");
check("accesible: role=status y aria-live", soon.includes('role="status"') && soon.includes('aria-live="polite"'));

console.log(`\n${pass}/${pass + fail} OK`);
process.exit(fail ? 1 : 0);
