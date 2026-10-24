import { LoginForm } from "@/components/auth/LoginForm";
import { siguienteSeguro } from "@/lib/access";

/**
 * Puerta real del candado (change candado-completo-y-athena): toda la
 * interfaz espera al login. El `next` se valida EN SERVIDOR para que un
 * destino malicioso jamás llegue al navegador.
 */
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const siguiente = siguienteSeguro(typeof params.next === "string" ? params.next : null) ?? "/";
  return <LoginForm destino={siguiente} />;
}
