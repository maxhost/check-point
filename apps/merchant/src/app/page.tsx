import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMerchantAuth } from "../server/auth";

type EntrySearchParams = Record<string, string | string[] | undefined>;

/** ¿Trae la raíz un código de rebote (`/?e=<código>`, spec 0067 §Códigos de rebote)? */
function hasBounceCode(e: string | string[] | undefined): boolean {
  if (Array.isArray(e)) return e.some((value) => value.length > 0);
  return typeof e === "string" && e.length > 0;
}

/**
 * La entrada pública del merchant (specs 0163 y 0166).
 *
 * 1. Con `?e=` NUNCA redirige: es un rebote del guard (`auth-guards.ts`), que puede llegar
 *    con la sesión viva (`closed`, integrante de `suspended`). Mandarlo a `/backoffice`
 *    cerraría el ciclo `/` ↔ `/backoffice`.
 * 2. Sin cookie o sesión inválida → el alta.
 * 3. Sesión válida → el panel (decisión del owner, 2026-10-06). No consulta membresía ni
 *    negocio: eso lo decide el guard, y todo rebote suyo a `/` sin `?e=` sale sin sesión.
 */
export default async function MerchantEntryPage({
  searchParams,
}: {
  searchParams: Promise<EntrySearchParams>;
}) {
  if (hasBounceCode((await searchParams).e)) return <EntryCover />;

  const requestHeaders = await headers();
  // Solo la cookie de sesión de Better Auth puede autenticar esta página. Otras
  // cookies del navegador no requieren inicializar Auth ni consultar la base de datos.
  if (!getSessionCookie(requestHeaders)) redirect("/es/business/onboarding");

  const session = await getMerchantAuth().api.getSession({
    headers: requestHeaders,
  });
  if (!session) redirect("/es/business/onboarding");

  redirect("/backoffice");
}

function EntryCover() {
  return (
    <main className="merchant-shell">
      <section className="panel login-panel">
        <p className="eyebrow">CheckPass Club · Negocios</p>
        <h1>Fidelización simple para tu negocio</h1>
        <p>
          Suma clientes con tu programa de puntos o sellos, acredita desde el
          mostrador y llega a tus clientes por su billetera.
        </p>
      </section>
    </main>
  );
}
