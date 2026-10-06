import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMerchantAuth } from "../server/auth";

// Spec 0163: sin sesión, la entrada pública abre el alta. La rama con sesión conserva
// el destino de rebote del guard del backoffice (spec 0067 §7) para evitar ciclos.
export default async function MerchantEntryPage() {
  const requestHeaders = await headers();
  // Solo la cookie de sesión de Better Auth puede autenticar esta página. Otras
  // cookies del navegador no requieren inicializar Auth ni consultar la base de datos.
  if (!getSessionCookie(requestHeaders)) redirect("/es/business/onboarding");

  const session = await getMerchantAuth().api.getSession({
    headers: requestHeaders,
  });
  if (!session) redirect("/es/business/onboarding");

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
